/**
 * Kanban board — public types, default palette and pure helpers.
 *
 * The board is injection-friendly: it never imports expo-router and never
 * fetches data. The screen supplies already-filtered docs (local-first via
 * RxDB) plus the move/press callbacks, mirroring the DocumentList renderRow
 * pattern.
 *
 * Runtime constants (DEFAULT_KANBAN_PALETTE, column metrics) and the pure
 * column/format helpers live here too so the kanban module keeps its
 * five-file layout (types / card / column / board / barrel).
 */
import type React from 'react'

// ---------------------------------------------------------------------------
// Public prop contracts
// ---------------------------------------------------------------------------

/** A Payload doc as stored in RxDB / returned by the REST API. */
export type KanbanDoc = Record<string, unknown>

export type KanbanStatusOption = { label: string; value: string }

/** The select field that drives the board's columns. */
export type KanbanStatusField = {
  name: string
  options: KanbanStatusOption[]
  /**
   * Display label for the field — drives the trailing "No <label>" column
   * title. Falls back to a humanised `name`.
   */
  label?: string
}

/** One "Move to <column>" target (ellipsis menu / move sheet). */
export type KanbanMoveTarget = {
  label: string
  /** Option value, or null for the trailing no-status column. */
  value: string | null
  color: string
  /** True for the card's current column (entry renders disabled). */
  disabled?: boolean
}

/** A resolved board column (derived from statusField + columnOrder/colors). */
export type KanbanColumnSpec = {
  /** Option value, or null for the trailing "No <label>" column. */
  value: string | null
  label: string
  /** Hex accent colour (header dot, card accent bar, column tint). */
  color: string
}

export type KanbanBoardProps = {
  /** Already-filtered docs from the screen (local-first — no fetching here). */
  docs: KanbanDoc[]
  /** The select field driving the columns. */
  statusField: KanbanStatusField
  /**
   * Subset/order of option values. Missing options append in their original
   * option order. A trailing "No <label>" column for docs with an empty (or
   * unknown) value is always included.
   */
  columnOrder?: string[]
  /**
   * Hex colour per option value. Defaults to a stable pleasant palette
   * derived from the option's index (DEFAULT_KANBAN_PALETTE).
   */
  columnColors?: Record<string, string>
  /**
   * Option values whose columns are hidden entirely. Docs holding a hidden
   * value are dropped from the board (NOT shunted into the no-status
   * column). Include NO_STATUS_COLUMN_VALUE ('__no_status__') to hide the
   * trailing "No <label>" column too.
   */
  hiddenColumns?: string[]
  /**
   * Field names rendered as label:value rows on cards (same value formatting
   * conventions as DocumentList summary cards). The title and status fields
   * are skipped automatically.
   */
  cardFields?: string[]
  /** Optional display labels for cardFields (fallback: humanised name). */
  fieldLabels?: Record<string, string>
  /** Field used as the card title (getDocumentTitle fallback chain). */
  useAsTitle?: string
  /** Tap on a card (gated while a drag is in flight). */
  onPressCard: (doc: KanbanDoc) => void
  /**
   * Move a card to a column. `toValue` is the option value, or null for the
   * no-status column — the screen patches the select via a local-first
   * mutation. Rejections are swallowed by the board (surface errors in the
   * screen, e.g. via a toast).
   */
  onMoveCard: (doc: KanbanDoc, toValue: string | null) => Promise<void> | void
  /**
   * Optional long-press injection point (e.g. ScrollablePreview peek). Only
   * wired when drag-drop is unavailable — when react-native-reanimated-dnd
   * is installed, long-press starts a drag instead (Apple boards convention).
   * For preview access that must coexist with drag use `onPreviewCard`.
   */
  onLongPressCard?: (doc: KanbanDoc) => void
  /**
   * Optional "Preview" entry in the card's ellipsis menu (rendered above the
   * "Move to <column>" targets). This is the drag-safe preview path: in drag
   * mode long-press belongs to the drag gesture, so screens must NOT wrap
   * cards in native long-press peek triggers — present a JS preview from
   * this callback instead (e.g. BottomSheet + read-only DocumentForm).
   */
  onPreviewCard?: (doc: KanbanDoc) => void
  /**
   * Screen-side wrapper injection around the default card element. NOTE:
   * when drag-drop is active the wrapper renders INSIDE a reanimated-dnd
   * Draggable — keep it pure React Native (no @expo/ui / SwiftUI hosts) and
   * NEVER attach native long-press recognizers (e.g. ScrollablePreview's
   * Trigger): they claim the long-press at the UIKit layer, cancel the
   * in-flight touches and kill the drag activation. Use `onPreviewCard` for
   * preview access instead.
   */
  renderCard?: (doc: KanbanDoc, defaultCard: React.ReactElement) => React.ReactElement
  /** Cards mid-move render dimmed. */
  loadingDocIds?: string[]
}

// ---------------------------------------------------------------------------
// Palette + metrics
// ---------------------------------------------------------------------------

