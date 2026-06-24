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

export interface LexicalTableCellNode extends LexicalElementNodeBase {
  type: 'tablecell'
  headerState: number
  colSpan: number
  rowSpan: number
  backgroundColor?: string
}

export interface LexicalTableRowNode extends LexicalElementNodeBase {
  type: 'tablerow'
}

export interface LexicalTableNode extends LexicalElementNodeBase {
  type: 'table'
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
  | LexicalTableNode
  | LexicalTableRowNode
  | LexicalTableCellNode

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
// HTML tokeniser / tree types
// ---------------------------------------------------------------------------
export interface Token {
  kind: 'open' | 'close' | 'self-closing' | 'text'
  tag?: string
  attrs?: Record<string, string>
  text?: string
}

export interface HtmlElement {
  kind: 'element'
  tag: string
  attrs: Record<string, string>
  children: HtmlNode[]
}

export interface HtmlText {
  kind: 'text'
  text: string
}

export type HtmlNode = HtmlElement | HtmlText
