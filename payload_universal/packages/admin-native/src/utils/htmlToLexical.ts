/**
 * Convert react-native-enriched HTML back to Payload Lexical JSON format.
 *
 * Zero external dependencies -- uses a simple regex-based parser since
 * enriched produces clean, predictable HTML with a known subset of tags.
 */

// ---------------------------------------------------------------------------
// Text format bitfield (mirrors Payload's nodeFormat.ts)
// ---------------------------------------------------------------------------
const IS_BOLD = 1
const IS_ITALIC = 1 << 1
const IS_STRIKETHROUGH = 1 << 2
const IS_UNDERLINE = 1 << 3
const IS_CODE = 1 << 4
const IS_SUBSCRIPT = 1 << 5
const IS_SUPERSCRIPT = 1 << 6
// IS_HIGHLIGHT = 1 << 7

// ---------------------------------------------------------------------------
// Lexical node types
// ---------------------------------------------------------------------------
export interface LexicalTextNode {
  type: 'text'
  text: string
  format: number
  detail: number
  mode: 'normal'
  style: string
  version: 1
}

export interface LexicalLinebreakNode {
  type: 'linebreak'
  version: 1
}

export interface LexicalTabNode {
  type: 'tab'
  version: 1
}

export interface LexicalElementNodeBase {
  type: string
  children: LexicalAnyNode[]
  direction: 'ltr'
  format: string | number
  indent: number
  version: 1
}

export interface LexicalParagraphNode extends LexicalElementNodeBase {
  type: 'paragraph'
  textFormat: number
}

export interface LexicalHeadingNode extends LexicalElementNodeBase {
  type: 'heading'
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export interface LexicalQuoteNode extends LexicalElementNodeBase {
  type: 'quote'
}

export interface LexicalListNode extends LexicalElementNodeBase {
  type: 'list'
  listType: 'bullet' | 'number' | 'check'
  start: number
  tag: 'ul' | 'ol'
}

export interface LexicalListItemNode extends LexicalElementNodeBase {
  type: 'listitem'
  value: number
  checked?: boolean
}

export interface LexicalLinkNode extends LexicalElementNodeBase {
  type: 'link'
  fields: {
    linkType: 'custom'
    url: string
    newTab: boolean
  }
  id?: string
}

export interface LexicalAutoLinkNode extends LexicalElementNodeBase {
  type: 'autolink'
  fields: {
    linkType: 'custom'
    url: string
    newTab: boolean
  }
}

export interface LexicalHorizontalRuleNode {
  type: 'horizontalrule'
  version: 1
  format?: string
}

export interface LexicalRelationshipNode {
  type: 'relationship'
  relationTo: string
  value: { id: string | number } | string | number
  format: string
  version: 1
}

export interface LexicalUploadNode {
  type: 'upload'
  relationTo: string
  value: string | number | Record<string, unknown>
  fields: Record<string, unknown>
  id: string
  format: string
  version: 1
}

export type LexicalAnyNode =
  | LexicalTextNode
  | LexicalLinebreakNode
  | LexicalTabNode
  | LexicalParagraphNode
  | LexicalHeadingNode
  | LexicalQuoteNode
  | LexicalListNode
  | LexicalListItemNode
  | LexicalLinkNode
  | LexicalAutoLinkNode
  | LexicalHorizontalRuleNode
  | LexicalRelationshipNode
  | LexicalUploadNode

export interface LexicalEditorState {
  root: {
    type: 'root'
    children: LexicalAnyNode[]
    direction: 'ltr'
    format: ''
    indent: 0
    version: 1
  }
}

// ---------------------------------------------------------------------------
// Node constructors
// ---------------------------------------------------------------------------
function textNode(text: string, format: number = 0): LexicalTextNode {
  return { type: 'text', text, format, detail: 0, mode: 'normal', style: '', version: 1 }
}

function linebreakNode(): LexicalLinebreakNode {
  return { type: 'linebreak', version: 1 }
}

function paragraphNode(children: LexicalAnyNode[], textFormat: number = 0): LexicalParagraphNode {
  return {
    type: 'paragraph',
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat,
    version: 1,
  }
}

function headingNode(
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
  children: LexicalAnyNode[],
): LexicalHeadingNode {
  return { type: 'heading', tag, children, direction: 'ltr', format: '', indent: 0, version: 1 }
}

function quoteNode(children: LexicalAnyNode[]): LexicalQuoteNode {
  return { type: 'quote', children, direction: 'ltr', format: '', indent: 0, version: 1 }
}

function listNode(
  listType: 'bullet' | 'number' | 'check',
  children: LexicalAnyNode[],
): LexicalListNode {
  return {
    type: 'list',
    listType,
    start: 1,
    tag: listType === 'number' ? 'ol' : 'ul',
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  }
}

function listItemNode(
  children: LexicalAnyNode[],
  value: number = 1,
  checked?: boolean,
): LexicalListItemNode {
  const node: LexicalListItemNode = {
    type: 'listitem',
    value,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  }
  if (checked !== undefined) node.checked = checked
  return node
}

function linkNode(url: string, children: LexicalAnyNode[]): LexicalLinkNode {
  return {
    type: 'link',
    fields: { linkType: 'custom', url, newTab: false },
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  }
}

function horizontalRuleNode(): LexicalHorizontalRuleNode {
  return { type: 'horizontalrule', version: 1, format: '' }
}

function relationshipNode(collection: string, id: string | number): LexicalRelationshipNode {
  return {
    type: 'relationship',
    relationTo: collection,
    value: { id },
    format: '',
    version: 1,
  }
}

// ---------------------------------------------------------------------------
// HTML entity un-escaping
// ---------------------------------------------------------------------------
function unescapeHtml(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

// ---------------------------------------------------------------------------
// Minimal HTML tokeniser
// ---------------------------------------------------------------------------
interface Token {
  kind: 'open' | 'close' | 'self-closing' | 'text'
  tag?: string
  attrs?: Record<string, string>
  text?: string
}

/**
 * Parse an attribute string like `href="..." data-type="checkbox" checked`
 * into a Record<string, string>.
 */
function parseAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  // Match: name="value", name='value', or bare name
  const re = /([a-zA-Z_][\w\-:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attrStr)) !== null) {
    const key = m[1]
    const val = m[2] ?? m[3] ?? m[4] ?? ''
    attrs[key] = val
  }
  return attrs
}

