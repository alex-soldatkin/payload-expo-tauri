// ---------------------------------------------------------------------------
// Convert block-level HTML nodes to Lexical nodes
// ---------------------------------------------------------------------------
import { IS_CODE } from './format'
import { convertInlineNodes, extractText, isBlockElement } from './inline'
import {
  headingNode,
  horizontalRuleNode,
  linkNode,
  listItemNode,
  listNode,
  paragraphNode,
  quoteNode,
  tableNode,
  textNode,
} from './nodeBuilders'
import { convertCellContent, convertTable, convertTableRow, convertTableRows } from './table'
import { unescapeHtml } from './tokenizer'
import type { HtmlElement, HtmlNode, LexicalAnyNode, LexicalListItemNode } from './types'

/**
 * Convert top-level HTML nodes into Lexical block nodes.
 */
export function convertBlockNodes(nodes: HtmlNode[]): LexicalAnyNode[] {
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
export function convertSingleBlock(el: HtmlElement): LexicalAnyNode | LexicalAnyNode[] | null {
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

  // --- Table ---
  if (tag === 'table') {
    return convertTable(el)
  }

  // --- tbody / thead wrappers (if encountered at top-level, extract rows) ---
  if (tag === 'tbody' || tag === 'thead') {
    // Shouldn't normally appear outside a <table>, but handle gracefully
    const rows = convertTableRows(el.children)
    if (rows.length > 0) return tableNode(rows)
    return null
  }

  // --- tr outside table context (shouldn't happen, handle gracefully) ---
  if (tag === 'tr') {
    return convertTableRow(el)
  }

  // --- td / th outside table context (shouldn't happen, wrap in paragraph) ---
  if (tag === 'td' || tag === 'th') {
    const children = convertCellContent(el)
    return paragraphNode(children.length > 0 ? children : [textNode('', 0)])
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
export function convertTopLevelImg(el: HtmlElement): LexicalAnyNode {
  // Without collection context we can't produce a proper upload node.
  // Return a paragraph containing the alt text or a link to the src.
  const src = el.attrs.src ?? ''
  const alt = el.attrs.alt ?? ''

  if (src) {
    return paragraphNode([linkNode(unescapeHtml(src), [textNode(alt || src, 0)])])
  }
  return paragraphNode([textNode(alt || '[image]', 0)])
}
