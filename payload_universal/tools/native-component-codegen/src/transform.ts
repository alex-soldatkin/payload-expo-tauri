import { SyntaxKind, type SourceFile } from 'ts-morph'

/** JSX tags that have no React Native equivalent and force a WebView fallback. */
const WEB_ONLY_TAGS = ['canvas', 'video', 'audio', 'iframe', 'svg']

/**
 * Style properties that only apply to <Text> in React Native. On the web
 * these cascade onto any element; in RN they are invalid on View/Pressable
 * (TS error, ignored or warned at runtime). When a converted container gets
 * a generated <Text> wrapper these props are MOVED onto it; any leftovers on
 * View/Pressable are stripped (they cannot take effect there).
 */
const TEXT_ONLY_STYLE_PROPS = new Set([
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontFamily',
  'color',
  'textAlign',
  'lineHeight',
  'letterSpacing',
  'textTransform',
  'textDecoration',
  'textDecorationLine',
  'textDecorationStyle',
  'textDecorationColor',
])

/**
 * Props that survive the NavWrapper/NavHamburger → View conversion. Everything
 * else (e.g. baseClass) is a web-component prop RN View does not accept.
 */
const VIEW_SAFE_PROPS = new Set(['style', 'key', 'className', 'id', 'testID', 'onClick', 'onPress'])

/**
 * Detect web-only patterns that the AST transform cannot translate to
 * React Native (document/window access, canvas/video/iframe/svg elements).
 *
 * Returns a list of human-readable reasons; an empty list means the
 * component is clean and can go through the normal transform path.
 * Components with reasons should be emitted as WebViewFieldBridge wrappers
 * instead of transformed RN code.
 */
export function detectWebOnlyPatterns(sourceFile: SourceFile): string[] {
  const reasons = new Set<string>()

  // document.* / window.* property access (only when the global is the
  // object being accessed — `foo.document` does not count)
  sourceFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.Identifier) {
      const text = node.getText()
      if (text === 'document' || text === 'window') {
        const parent = node.getParentIfKind(SyntaxKind.PropertyAccessExpression)
        if (parent && parent.getExpression() === node) {
          reasons.add(`${text}.${parent.getName()} access`)
        }
      }
    }
  })

  // Web-only JSX elements
  const jsxAll = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]
  for (const node of jsxAll) {
    const tag = node.getTagNameNode().getText()
    if (WEB_ONLY_TAGS.includes(tag)) {
      reasons.add(`<${tag}> element`)
    }
  }

  return [...reasons]
}

/**
 * Transform a web Payload component source file into a React Native equivalent.
 *
 * Returns true if the component should bail out to WebView fallback
 * (prefer calling `detectWebOnlyPatterns` BEFORE transforming and skipping
 * the transform entirely — the CLI does this and emits a WebView wrapper).
 *
 * Passes:
 *   0. Strip 'use client' directive
 *   1. Import rewriting (@payloadcms/ui -> @payload-universal/ui, etc.)
 *   2. JSX element transforms (div->View, span->Text,
 *      button->NativeActionButton shim — Pressable only as fallback, etc.)
 *   3. Event/prop transforms (onClick->onPress, id->testID, type= strip, etc.)
 *   3a. Wrap raw text/expression children of converted containers in <Text>,
 *       moving text-only style props onto the wrapper
 *   3b. Strip leftover text-only style props from View/Pressable
 *   3c. Native shim compatibility (getPreference type args, useAuth typing)
 *   4. Style transforms (strip/convert invalid CSS-in-JS for RN)
 *   4a. Dark-safe dynamic colors (near-black/near-white text color literals
 *       become PlatformColor-backed Platform.select values on iOS)
 *   5. Bail-out detection (document.*, canvas, etc.)
 */