function tokenise(html: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < html.length) {
    if (html[pos] === '<') {
      // Find closing >
      const end = html.indexOf('>', pos)
      if (end === -1) {
        // Malformed -- treat rest as text
        tokens.push({ kind: 'text', text: html.slice(pos) })
        break
      }

      const raw = html.slice(pos + 1, end).trim()

      if (raw.startsWith('/')) {
        // Closing tag: </tag>
        const tag = raw.slice(1).trim().split(/\s/)[0].toLowerCase()
        tokens.push({ kind: 'close', tag })
      } else if (raw.endsWith('/')) {
        // Self-closing: <br />, <hr />, <img ... />
        const parts = raw.slice(0, -1).trim()
        const spaceIdx = parts.search(/\s/)
        const tag = (spaceIdx === -1 ? parts : parts.slice(0, spaceIdx)).toLowerCase()
        const attrStr = spaceIdx === -1 ? '' : parts.slice(spaceIdx)
        tokens.push({ kind: 'self-closing', tag, attrs: parseAttrs(attrStr) })
      } else if (raw.startsWith('!')) {
        // Comment or doctype -- skip
      } else {
        // Opening tag
        const spaceIdx = raw.search(/\s/)
        const tag = (spaceIdx === -1 ? raw : raw.slice(0, spaceIdx)).toLowerCase()
        const attrStr = spaceIdx === -1 ? '' : raw.slice(spaceIdx)
        tokens.push({ kind: 'open', tag, attrs: parseAttrs(attrStr) })
      }

      pos = end + 1
    } else {
      // Text content
      const nextTag = html.indexOf('<', pos)
      const text = nextTag === -1 ? html.slice(pos) : html.slice(pos, nextTag)
      if (text.length > 0) {
        tokens.push({ kind: 'text', text })
      }
      pos = nextTag === -1 ? html.length : nextTag
    }
  }

  return tokens
}

// ---------------------------------------------------------------------------
// Simple tree structure for parsed HTML
// ---------------------------------------------------------------------------
interface HtmlElement {
  kind: 'element'
  tag: string
  attrs: Record<string, string>
  children: HtmlNode[]
}

interface HtmlText {
  kind: 'text'
  text: string
}

type HtmlNode = HtmlElement | HtmlText

/** Tags that are self-closing (void) in HTML */
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link'])

/**
 * Build a simple tree from the flat token list.
 */
