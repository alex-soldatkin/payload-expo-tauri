// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

import type { ParagraphNode, TableCellNode, TableNode, TableRowNode, TextNode } from './types'

/** Create a single text node. */
const makeTextNode = (text: string): TextNode => ({
  type: 'text',
  text,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

/** Create a paragraph node wrapping a single text node. */
const makeParagraphNode = (text: string): ParagraphNode => ({
  type: 'paragraph',
  children: text ? [makeTextNode(text)] : [],
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

/** Create an empty cell. */
const makeCell = (headerState = 0): TableCellNode => ({
  type: 'tablecell',
  headerState,
  children: [makeParagraphNode('')],
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  colSpan: 1,
  rowSpan: 1,
})

/** Create a table row with `cols` empty cells. */
const makeRow = (cols: number, headerState = 0): TableRowNode => ({
  type: 'tablerow',
  children: Array.from({ length: cols }, () => makeCell(headerState)),
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

/** Create a new table with empty cells. */
export const createEmptyTable = (rows: number, cols: number): TableNode => ({
  type: 'table',
  children: Array.from({ length: rows }, () => makeRow(cols)),
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

/** Extract plain text from a cell's paragraph children. */
export const getCellText = (cell: TableCellNode): string =>
  (cell.children ?? [])
    .flatMap((p) => (p.children ?? []).map((t) => t.text))
    .join('')

/** Return a new cell with its text replaced. */
export const setCellText = (cell: TableCellNode, text: string): TableCellNode => ({
  ...cell,
  children: [makeParagraphNode(text)],
})

/** Add a row at the bottom of the table. */
export const addRow = (table: TableNode): TableNode => {
  const cols = table.children[0]?.children.length ?? 1
  return {
    ...table,
    children: [...table.children, makeRow(cols)],
  }
}

/** Add a column at the right edge of the table. */
export const addColumn = (table: TableNode): TableNode => {
  const isHeaderRow = (rowIdx: number) =>
    table.children[rowIdx]?.children[0]?.headerState === 1

  return {
    ...table,
    children: table.children.map((row, ri) => ({
      ...row,
      children: [
        ...row.children,
        makeCell(isHeaderRow(ri) ? 1 : 0),
      ],
    })),
  }
}

/** Remove a row by index. Returns unchanged table if only one row remains. */
export const removeRow = (table: TableNode, index: number): TableNode => {
  if (table.children.length <= 1) return table
  return {
    ...table,
    children: table.children.filter((_, i) => i !== index),
  }
}

/** Remove a column by index. Returns unchanged table if only one column remains. */
export const removeColumn = (table: TableNode, index: number): TableNode => {
  const cols = table.children[0]?.children.length ?? 0
  if (cols <= 1) return table
  return {
    ...table,
    children: table.children.map((row) => ({
      ...row,
      children: row.children.filter((_, i) => i !== index),
    })),
  }
}

/** Toggle the first row between header (headerState=1) and normal (headerState=0). */
export const toggleHeaderRow = (table: TableNode): TableNode => {
  if (table.children.length === 0) return table
  const firstRow = table.children[0]
  const isHeader = firstRow.children[0]?.headerState === 1
  const newState = isHeader ? 0 : 1

  return {
    ...table,
    children: [
      {
        ...firstRow,
        children: firstRow.children.map((cell) => ({
          ...cell,
          headerState: newState,
        })),
      },
      ...table.children.slice(1),
    ],
  }
}