export function transformComponent(sourceFile: SourceFile): boolean {
  // ── Pass 5 (run early to detect bail-out before transforms) ──
  const bailedOut = detectWebOnlyPatterns(sourceFile).length > 0

  // ── Pass 0: Strip 'use client' directive ──
  const firstStatement = sourceFile.getStatements()[0]
  if (firstStatement?.getKind() === SyntaxKind.ExpressionStatement) {
    const text = firstStatement.getText().trim()
    if (text === "'use client'" || text === '"use client"') {
      firstStatement.remove()
    }
  }

  // ── Pass 1: Import Rewriting ──
  const imports = sourceFile.getImportDeclarations()
  for (const imp of imports) {
    const mod = imp.getModuleSpecifierValue()

    if (mod === '@payloadcms/ui') {
      imp.setModuleSpecifier('@payload-universal/ui')
    } else if (mod === '@payloadcms/ui/shared') {
      imp.setModuleSpecifier('@payload-universal/ui/shared')
    } else if (mod === 'next/navigation') {
      imp.setModuleSpecifier('expo-router')
    } else if (mod === '@payloadcms/translations') {
      // Merge getTranslation into @payload-universal/ui
      imp.setModuleSpecifier('@payload-universal/ui')
    } else if (mod === '@payloadcms/next/client') {
      // Remove Next.js-only imports; elements will be replaced with View
      imp.remove()
    } else if (mod.startsWith('payload/shared')) {
      imp.setModuleSpecifier('@payload-universal/ui/shared')
    } else if (mod.endsWith('.css') || mod.endsWith('.scss') || mod.endsWith('.module.css')) {
      // Strip CSS imports — NativeWind handles Tailwind; BEM classes kept as-is
      imp.remove()
    } else {
      // Deep relative paths → alias
      const doubleDotCount = (mod.match(/\.\.\//g) || []).length
      if (doubleDotCount > 2) {
        imp.setModuleSpecifier(mod.replace(/^(\.\.\/)+/, '@/'))
      }
    }
  }

  // ── Track needed RN imports ──
  const neededRNImports = new Set<string>()

  // ── Pass 2/3: JSX Element + Event Transforms ──
  // Re-collect after import changes
  const jsxElements = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]

  const viewTags = new Set([
    'div', 'nav', 'section', 'header', 'footer', 'main',
    'form', 'ul', 'ol', 'li', 'article', 'aside', 'figure',
  ])
  const textTags = new Set([
    'span', 'p', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'em', 'strong', 'b', 'i',
  ])
  // Web-only components that were imported from @payloadcms/next/client
  const webOnlyComponents = new Set(['NavWrapper', 'NavHamburger'])

  for (const node of jsxElements) {
    const tagNameNode = node.getTagNameNode()
    const tagName = tagNameNode.getText()

    let newTag: string | null = null

    if (viewTags.has(tagName) || webOnlyComponents.has(tagName)) {
      newTag = 'View'
      neededRNImports.add('View')
    } else if (textTags.has(tagName)) {
      newTag = 'Text'
      neededRNImports.add('Text')
    } else if (tagName === 'button') {
      // Text-only buttons map onto the NativeActionButton shim, which renders
      // a real native button (SwiftUI glass/bordered on iOS, themed Pressable
      // elsewhere) and owns its label + appearance. Buttons with element
      // children (icons, nested markup, {children}) keep the legacy Pressable
      // fallback — a native button label can't represent arbitrary content.
      if (isShimmableButton(node)) {
        newTag = 'NativeActionButton'
        ensureUiNamedImport(sourceFile, 'NativeActionButton')
      } else {
        newTag = 'Pressable'
        neededRNImports.add('Pressable')
      }
    } else if (tagName === 'a') {
      // <a href=...> → expo-router <Link>
      newTag = 'ExpoLink'
      ensureExpoLinkImport(sourceFile)
    } else if (tagName === 'input') {
      newTag = 'RNTextInput'
      neededRNImports.add('TextInput')
    } else if (tagName === 'img') {
      newTag = 'RNImage'
      neededRNImports.add('Image')
    }

    if (newTag) {
      tagNameNode.replaceWithText(newTag)

      // Update matching closing tag
      if (node.getKind() === SyntaxKind.JsxOpeningElement) {
        const parent = node.getParentIfKind(SyntaxKind.JsxElement)
        if (parent) {
          const closing = parent.getClosingElement()
          if (closing) {
            closing.getTagNameNode().replaceWithText(newTag)
          }
        }
      }

      // Web-only wrapper components (NavWrapper/NavHamburger) carry props
      // RN View does not accept (e.g. baseClass) — strip everything that is
      // not a universally valid RN/NativeWind prop.
      if (webOnlyComponents.has(tagName)) {
        stripUnknownViewProps(node)
      }

      // The NativeActionButton shim owns its native appearance — drop the
      // button's web-only props and translated visual styles (margins only).
      if (newTag === 'NativeActionButton') {
        sanitizeNativeActionButtonProps(node)
      }
    }

    // ── Prop transforms ──
    transformProps(node)
  }

  // ── Pass 3a: Text-wrap raw text/expression children of converted containers ──
  wrapRawTextChildren(sourceFile, neededRNImports)

  // ── Pass 3b: Strip leftover text-only style props from View/Pressable ──
  stripTextOnlyStylesFromContainers(sourceFile)

  // ── Pass 3c: Native shim compatibility fixes ──
  applyShimCompatFixes(sourceFile)

  // ── Pass 4: Fix inline styles for RN compatibility ──
  fixInlineStyles(sourceFile)

  // ── Pass 4a: Dark-safe dynamic text colors ──
  applyDynamicTextColors(sourceFile, neededRNImports)

  // ── Add react-native import if needed (after all passes that request one) ──
  addReactNativeImports(sourceFile, neededRNImports)

  return bailedOut
}

// ---------------------------------------------------------------------------
// Prop transforms
// ---------------------------------------------------------------------------

function transformProps(node: any) {
  const tagName = node.getTagNameNode().getText()

  // onClick → onPress
  const onClick = node.getAttribute('onClick')
  if (onClick) {
    const valueText = onClick.getText()
    const newText = valueText.replace(/^onClick/, 'onPress')
    onClick.replaceWithText(newText)
  }

  // onChange on input → onChangeText
  if (tagName === 'RNTextInput' || tagName === 'input') {
    const onChange = node.getAttribute('onChange')
    if (onChange) {
      let attrText = onChange.getText()
      // Replace e.target.value with direct text param
      attrText = attrText
        .replace(/e\.target\.value/g, 'text')
        .replace(/\(e\)\s*=>/g, '(text) =>')
        .replace(/e\s*=>/g, 'text =>')
        .replace(/^onChange/, 'onChangeText')
      onChange.replaceWithText(attrText)
    }

    // Strip type="text" (not valid on RN TextInput)
    const typeAttr = node.getAttribute('type')
    if (typeAttr) {
      const typeVal = typeAttr.getText()
      if (typeVal.includes('"text"') || typeVal.includes("'text'")) {
        typeAttr.remove()
      }
    }
  }

  // Strip type= on converted containers (e.g. <button type="button"> —
  // View/Pressable have no type prop)
  if (tagName === 'Pressable' || tagName === 'View') {
    const typeAttr = node.getAttribute('type')
    if (typeAttr) {
      typeAttr.remove()
    }
  }

  // id → testID
  const idAttr = node.getAttribute('id')
  if (idAttr) {
    const attrText = idAttr.getText()
    idAttr.replaceWithText(attrText.replace(/^id=/, 'testID='))
  }

  // Strip prefetch (not valid on RN)
  const prefetch = node.getAttribute('prefetch')
  if (prefetch) {
    prefetch.remove()
  }

  // Strip htmlFor
  const htmlFor = node.getAttribute('htmlFor')
  if (htmlFor) {
    htmlFor.remove()
  }

  // href on <a> was converted to ExpoLink — keep href prop as-is (expo-router Link accepts href)
}

/** Remove every JSX attribute not in the View-safe allowlist (keeps spreads). */
function stripUnknownViewProps(node: any) {
  for (const attr of [...node.getAttributes()]) {
    if (attr.getKind() !== SyntaxKind.JsxAttribute) continue
    const name = attr.getNameNode().getText()
    if (!VIEW_SAFE_PROPS.has(name)) {
      attr.remove()
    }
  }
}

// ---------------------------------------------------------------------------
// NativeActionButton shim mapping for web <button>
// ---------------------------------------------------------------------------

/**
 * Props the NativeActionButton shim accepts (pre-transform names included:
 * onClick becomes onPress and id becomes testID later in transformProps).
 * Everything else on a web <button> (type, className, aria-*, ...) is
 * dropped — the shim owns its native appearance.
 */
const ACTION_BUTTON_SAFE_PROPS = new Set([
  'onClick',
  'onPress',
  'disabled',
  'style',
  'key',
  'id',
  'testID',
])

/**
 * True when a <button> can be represented by the NativeActionButton shim:
 * it has at least one text-producing child and ALL children are
 * text-producing (raw text or expressions that cannot render elements).
 * Element/fragment children (icons, nested markup, {children}) force the
 * legacy Pressable fallback, which can host arbitrary content.
 */
function isShimmableButton(node: any): boolean {
  if (node.getKind() !== SyntaxKind.JsxOpeningElement) return false // self-closing: no label
  const parent = node.getParentIfKind(SyntaxKind.JsxElement)
  if (!parent) return false

  let hasLabel = false
  for (const child of parent.getJsxChildren()) {
    const kind = child.getKind()
    if (kind === SyntaxKind.JsxText) {
      if (child.getText().trim().length > 0) hasLabel = true
      continue
    }
    if (kind === SyntaxKind.JsxExpression) {
      if (!child.getExpression?.()) continue // {/* comment */} — neutral
      if (isWrappableExpression(child)) {
        hasLabel = true
        continue
      }
      return false // expression may render elements
    }
    return false // element/fragment child
  }
  return hasLabel
}

/**
 * Strip web-only props from a converted NativeActionButton and reduce its
 * style to margin-only layout props. Translated web visuals (background,
 * border, padding, fontSize, ...) must NOT transfer — the shim renders the
 * native button appearance itself; only margins still matter for layout.
 * Non-literal styles (styles.x, conditionals) are dropped entirely since
 * their contents can't be filtered statically.
 */
function sanitizeNativeActionButtonProps(opening: any) {
  for (const attr of [...opening.getAttributes()]) {
    if (attr.getKind() !== SyntaxKind.JsxAttribute) continue // keep spreads
    const name = attr.getNameNode().getText()
    if (!ACTION_BUTTON_SAFE_PROPS.has(name)) attr.remove()
  }

  const styleAttr = opening.getAttribute?.('style')
  if (!styleAttr) return
  const obj = getStyleObjectLiteral(opening)
  if (!obj) {
    styleAttr.remove()
    return
  }
  const toRemove = obj.getProperties().filter((prop: any) => {
    const kind = prop.getKind()
    if (kind !== SyntaxKind.PropertyAssignment && kind !== SyntaxKind.ShorthandPropertyAssignment) {
      return true // spread/computed entries — can't verify, drop
    }
    const name = prop.getName().replace(/^['"]|['"]$/g, '')
    return !name.startsWith('margin')
  })
  for (const prop of toRemove) prop.remove()
  removeStyleAttrIfEmpty(opening, obj)
}

/** Ensure a named import from '@payload-universal/ui' exists. */
function ensureUiNamedImport(sourceFile: SourceFile, name: string) {
  const uiImport = sourceFile.getImportDeclaration(
    d => d.getModuleSpecifierValue() === '@payload-universal/ui',
  )
  if (!uiImport) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@payload-universal/ui',
      namedImports: [name],
    })
  } else if (!uiImport.getNamedImports().some(n => n.getName() === name)) {
    uiImport.addNamedImport(name)
  }
}