function buildTree(tokens: Token[]): HtmlNode[] {
  const root: HtmlNode[] = []
  const stack: HtmlElement[] = []

  function current(): HtmlNode[] {
    return stack.length > 0 ? stack[stack.length - 1].children : root
  }

  for (const token of tokens) {
    switch (token.kind) {
      case 'text':
        current().push({ kind: 'text', text: token.text! })
        break

      case 'self-closing':
        current().push({
          kind: 'element',
          tag: token.tag!,
          attrs: token.attrs ?? {},
          children: [],
        })
        break

      case 'open': {
        const el: HtmlElement = {
          kind: 'element',
          tag: token.tag!,
          attrs: token.attrs ?? {},
          children: [],
        }
        current().push(el)
        if (!VOID_TAGS.has(token.tag!)) {
          stack.push(el)
        }
        break
      }

      case 'close': {
        // Pop stack back to the matching open tag (tolerant of mismatches)
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tag === token.tag) {
            stack.splice(i)
            break
          }
        }
        break
      }
    }
  }

  return root
}

// ---------------------------------------------------------------------------
// Convert HTML tree to Lexical nodes
// ---------------------------------------------------------------------------

/** Inline formatting tags mapped to their format bit */
const INLINE_FORMAT_TAGS: Record<string, number> = {
  b: IS_BOLD,
  strong: IS_BOLD,
  i: IS_ITALIC,
  em: IS_ITALIC,
  s: IS_STRIKETHROUGH,
  strike: IS_STRIKETHROUGH,
  del: IS_STRIKETHROUGH,
  u: IS_UNDERLINE,
  code: IS_CODE,
  sub: IS_SUBSCRIPT,
  sup: IS_SUPERSCRIPT,
}

/** Tags that produce block-level Lexical nodes */
const BLOCK_TAGS = new Set([
  'p',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote',
  'ul', 'ol',
  'li',
  'hr',
  'codeblock',
  'div',
])

/**
 * Collect inline content into text nodes, applying the given inherited format.
 * Returns an array of LexicalAnyNode (text, linebreak, link, mention etc.).
 */
function convertInlineNodes(nodes: HtmlNode[], inheritedFormat: number): LexicalAnyNode[] {
  const result: LexicalAnyNode[] = []

  for (const node of nodes) {
    if (node.kind === 'text') {
      const text = unescapeHtml(node.text)
      if (text.length > 0) {
        result.push(textNode(text, inheritedFormat))
      }
      continue
    }

    // Element
    const el = node
    const tag = el.tag

    // Self-closing / void tags
    if (tag === 'br') {
      result.push(linebreakNode())
      continue
    }

    if (tag === 'img') {
      // Inside inline context, treat image as text fallback
      const alt = el.attrs.alt || el.attrs.src || ''
      if (alt) {
        result.push(textNode(unescapeHtml(alt), inheritedFormat))
      }
      continue
    }

    // Links
    if (tag === 'a') {
      const href = el.attrs.href ?? ''
      const linkChildren = convertInlineNodes(el.children, inheritedFormat)
      if (linkChildren.length === 0) {
        linkChildren.push(textNode(href, 0))
      }
      result.push(linkNode(unescapeHtml(href), linkChildren))
      continue
    }

    // Mention (relationship)
    if (tag === 'mention') {
      const dataPayload = el.attrs['data-payload']
      if (dataPayload) {
        try {
          const parsed = JSON.parse(unescapeHtml(dataPayload))
          if (parsed.collection && parsed.id != null) {
            result.push(relationshipNode(parsed.collection, parsed.id))
            continue
          }
        } catch {
          // Fall through to text extraction
        }
      }
      // Fallback: extract text content
      const innerText = extractText(el.children)
      if (innerText) result.push(textNode(innerText, inheritedFormat))
      continue
    }

    // Inline formatting tags
    if (tag in INLINE_FORMAT_TAGS) {
      const formatBit = INLINE_FORMAT_TAGS[tag]
      const innerNodes = convertInlineNodes(el.children, inheritedFormat | formatBit)
      result.push(...innerNodes)
      continue
    }

    // Span or other unknown inline elements -- pass through children
    const innerNodes = convertInlineNodes(el.children, inheritedFormat)
    result.push(...innerNodes)
  }

  return result
}

/**
 * Extract plain text from HTML nodes (for fallback purposes).
 */
