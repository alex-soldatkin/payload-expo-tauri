// ---------------------------------------------------------------------------
// Lexical table types
// ---------------------------------------------------------------------------

export type TextNode = {
  type: 'text'
  text: string
  format: 0
  detail: 0
  mode: 'normal'
  style: ''
  version: 1
}

export type ParagraphNode = {
  type: 'paragraph'
  children: TextNode[]
  direction: 'ltr'
  format: '' | number
  indent: 0
  version: 1
}

export type TableCellNode = {
  type: 'tablecell'
  headerState: number
  children: ParagraphNode[]
  direction: 'ltr'
  format: '' | number
  indent: 0
  version: 1
  colSpan?: number
  rowSpan?: number
  width?: number
  backgroundColor?: string | null
}

export type TableRowNode = {
  type: 'tablerow'
  children: TableCellNode[]
  direction: 'ltr'
  format: '' | number
  indent: 0
  version: 1
  height?: number
}

export type TableNode = {
  type: 'table'
  children: TableRowNode[]
  direction: 'ltr'
  format: '' | number
  indent: 0
  version: 1
}

export type TableEditorProps = {
  /** The Lexical table node data */
  data: TableNode
  /** Called when table data changes */
  onChange: (data: TableNode) => void
  /** Whether editing is disabled */
  disabled?: boolean
}
