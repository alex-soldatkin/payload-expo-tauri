/**
 * DocumentListTable — pure cell/column helpers.
 *
 * Cell content rules: every value renders ellipsized, never a raw dump.
 */
import type { DocumentListTableColumn } from './types'
import { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, TYPE_COLUMN_WIDTHS } from './types'

export const getTableColumnWidth = (type: string): number =>
  Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, TYPE_COLUMN_WIDTHS[type] ?? 160))

// ---------------------------------------------------------------------------
// Cell content rules — every value renders ellipsized, never a raw dump
// ---------------------------------------------------------------------------

/**
 * Long-text field types may wrap to two lines (excerpt + ellipsis); every
 * other type renders a single ellipsized line.
 */
const LONG_TEXT_CELL_TYPES = new Set(['textarea', 'richText', 'json', 'code'])

export const getCellLineLimit = (type: string): 1 | 2 =>
  LONG_TEXT_CELL_TYPES.has(type) ? 2 : 1

/**
 * Cap cell strings well past two lines of glyphs — Text measurement cost
 * scales with string length and a cell never shows more than this.
 */
const CELL_EXCERPT_MAX = 160

const collapseWhitespace = (s: string): string => s.replace(/\s+/g, ' ').trim()

const excerpt = (s: string): string => {
  const flat = collapseWhitespace(s)
  return flat.length > CELL_EXCERPT_MAX ? `${flat.slice(0, CELL_EXCERPT_MAX - 1)}…` : flat
}

/**
 * Walk a Payload rich-text value (Lexical `{ root: { children } }` or Slate
 * node arrays) collecting plain text. Bounded — stops once enough text for
 * a two-line excerpt has been gathered.
 */
export const extractRichTextPlainText = (value: unknown): string => {
  const parts: string[] = []
  let length = 0
  const walk = (node: unknown): void => {
    if (length > CELL_EXCERPT_MAX || node == null) return
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    if (typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    if (typeof obj.text === 'string' && obj.text.length > 0) {
      parts.push(obj.text)
      length += obj.text.length + 1
    }
    if (obj.root != null) walk(obj.root)
    if (Array.isArray(obj.children)) walk(obj.children)
  }
  walk(value)
  return excerpt(parts.join(' '))
}

const TITLEISH_KEYS = ['title', 'name', 'label', 'filename', 'email'] as const

/**
 * Title-ish display string for a populated relationship/upload object —
 * mirrors getDocumentTitle's key priority, falling back to the id. Returns
 * null when nothing displayable exists (callers show an em dash).
 */
export const titleishFromObject = (obj: Record<string, unknown>): string | null => {
  for (const key of TITLEISH_KEYS) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim().length > 0) return v
    if (typeof v === 'number') return String(v)
  }
  return obj.id != null ? String(obj.id) : null
}

/**
 * Compact summary for an array value (array/blocks fields, hasMany
 * relationships/selects): scalar items join inline, object items render as
 * an item count — NEVER a raw JSON dump.
 */
export const summariseArrayValue = (arr: unknown[]): string => {
  if (arr.length === 0) return '—'
  if (arr.every((v) => typeof v !== 'object' || v === null)) {
    return excerpt(arr.map((v) => String(v)).join(', '))
  }
  return arr.length === 1 ? '1 item' : `${arr.length} items`
}

/**
 * Type-aware cell formatter. `formatScalar` is DocumentList's existing
 * value formatter (date strings, booleans) — this layer adds the
 * field-type rules on top:
 *  - richText → plain-text excerpt (Lexical/Slate walk), never the node tree
 *  - json/code/textarea → whitespace-collapsed excerpt
 *  - point → "lng, lat"
 *  - arrays (array/blocks/hasMany) → compact summary ("3 items" / joined scalars)
 *  - populated relationship/upload objects → title-ish extraction
 */
export const formatTableCellValue = (
  value: unknown,
  type: string,
  formatScalar: (v: unknown) => string,
): string => {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) {
    if (type === 'point') return excerpt(value.map((v) => String(v)).join(', '))
    return summariseArrayValue(value)
  }
  if (type === 'richText') {
    if (typeof value === 'string') return excerpt(value)
    const text = extractRichTextPlainText(value)
    return text.length > 0 ? text : '—'
  }
  if (type === 'json') {
    if (typeof value === 'string') return excerpt(value)
    try {
      return excerpt(JSON.stringify(value))
    } catch {
      return '—'
    }
  }
  if (typeof value === 'object') {
    const title = titleishFromObject(value as Record<string, unknown>)
    return title != null ? excerpt(title) : '—'
  }
  return excerpt(formatScalar(value))
}

/** "updatedAt" → "Updated At" (fallback when the schema has no label). */
const humaniseFieldName = (field: string): string =>
  field
    .replace(/^_/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()

/**
 * Build the scrolling column set from the summary-fields picker selection.
 * Order is the picker's drag order; the title field and (with drafts) the
 * `_status` field are excluded — they render inside the pinned title cell.
 * A trailing built-in "Updated" column mirrors the web admin default.
 */
export const buildTableColumns = (args: {
  summaryFields: string[]
  titleField?: string
  hasDrafts: boolean
  fieldLabelMap: Map<string, string>
  fieldTypeMap: Map<string, string>
  sortableFieldNames: Set<string>
}): DocumentListTableColumn[] => {
  const { summaryFields, titleField, hasDrafts, fieldLabelMap, fieldTypeMap, sortableFieldNames } =
    args
  const columns: DocumentListTableColumn[] = summaryFields
    .filter((f) => f !== titleField && !(hasDrafts && f === '_status'))
    .map((field) => {
      const type =
        fieldTypeMap.get(field) ??
        (field === 'createdAt' || field === 'updatedAt' ? 'date' : 'text')
      return {
        field,
        label: fieldLabelMap.get(field) ?? humaniseFieldName(field),
        type,
        width: getTableColumnWidth(type),
        sortable: sortableFieldNames.has(field),
      }
    })
  if (!columns.some((c) => c.field === 'updatedAt')) {
    columns.push({
      field: 'updatedAt',
      label: 'Updated',
      type: 'date',
      width: getTableColumnWidth('date'),
      sortable: true,
    })
  }
  return columns
}