// ---------------------------------------------------------------------------
// Text-wrap raw children of converted containers
// ---------------------------------------------------------------------------

/**
 * Raw text (or text-producing expressions) directly inside a View/Pressable
 * is a guaranteed RN runtime crash ("Text strings must be rendered within a
 * <Text> component"). Wrap each contiguous run of such children in <Text>,
 * moving any text-only style props from the container's style object onto
 * the wrapper (CSS cascades them on the web; RN does not).
 */
function wrapRawTextChildren(sourceFile: SourceFile, neededRNImports: Set<string>) {
  // Each iteration mutates one container then re-collects — the textual
  // replacement invalidates previously captured node references.
  for (let guard = 0; guard < 500; guard++) {
    const container = sourceFile
      .getDescendantsOfKind(SyntaxKind.JsxElement)
      .find(el => isConvertedContainer(el) && findWrappableRuns(el).length > 0)
    if (!container) return

    // Hoist text-only style props off the container first (AST mutation —
    // shifts child positions, so runs are re-queried right after).
    const hoisted = hoistTextOnlyStyleProps(container.getOpeningElement())
    const styleAttr = hoisted ? ` style={{ ${hoisted} }}` : ''

    const runs = findWrappableRuns(container)
    const fullText = sourceFile.getFullText()
    const ranges = runs
      .map(run => ({
        start: run[0].getStart(),
        end: run[run.length - 1].getEnd(),
      }))
      // Replace back-to-front so earlier ranges stay valid.
      .sort((a, b) => b.start - a.start)

    for (const { start, end } of ranges) {
      // Replace only the trimmed core so surrounding whitespace/newlines
      // (e.g. the indent before the closing container tag) survive.
      const raw = fullText.slice(start, end)
      const leading = raw.length - raw.trimStart().length
      const trailing = raw.length - raw.trimEnd().length
      sourceFile.replaceText(
        [start + leading, end - trailing],
        `<Text${styleAttr}>${raw.trim()}</Text>`,
      )
    }
    neededRNImports.add('Text')
  }
}