function extractText(nodes: HtmlNode[]): string {
  let text = ''
  for (const node of nodes) {
    if (node.kind === 'text') {
      text += unescapeHtml(node.text)
    } else {
      text += extractText(node.children)
    }
  }
  return text
}

/**
 * Determine whether an HTML node is a block-level element.
 */
function isBlockElement(node: HtmlNode): boolean {
  return node.kind === 'element' && BLOCK_TAGS.has(node.tag)
}

/**
 * Convert top-level HTML nodes into Lexical block nodes.
 */
function convertBlockNodes(nodes: HtmlNode[]): LexicalAnyNode[] {
  const result: LexicalAnyNode[] = []

  // Accumulate consecutive inline nodes that aren't wrapped in a block tag
  let pendingInline: HtmlNode[] = []

  function flushInline() {
    if (pendingInline.length === 0) return
    const inlineNodes = convertInlineNodes(pendingInline, 0)
    if (inlineNodes.length > 0) {
      result.push(paragraphNode(inlineNodes))
    }
    pendingInline = []
  }

  for (const node of nodes) {
    if (node.kind === 'text') {
      // Pure whitespace between block elements can be skipped
      if (node.text.trim().length === 0 && pendingInline.length === 0) continue
      pendingInline.push(node)
      continue
    }

    if (!isBlockElement(node)) {
      pendingInline.push(node)
      continue
    }

    // Block element -- flush any pending inline content first
    flushInline()

    const el = node
    const converted = convertSingleBlock(el)
    if (converted) {
      if (Array.isArray(converted)) {
        result.push(...converted)
      } else {
        result.push(converted)
      }
    }
  }

  flushInline()
  return result
}

/**
 * Convert a single block-level HTML element to one or more Lexical nodes.
 */
function convertSingleBlock(el: HtmlElement): LexicalAnyNode | LexicalAnyNode[] | null {
  const tag = el.tag

  // --- Paragraph ---
  if (tag === 'p') {
    const children = convertInlineNodes(el.children, 0)
    return paragraphNode(children.length > 0 ? children : [textNode('', 0)])
  }

  // --- Headings ---
  if (/^h[1-6]$/.test(tag)) {
    const children = convertInlineNodes(el.children, 0)
    return headingNode(
      tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
      children.length > 0 ? children : [textNode('', 0)],
    )
  }

  // --- Blockquote ---
  if (tag === 'blockquote') {
    // enriched wraps blockquote content in <p>, but Lexical quote children
    // are inline, so we unwrap the inner <p> if present
    let innerChildren: LexicalAnyNode[]
    if (
      el.children.length === 1 &&
      el.children[0].kind === 'element' &&
      el.children[0].tag === 'p'
    ) {
      innerChildren = convertInlineNodes(el.children[0].children, 0)
    } else {
      innerChildren = convertInlineNodes(el.children, 0)
    }
    return quoteNode(innerChildren.length > 0 ? innerChildren : [textNode('', 0)])
  }

  // --- Lists ---
  if (tag === 'ul' || tag === 'ol') {
    const isCheckbox = el.attrs['data-type'] === 'checkbox'
    const lt: 'bullet' | 'number' | 'check' = isCheckbox
      ? 'check'
      : tag === 'ol'
        ? 'number'
        : 'bullet'

    const items: LexicalAnyNode[] = []
    let idx = 1
    for (const child of el.children) {
      if (child.kind === 'element' && child.tag === 'li') {
        items.push(convertListItem(child, idx, lt === 'check'))
        idx++
      } else if (child.kind === 'text' && child.text.trim().length === 0) {
        // Skip whitespace text between <li> tags
      } else {
        // Non-li child in a list -- wrap in a listitem
        const inlineChildren = convertInlineNodes([child], 0)
        if (inlineChildren.length > 0) {
          items.push(listItemNode(inlineChildren, idx))
          idx++
        }
      }
    }

    return listNode(lt, items)
  }

  // --- List item (when encountered outside a list -- shouldn't happen, but be safe) ---
  if (tag === 'li') {
    return convertListItem(el, 1, false)
  }

  // --- Horizontal rule ---
  if (tag === 'hr') {
    return horizontalRuleNode()
  }

  // --- Codeblock (enriched custom tag) ---
  if (tag === 'codeblock') {
    // Lexical doesn't have a native codeblock node. Convert each line to a
    // code-formatted paragraph.
    const text = extractText(el.children)
    const lines = text.split('\n')
    return lines.map((line) => paragraphNode([textNode(line, IS_CODE)], IS_CODE))
  }

  // --- Div / unknown block ---
  if (tag === 'div') {
    // Check if it contains block children
    const hasBlocks = el.children.some(isBlockElement)
    if (hasBlocks) {
      return convertBlockNodes(el.children) as LexicalAnyNode[]
    }
    const children = convertInlineNodes(el.children, 0)
    return paragraphNode(children.length > 0 ? children : [textNode('', 0)])
  }

  return null
}

