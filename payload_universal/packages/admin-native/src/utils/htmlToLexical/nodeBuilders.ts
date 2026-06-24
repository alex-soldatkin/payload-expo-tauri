// ---------------------------------------------------------------------------
// Node constructors
// ---------------------------------------------------------------------------
import type {
  LexicalAnyNode,
  LexicalHeadingNode,
  LexicalHorizontalRuleNode,
  LexicalLinebreakNode,
  LexicalLinkNode,
  LexicalListItemNode,
  LexicalListNode,
  LexicalParagraphNode,
  LexicalQuoteNode,
  LexicalRelationshipNode,
  LexicalTableCellNode,
  LexicalTableNode,
  LexicalTableRowNode,
  LexicalTextNode,
} from './types'

export function textNode(text: string, format: number = 0): LexicalTextNode {
  return { type: 'text', text, format, detail: 0, mode: 'normal', style: '', version: 1 }
}

export function linebreakNode(): LexicalLinebreakNode {
  return { type: 'linebreak', version: 1 }
}

export function paragraphNode(children: LexicalAnyNode[], textFormat: number = 0): LexicalParagraphNode {
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

export function headingNode(
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
  children: LexicalAnyNode[],
): LexicalHeadingNode {
  return { type: 'heading', tag, children, direction: 'ltr', format: '', indent: 0, version: 1 }
}

export function quoteNode(children: LexicalAnyNode[]): LexicalQuoteNode {
  return { type: 'quote', children, direction: 'ltr', format: '', indent: 0, version: 1 }
}

export function listNode(
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

export function listItemNode(
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

export function linkNode(url: string, children: LexicalAnyNode[]): LexicalLinkNode {
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

export function horizontalRuleNode(): LexicalHorizontalRuleNode {
  return { type: 'horizontalrule', version: 1, format: '' }
}

export function relationshipNode(collection: string, id: string | number): LexicalRelationshipNode {
  return {
    type: 'relationship',
    relationTo: collection,
    value: { id },
    format: '',
    version: 1,
  }
}

export function tableNode(children: LexicalAnyNode[]): LexicalTableNode {
  return { type: 'table', children, direction: 'ltr', format: '', indent: 0, version: 1 }
}

export function tableRowNode(children: LexicalAnyNode[]): LexicalTableRowNode {
  return { type: 'tablerow', children, direction: 'ltr', format: '', indent: 0, version: 1 }
}

export function tableCellNode(
  children: LexicalAnyNode[],
  headerState: number = 0,
  colSpan: number = 1,
  rowSpan: number = 1,
  backgroundColor?: string,
): LexicalTableCellNode {
  const node: LexicalTableCellNode = {
    type: 'tablecell',
    headerState,
    colSpan,
    rowSpan,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  }
  if (backgroundColor) node.backgroundColor = backgroundColor
  return node
}
