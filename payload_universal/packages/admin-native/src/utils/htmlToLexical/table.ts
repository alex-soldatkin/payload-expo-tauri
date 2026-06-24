// ---------------------------------------------------------------------------
// Table conversion helpers
// ---------------------------------------------------------------------------
import { convertBlockNodes } from './block'
import { convertInlineNodes, isBlockElement } from './inline'
import { paragraphNode, tableCellNode, tableNode, tableRowNode, textNode } from './nodeBuilders'
import type {
  HtmlElement,
  HtmlNode,
  LexicalAnyNode,
  LexicalTableCellNode,
  LexicalTableNode,
  LexicalTableRowNode,
} from './types'

/**
 * Parse a background-color value from a style attribute string.
 */
function parseBgColor(style: string | undefined): string | undefined {
  if (!style) return undefined
  const m = style.match(/background-color:\s*([^;]+)/)
  return m ? m[1].trim() : undefined
}

/**
 * Convert the content of a table cell (<td>/<th>) to Lexical children.
 * Cell children in Lexical are typically paragraphs containing text nodes.
 */
export function convertCellContent(el: HtmlElement): LexicalAnyNode[] {
  // Check if the cell contains block-level elements
  const hasBlocks = el.children.some(isBlockElement)
  if (hasBlocks) {
    return convertBlockNodes(el.children) as LexicalAnyNode[]
  }
  // Inline-only content: wrap in a paragraph
  const inlineChildren = convertInlineNodes(el.children, 0)
  if (inlineChildren.length > 0) {
    return [paragraphNode(inlineChildren)]
  }
  return [paragraphNode([textNode('', 0)])]
}

/**
 * Convert a <td> or <th> element to a Lexical tablecell node.
 */
function convertTableCell(el: HtmlElement): LexicalTableCellNode {
  const isHeader = el.tag === 'th'
  // headerState: 1 = row header, 2 = column header; use 1 for <th> by default
  const headerState = isHeader ? 1 : 0
  const colSpan = el.attrs.colspan ? parseInt(el.attrs.colspan, 10) || 1 : 1
  const rowSpan = el.attrs.rowspan ? parseInt(el.attrs.rowspan, 10) || 1 : 1
  const backgroundColor = parseBgColor(el.attrs.style)
  const children = convertCellContent(el)
  return tableCellNode(children, headerState, colSpan, rowSpan, backgroundColor)
}

/**
 * Convert a <tr> element to a Lexical tablerow node.
 */
export function convertTableRow(el: HtmlElement): LexicalTableRowNode {
  const cells: LexicalAnyNode[] = []
  for (const child of el.children) {
    if (child.kind === 'element' && (child.tag === 'td' || child.tag === 'th')) {
      cells.push(convertTableCell(child))
    } else if (child.kind === 'text' && child.text.trim().length === 0) {
      // Skip whitespace between cells
    }
  }
  return tableRowNode(cells)
}

/**
 * Extract <tr> elements from children, skipping <tbody>/<thead> wrappers.
 */
export function convertTableRows(children: HtmlNode[]): LexicalAnyNode[] {
  const rows: LexicalAnyNode[] = []
  for (const child of children) {
    if (child.kind === 'text' && child.text.trim().length === 0) continue
    if (child.kind !== 'element') continue

    if (child.tag === 'tr') {
      rows.push(convertTableRow(child))
    } else if (child.tag === 'tbody' || child.tag === 'thead') {
      // Unwrap -- recurse into the wrapper to find <tr> children
      rows.push(...convertTableRows(child.children))
    }
  }
  return rows
}

/**
 * Convert a <table> element to a Lexical table node.
 */
export function convertTable(el: HtmlElement): LexicalTableNode {
  const rows = convertTableRows(el.children)
  return tableNode(rows)
}