/**
 * Convert a <li> element to a Lexical listitem node.
 */
function convertListItem(el: HtmlElement, value: number, isCheckList: boolean): LexicalListItemNode {
  const checked = isCheckList ? 'checked' in el.attrs : undefined

  // Check if the li contains nested lists
  const hasNestedList = el.children.some(
    (c) => c.kind === 'element' && (c.tag === 'ul' || c.tag === 'ol'),
  )

  if (hasNestedList) {
    // Mix of inline content and nested lists
    const children: LexicalAnyNode[] = []
    const pendingInline: HtmlNode[] = []

    const flushInline = () => {
      if (pendingInline.length === 0) return
      const inline = convertInlineNodes(pendingInline, 0)
      children.push(...inline)
      pendingInline.length = 0
    }

    for (const child of el.children) {
      if (child.kind === 'element' && (child.tag === 'ul' || child.tag === 'ol')) {
        flushInline()
        const nested = convertSingleBlock(child)
        if (nested) {
          if (Array.isArray(nested)) children.push(...nested)
          else children.push(nested)
        }
      } else {
        pendingInline.push(child)
      }
    }
    flushInline()

    return listItemNode(children, value, checked)
  }

  const children = convertInlineNodes(el.children, 0)
  return listItemNode(
    children.length > 0 ? children : [textNode('', 0)],
    value,
    checked,
  )
}

// ---------------------------------------------------------------------------
// Handle top-level <img> as upload nodes or paragraph fallback
// ---------------------------------------------------------------------------
function convertTopLevelImg(el: HtmlElement): LexicalAnyNode {
  // Without collection context we can't produce a proper upload node.
  // Return a paragraph containing the alt text or a link to the src.
  const src = el.attrs.src ?? ''
  const alt = el.attrs.alt ?? ''

  if (src) {
    return paragraphNode([linkNode(unescapeHtml(src), [textNode(alt || src, 0)])])
  }
  return paragraphNode([textNode(alt || '[image]', 0)])
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert react-native-enriched HTML to a Payload Lexical editor state JSON
 * object.
 *
 * Returns null for empty / null / undefined input.
 */
export function htmlToLexical(html: string): LexicalEditorState | null {
  if (!html || typeof html !== 'string') return null

  const trimmed = html.trim()
  if (trimmed.length === 0) return null

  // Tokenise and build tree
  const tokens = tokenise(trimmed)
  const tree = buildTree(tokens)

  if (tree.length === 0) return null

  // Check for top-level images that should be handled specially
  const processed: HtmlNode[] = []
  for (const node of tree) {
    if (node.kind === 'element' && node.tag === 'img') {
      // Mark for special handling below
      processed.push(node)
    } else {
      processed.push(node)
    }
  }

  // Convert to Lexical block nodes
  const blockNodes: LexicalAnyNode[] = []
  const pendingInline: HtmlNode[] = []

  function flushInline() {
    if (pendingInline.length === 0) return
    const inlineNodes = convertInlineNodes(pendingInline, 0)
    if (inlineNodes.length > 0) {
      blockNodes.push(paragraphNode(inlineNodes))
    }
    pendingInline.length = 0
  }

  for (const node of processed) {
    if (node.kind === 'text') {
      if (node.text.trim().length === 0 && pendingInline.length === 0) continue
      pendingInline.push(node)
      continue
    }

    if (node.kind === 'element' && node.tag === 'img') {
      flushInline()
      blockNodes.push(convertTopLevelImg(node))
      continue
    }

    if (!isBlockElement(node)) {
      pendingInline.push(node)
      continue
    }

    flushInline()

    const converted = convertSingleBlock(node as HtmlElement)
    if (converted) {
      if (Array.isArray(converted)) {
        blockNodes.push(...converted)
      } else {
        blockNodes.push(converted)
      }
    }
  }

  flushInline()

  if (blockNodes.length === 0) return null

  return {
    root: {
      type: 'root',
      children: blockNodes,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}
