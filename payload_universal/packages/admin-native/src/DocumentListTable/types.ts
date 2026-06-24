/**
 * DocumentListTable — column model + layout constants (tablet table mode).
 * See ./index.tsx for the structure decision rationale.
 */

// ---------------------------------------------------------------------------
// Column model
// ---------------------------------------------------------------------------

export type DocumentListTableColumn = {
  field: string
  label: string
  type: string
  width: number
  sortable: boolean
}

export type TableSort = { field: string; direction: 'asc' | 'desc' }

/** Pinned title column: 16pt leading inset + ~160pt of content. */
export const TABLE_TITLE_COLUMN_WIDTH = 176

export const HEADER_HEIGHT = 38

/**
 * Row vertical rhythm — content drives the height between a fixed floor
 * (single-line rows) and a hard cap (the two-line long-text case). The cap
 * is load-bearing, not cosmetic: rows live inside screen-level wrappers
 * (SwipeToDeleteRow, the native preview trigger) and the previous unbounded
 * row (with a `height: '100%'` track) let a stray tall measurement from the
 * wrapper chain inflate a row to viewport scale, centering one line of text
 * in a ~1000pt void. With min/max bounds the row can never exceed two-line
 * height regardless of what an ancestor hands down. The enclosing FlatList
 * uses no getItemLayout, so the 52–76pt dynamic heights are self-measured.
 */
export const TABLE_ROW_MIN_HEIGHT = 52
export const TABLE_ROW_MAX_HEIGHT = 76

/**
 * Type-aware fixed column widths (pt) — columns NEVER flex-squeeze; total
 * content width grows beyond the screen and scrolls horizontally instead.
 */
export const TYPE_COLUMN_WIDTHS: Record<string, number> = {
  text: 160,
  textarea: 160,
  code: 160,
  richText: 160,
  json: 160,
  relationship: 160,
  upload: 160,
  join: 160,
  email: 180,
  date: 130,
  select: 130,
  radio: 130,
  point: 130,
  number: 100,
  checkbox: 90,
}
export const MIN_COLUMN_WIDTH = 80
export const MAX_COLUMN_WIDTH = 240