/**
 * Stable pleasant palette — iOS system hues. A column's default colour is
 * `DEFAULT_KANBAN_PALETTE[optionIndex % length]` where optionIndex is the
 * option's position in `statusField.options` (NOT the display order), so
 * colours stay stable when columns are reordered.
 */
export const DEFAULT_KANBAN_PALETTE: readonly string[] = [
  '#0A84FF', // blue
  '#30D158', // green
  '#FF9F0A', // orange
  '#BF5AF2', // purple
  '#FF375F', // pink
  '#64D2FF', // cyan
  '#FFD60A', // yellow
  '#5E5CE6', // indigo
  '#FF6961', // red
  '#66D4CF', // mint
]

/** Accent for the trailing "No <label>" column (iOS systemGray). */
export const NO_STATUS_COLUMN_COLOR = '#8E8E93'

/**
 * Sentinel key for the trailing "No <label>" column in `columnColors` and
 * `hiddenColumns` (the column itself has `value: null`).
 */
export const NO_STATUS_COLUMN_VALUE = '__no_status__'

/** Column width — iPad-first paging feel (snap = width + gap). */
export const KANBAN_COLUMN_WIDTH = 312
export const KANBAN_COLUMN_GAP = 12
/** Inner padding of a column's card list. */
export const KANBAN_COLUMN_PADDING = 8
/** Width of a card (and of the floating drag overlay copy). */
export const KANBAN_CARD_WIDTH = KANBAN_COLUMN_WIDTH - KANBAN_COLUMN_PADDING * 2

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Hex (#rgb/#rrggbb) → rgba() string with the given alpha. */
export const hexToRgba = (hex: string, alpha: number): string => {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('')
  const n = parseInt(h, 16)
  if (Number.isNaN(n) || h.length !== 6) return `rgba(142,142,147,${alpha})`
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgba(${r},${g},${b},${alpha})`
}

/** camelCase / snake_case field name → Title Case label. */
export const humanizeFieldName = (name: string): string =>
  name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/**
 * Format a field value for display on a card — same conventions as the
 * DocumentList summary cards ('—' empties, Yes/No booleans, relationship
 * title/name/email, pretty ISO dates).
 */
export const formatKanbanFieldValue = (val: unknown): string => {
  if (val === null || val === undefined || val === '') return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (Array.isArray(val)) {
    if (val.length === 0) return '—'
    return val.map((v) => formatKanbanFieldValue(v)).join(', ')
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    return String(obj.title ?? obj.name ?? obj.email ?? obj.id ?? JSON.stringify(val))
  }
  const s = String(val)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return formatDate(s)
  return s
}

/**
 * Derive the board's columns: `columnOrder` values first (unknown values
 * dropped), remaining options appended in option order, then the trailing
 * "No <label>" column. Colours come from `columnColors`, falling back to
 * DEFAULT_KANBAN_PALETTE by option index. Values in `hiddenColumns` are
 * excluded entirely (NO_STATUS_COLUMN_VALUE hides the trailing column).
 */
export const buildKanbanColumns = (
  statusField: KanbanStatusField,
  columnOrder?: string[],
  columnColors?: Record<string, string>,
  hiddenColumns?: string[],
): KanbanColumnSpec[] => {
  const options = statusField.options
  const byValue = new Map(options.map((o, i) => [o.value, { option: o, index: i }]))
  const hidden = new Set(hiddenColumns ?? [])

  let orderedValues: string[]
  if (columnOrder && columnOrder.length > 0) {
    const seen = new Set<string>()
    orderedValues = columnOrder.filter((v) => {
      if (!byValue.has(v) || seen.has(v)) return false
      seen.add(v)
      return true
    })
    for (const o of options) {
      if (!seen.has(o.value)) orderedValues.push(o.value)
    }
  } else {
    orderedValues = options.map((o) => o.value)
  }

  const columns: KanbanColumnSpec[] = orderedValues
    .filter((value) => !hidden.has(value))
    .map((value) => {
      const entry = byValue.get(value)!
      return {
        value,
        label: entry.option.label,
        color:
          columnColors?.[value] ??
          DEFAULT_KANBAN_PALETTE[entry.index % DEFAULT_KANBAN_PALETTE.length],
      }
    })

  if (!hidden.has(NO_STATUS_COLUMN_VALUE)) {
    const statusLabel = statusField.label ?? humanizeFieldName(statusField.name)
    columns.push({
      value: null,
      label: `No ${statusLabel}`,
      color: columnColors?.[NO_STATUS_COLUMN_VALUE] ?? NO_STATUS_COLUMN_COLOR,
    })
  }
  return columns
}

/**
 * Resolve which column a doc belongs to: its status value when it matches a
 * known option, otherwise null (the trailing "No <label>" column — also the
 * home for unknown/stale values).
 */
export const getKanbanColumnValue = (
  doc: KanbanDoc,
  statusField: KanbanStatusField,
  optionValues?: Set<string>,
): string | null => {
  const raw = doc[statusField.name]
  const values = optionValues ?? new Set(statusField.options.map((o) => o.value))
  if (typeof raw === 'string' && values.has(raw)) return raw
  return null
}
