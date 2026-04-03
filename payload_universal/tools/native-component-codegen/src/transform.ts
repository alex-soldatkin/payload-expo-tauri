import { SyntaxKind, type SourceFile } from 'ts-morph'

/**
 * Transform a web Payload component source file into a React Native equivalent.
 *
 * Returns true if the component should bail out to WebView fallback.
 *
 * Passes:
 *   0. Strip 'use client' directive
 *   1. Import rewriting (@payloadcms/ui -> @payload-universal/ui, etc.)
 *   2. JSX element transforms (div->View, span->Text, etc.)
 *   3. Event/prop transforms (onClick->onPress, id->testID, etc.)
 *   4. Style transforms (strip invalid CSS-in-JS for RN)
 *   5. Bail-out detection (document.*, canvas, etc.)
 */
export function transformComponent(sourceFile: SourceFile): boolean {
  let bailedOut = false

  // ── Pass 0: Strip 'use client' directive ──
  const firstStatement = sourceFile.getStatements()[0]
  if (firstStatement?.getKind() === SyntaxKind.ExpressionStatement) {
    const text = firstStatement.getText().trim()
    if (text === "'use client'" || text === '"use client"') {
      firstStatement.remove()
    }
  }

  // ── Pass 5 (run early to detect bail-out before transforms) ──
  sourceFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.Identifier) {
      const text = node.getText()
      if (text === 'document' || text === 'window') {
        const parent = node.getParent()
        if (parent && parent.getKind() === SyntaxKind.PropertyAccessExpression) {
          bailedOut = true
        }
      }
    }
  })

  // Also check for web-only elements
  const jsxAll = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]
  for (const node of jsxAll) {
    const tag = node.getTagNameNode().getText()
    if (['canvas', 'video', 'audio', 'iframe', 'svg'].includes(tag)) {
      bailedOut = true
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
      newTag = 'Pressable'
      neededRNImports.add('Pressable')
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
    }

    // ── Prop transforms ──
    transformProps(node)
  }

  // ── Add react-native import if needed ──
  if (neededRNImports.size > 0) {
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

  // ── Pass 4: Fix inline styles for RN compatibility ──
  fixInlineStyles(sourceFile)

  return bailedOut
}

// ---------------------------------------------------------------------------
// Prop transforms
// ---------------------------------------------------------------------------

function transformProps(node: any) {
  // onClick → onPress
  const onClick = node.getAttribute('onClick')
  if (onClick) {
    const valueText = onClick.getText()
    const newText = valueText.replace(/^onClick/, 'onPress')
    onClick.replaceWithText(newText)
  }

  // onChange on input → onChangeText
  const tagName = node.getTagNameNode().getText()
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

    // Strip border shorthand (not valid in RN)
    text = text.replace(/border:\s*['"][^'"]*['"]\s*,?/g, '')

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

    // Clean up trailing commas from removed properties
    text = text.replace(/,\s*,/g, ',')
    text = text.replace(/\{\s*,/g, '{')
    text = text.replace(/,\s*\}/g, '}')

    if (text !== attr.getText()) {
      attr.replaceWithText(text)
    }
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