function isConvertedContainer(el: any): boolean {
  const tag = el.getOpeningElement().getTagNameNode().getText()
  return tag === 'View' || tag === 'Pressable'
}

/**
 * Contiguous runs of JSX children that must be wrapped in <Text>:
 * non-whitespace JsxText and expressions that cannot render elements.
 * Whitespace-only JsxText joins adjacent wrappable children into one run
 * (`Hello {name}` becomes a single <Text>).
 */
function findWrappableRuns(el: any): any[][] {
  const runs: any[][] = []
  let current: any[] = []
  const flush = () => {
    if (current.length > 0) runs.push(current)
    current = []
  }

  for (const child of el.getJsxChildren()) {
    const kind = child.getKind()
    if (kind === SyntaxKind.JsxText) {
      if (child.getText().trim().length === 0) continue // neutral whitespace
      current.push(child)
    } else if (kind === SyntaxKind.JsxExpression && isWrappableExpression(child)) {
      current.push(child)
    } else {
      flush()
    }
  }
  flush()
  return runs
}

/**
 * True when a JsxExpression child can only produce text (safe to wrap in
 * <Text>). Expressions containing JSX, `children`, or capitalized
 * identifiers (conventionally element/component values, e.g. `{Label}`)
 * are left alone.
 */
function isWrappableExpression(node: any): boolean {
  const expr = node.getExpression?.()
  if (!expr) return false // {/* comment */} or empty expression

  if (
    expr.getKind() === SyntaxKind.JsxElement ||
    expr.getKind() === SyntaxKind.JsxSelfClosingElement ||
    expr.getKind() === SyntaxKind.JsxFragment ||
    expr.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
    expr.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
    expr.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0
  ) {
    return false
  }

  const text = expr.getText()
  // {children} / {props.children} render arbitrary nodes
  if (/(^|\.)children$/.test(text)) return false

  // Bare capitalized identifiers/accesses hold elements by convention
  if (
    expr.getKind() === SyntaxKind.Identifier ||
    expr.getKind() === SyntaxKind.PropertyAccessExpression
  ) {
    const last = text.split('.').pop() ?? text
    if (/^[A-Z]/.test(last)) return false
  }

  return true
}

/**
 * Remove text-only style props from the element's object-literal style and
 * return them as `name: value` segments for the generated <Text> wrapper
 * (renaming CSS `textDecoration` to RN `textDecorationLine`). Non-literal
 * styles (`style={styles.x}`) are left untouched.
 */
function hoistTextOnlyStyleProps(opening: any): string {
  const obj = getStyleObjectLiteral(opening)
  if (!obj) return ''

  const moved: string[] = []
  const toRemove: any[] = []
  for (const prop of obj.getProperties()) {
    const kind = prop.getKind()
    if (kind !== SyntaxKind.PropertyAssignment && kind !== SyntaxKind.ShorthandPropertyAssignment) {
      continue
    }
    const name = prop.getName().replace(/^['"]|['"]$/g, '')
    if (!TEXT_ONLY_STYLE_PROPS.has(name)) continue
    const outName = name === 'textDecoration' ? 'textDecorationLine' : name
    const valueText =
      kind === SyntaxKind.PropertyAssignment ? prop.getInitializer()?.getText() ?? name : name
    moved.push(`${outName}: ${valueText}`)
    toRemove.push(prop)
  }
  for (const prop of toRemove) prop.remove()
  removeStyleAttrIfEmpty(opening, obj)

  return moved.join(', ')
}

/**
 * Text-only style props remaining on a View/Pressable (no text child to
 * carry them) are invalid in RN and cannot take effect — drop them.
 */
function stripTextOnlyStylesFromContainers(sourceFile: SourceFile) {
  const openings = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ].filter(n => {
    const tag = n.getTagNameNode().getText()
    return tag === 'View' || tag === 'Pressable'
  })

  for (const opening of openings) {
    const obj = getStyleObjectLiteral(opening)
    if (!obj) continue
    const toRemove = obj.getProperties().filter((prop: any) => {
      const kind = prop.getKind()
      if (kind !== SyntaxKind.PropertyAssignment && kind !== SyntaxKind.ShorthandPropertyAssignment) {
        return false
      }
      return TEXT_ONLY_STYLE_PROPS.has(prop.getName().replace(/^['"]|['"]$/g, ''))
    })
    for (const prop of toRemove) prop.remove()
    removeStyleAttrIfEmpty(opening, obj)
  }
}

/** style={{ ... }} → the ObjectLiteralExpression, or undefined for any other shape. */
function getStyleObjectLiteral(opening: any): any | undefined {
  const attr = opening.getAttribute?.('style')
  if (!attr || attr.getKind() !== SyntaxKind.JsxAttribute) return undefined
  const init = attr.getInitializer?.()
  if (!init || init.getKind() !== SyntaxKind.JsxExpression) return undefined
  const expr = init.getExpression?.()
  if (!expr || expr.getKind() !== SyntaxKind.ObjectLiteralExpression) return undefined
  return expr
}

function removeStyleAttrIfEmpty(opening: any, styleObject: any) {
  if (styleObject.getProperties().length > 0) return
  const attr = opening.getAttribute?.('style')
  if (attr) attr.remove()
}

// ---------------------------------------------------------------------------
// Native shim compatibility fixes
// ---------------------------------------------------------------------------

/**
 * The @payload-universal/ui native shim is intentionally loosely typed in a
 * couple of places where the web @payloadcms/ui API is generic/strict:
 *
 *  - usePreferences().getPreference is NOT generic in the shim — explicit
 *    type arguments (`getPreference<NavPreferences>(key)`) are a TS error.
 *    Rewritten into a return-type cast that preserves the caller's intent.
 *  - useAuth() returns a loosely-typed user (member access yields `unknown`,
 *    which is not a valid ReactNode). The call result is cast.
 */
function applyShimCompatFixes(sourceFile: SourceFile) {
  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

  const getPreferenceCalls = calls.filter(
    c => c.getExpression().getText() === 'getPreference' && c.getTypeArguments().length > 0,
  )

  const useAuthImported = sourceFile
    .getImportDeclarations()
    .some(
      d =>
        d.getModuleSpecifierValue() === '@payload-universal/ui' &&
        d.getNamedImports().some(n => n.getName() === 'useAuth'),
    )
  const useAuthCalls = useAuthImported
    ? calls.filter(
        c => c.getExpression().getText() === 'useAuth' && c.getArguments().length === 0,
      )
    : []

  for (const call of getPreferenceCalls) {
    const typeArg = call.getTypeArguments()[0].getText()
    const args = call.getArguments().map(a => a.getText()).join(', ')
    call.replaceWithText(`(getPreference(${args}) as Promise<${typeArg} | null>)`)
  }

  for (const call of useAuthCalls) {
    call.replaceWithText(`(useAuth() as { user: any; permissions: Record<string, any> })`)
  }
}

// ---------------------------------------------------------------------------
// Fix inline styles that use CSS syntax invalid in RN
// ---------------------------------------------------------------------------

function fixInlineStyles(sourceFile: SourceFile) {
  // Find all style={{ ... }} JSX attributes
  const styleAttrs = sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute)
    .filter(attr => attr.getNameNode().getText() === 'style')

  for (const attr of styleAttrs) {
    let text = attr.getText()

    // display: 'flex' → flexDirection: 'row' (CSS flex defaults to row, RN defaults to column)
    text = text.replace(/display:\s*['"]flex['"]/g, "flexDirection: 'row'")

    // background (CSS shorthand) → backgroundColor (sources use plain colors)
    text = text.replace(/\bbackground:\s*/g, 'backgroundColor: ')

    // textDecoration → textDecorationLine (RN property name)
    text = text.replace(/\btextDecoration:\s*/g, 'textDecorationLine: ')

    // Convert border side shorthand: borderTop: '1px solid #eee' →
    // borderTopWidth: 1, borderTopColor: '#eee' (RN has no shorthand)
    text = text.replace(
      /border(Top|Right|Bottom|Left)?:\s*['"](\d+)px\s+\w+\s+([^'"]+)['"]/g,
      (_m, side, width, color) =>
        `border${side ?? ''}Width: ${width}, border${side ?? ''}Color: '${color}'`,
    )

    // Strip any remaining border shorthand (not valid in RN)
    text = text.replace(/border(Top|Right|Bottom|Left)?:\s*['"][^'"]*['"]\s*,?/g, '')

    // Strip cursor (not valid in RN)
    text = text.replace(/cursor:\s*['"][^'"]*['"]\s*,?/g, '')

    // Strip display: 'inline' / 'block' / 'inline-block' (not in RN)
    text = text.replace(/display:\s*['"](inline|block|inline-block)['"]\s*,?/g, '')

    // Convert pixel strings to numbers: '8px' → 8, '16px' → 16
    text = text.replace(/['"](\d+)px['"]/g, '$1')

    // Convert padding shorthand string: '4px 8px' → not valid, replace with paddingVertical/Horizontal
    text = text.replace(/padding:\s*['"](\d+)px\s+(\d+)px['"]/g,
      'paddingVertical: $1, paddingHorizontal: $2')

    // Convert margin shorthand string: '4px 8px' → same pattern
    text = text.replace(/margin:\s*['"](\d+)px\s+(\d+)px['"]/g,
      'marginVertical: $1, marginHorizontal: $2')

    // Unitless CSS line-height is a multiplier; RN lineHeight is absolute
    // points. Bake the multiplier in when fontSize is known in the same
    // style object.
    const fontSizeMatch = text.match(/fontSize:\s*(\d+(?:\.\d+)?)/)
    if (fontSizeMatch) {
      text = text.replace(/lineHeight:\s*(\d+(?:\.\d+)?)/g, (match, lineHeight) => {
        const multiplier = parseFloat(lineHeight)
        if (multiplier > 0 && multiplier < 4) {
          return `lineHeight: ${Math.round(parseFloat(fontSizeMatch[1]) * multiplier)}`
        }
        return match
      })
    }

    // Clean up trailing commas and blank lines from removed properties
    text = text.replace(/,\s*,/g, ',')
    text = text.replace(/\{\s*,/g, '{')
    text = text.replace(/,\s*\}/g, '}')
    text = text.replace(/\n[ \t]*(?=\n)/g, '')

    if (text !== attr.getText()) {
      attr.replaceWithText(text)
    }
  }
}

// ---------------------------------------------------------------------------
// Dark-safe dynamic text colors
// ---------------------------------------------------------------------------

/**
 * Web admin components hardcode light-theme text colors. A literal
 * near-black text color (#000–#333 grayscale, 'black') is invisible in dark
 * mode; near-white (#ccc–#fff grayscale, 'white') is invisible in light
 * mode. Replace them with dynamic values: iOS gets the semantic
 * PlatformColor ('label' for near-black, 'systemBackground' for near-white)
 * which adapts to the appearance, other platforms keep the original literal
 * (Platform.OS ternary). Mid-range/hued colors (e.g. '#666', '#1a7f37')
 * are left untouched.
 */
function applyDynamicTextColors(sourceFile: SourceFile, neededRNImports: Set<string>) {
  const styleAttrs = sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute)
    .filter(attr => attr.getNameNode().getText() === 'style')

  for (const attr of styleAttrs) {
    const original = attr.getText()
    // Bare `color:` only — never backgroundColor/borderColor/etc.
    const text = original.replace(
      /(^|[^A-Za-z])color:\s*(['"])([^'"]+)\2/g,
      (match, prefix, _quote, value) => {
        const kind = classifyColorLiteral(value)
        if (!kind) return match
        const platformColor = kind === 'near-black' ? 'label' : 'systemBackground'
        // Ternary (not Platform.select) — select<T> locks T to OpaqueColorValue
        // from the ios value and rejects the string fallback.
        return `${prefix}color: Platform.OS === 'ios' ? PlatformColor('${platformColor}') : '${value}'`
      },
    )

    if (text !== original) {
      attr.replaceWithText(text)
      neededRNImports.add('Platform')
      neededRNImports.add('PlatformColor')
    }
  }
}

/** Classify a CSS color literal as near-black, near-white, or neither. */
function classifyColorLiteral(value: string): 'near-black' | 'near-white' | null {
  const v = value.trim().toLowerCase()
  if (v === 'black') return 'near-black'
  if (v === 'white') return 'near-white'

  const match = v.match(/^#([0-9a-f]{3,8})$/)
  if (!match) return null
  const hex = match[1]

  let r: number, g: number, b: number
  if (hex.length === 3 || hex.length === 4) {
    r = parseInt(hex[0] + hex[0], 16)
    g = parseInt(hex[1] + hex[1], 16)
    b = parseInt(hex[2] + hex[2], 16)
  } else if (hex.length === 6 || hex.length === 8) {
    r = parseInt(hex.slice(0, 2), 16)
    g = parseInt(hex.slice(2, 4), 16)
    b = parseInt(hex.slice(4, 6), 16)
  } else {
    return null
  }

  if (r <= 0x33 && g <= 0x33 && b <= 0x33) return 'near-black'
  if (r >= 0xcc && g >= 0xcc && b >= 0xcc) return 'near-white'
  return null
}

// ---------------------------------------------------------------------------
// react-native import management
// ---------------------------------------------------------------------------

function addReactNativeImports(sourceFile: SourceFile, neededRNImports: Set<string>) {
  if (neededRNImports.size === 0) return

  const existingRNImport = sourceFile.getImportDeclaration(
    d => d.getModuleSpecifierValue() === 'react-native'
  )

  if (existingRNImport) {
    // Add any missing named imports
    const existing = new Set(existingRNImport.getNamedImports().map(n => n.getName()))
    for (const name of neededRNImports) {
      const alias = name === 'TextInput' ? 'RNTextInput' : name === 'Image' ? 'RNImage' : undefined
      const importName = alias ?? name
      if (!existing.has(name) && !existing.has(importName)) {
        if (alias) {
          existingRNImport.addNamedImport({ name, alias })
        } else {
          existingRNImport.addNamedImport(name)
        }
      }
    }
  } else {
    const namedImports = [...neededRNImports].map(name => {
      if (name === 'TextInput') return { name, alias: 'RNTextInput' }
      if (name === 'Image') return { name, alias: 'RNImage' }
      return { name }
    })
    sourceFile.addImportDeclaration({
      moduleSpecifier: 'react-native',
      namedImports,
    })
  }
}

// ---------------------------------------------------------------------------
// Ensure expo-router Link import exists with ExpoLink alias
// ---------------------------------------------------------------------------

function ensureExpoLinkImport(sourceFile: SourceFile) {
  const expoRouterImport = sourceFile.getImportDeclaration(
    d => d.getModuleSpecifierValue() === 'expo-router'
  )

  if (!expoRouterImport) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: 'expo-router',
      namedImports: [{ name: 'Link', alias: 'ExpoLink' }],
    })
  } else {
    const namedImports = expoRouterImport.getNamedImports()
    const hasExpoLink = namedImports.some(
      n => n.getAliasNode()?.getText() === 'ExpoLink' || n.getName() === 'ExpoLink'
    )
    if (!hasExpoLink) {
      expoRouterImport.addNamedImport({ name: 'Link', alias: 'ExpoLink' })
    }
  }
}
