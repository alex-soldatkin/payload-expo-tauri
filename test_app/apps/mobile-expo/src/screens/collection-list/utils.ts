/**
 * Pure helpers + constants for the collection-list screen.
 *
 * Extracted verbatim from the route file — no behaviour change. Covers:
 *   - persistence key prefixes + defaults (summary fields, sort, table pins)
 *   - shake-to-undo + swipe-action geometry constants
 *   - the Stack.Toolbar runtime capability guard
 *   - kanban client-side sort helpers (mirror DocumentList's internal sort)
 *   - calendar/gantt date-field collection + status-field eligibility
 */
import { Stack } from 'expo-router'
import {
  getFieldLabel,
  type ClientField,
  type ClientSelectField,
  type DocumentListSort,
} from '@payload-universal/admin-native'
import type { DateFieldOption, TablePins } from './types'

export const SUMMARY_FIELDS_KEY_PREFIX = 'card_summary_fields:'
// Same key prefix DocumentList uses internally — the iOS toolbar (controlled)
// and the Android internal sort UI (uncontrolled) share persisted state.
export const SORT_KEY_PREFIX = 'list_sort:'
export const DEFAULT_SORT: DocumentListSort = { field: 'updatedAt', direction: 'desc' }
export const SHAKE_THRESHOLD = 1.5 // acceleration magnitude to trigger undo

// Table-mode pin preferences (sticky header band / frozen title column) —
// both default ON; toggled in the list settings sheet, persisted per slug.
export const TABLE_PINS_KEY_PREFIX = 'table_pins:'
export const DEFAULT_TABLE_PINS: TablePins = { header: true, firstColumn: true }

// Aligns the revealed swipe action with the phone card rendered by
// DocumentList (cardWrap: 16px horizontal gutter + 8px bottom margin;
// card borderRadius 16). Tablet table rows are full-bleed (no insets).
export const PHONE_SWIPE_ACTION_STYLE = { marginRight: 16, marginBottom: 8, borderRadius: 16 } as const

/**
 * Stack.Toolbar is an experimental expo-router API (unstable_headerRightItems
 * → react-native-screens bar button items). Guard at runtime so the screen
 * falls back to the always-available `headerRight` path when the API is
 * missing (older expo-router / dev-client binary) instead of silently
 * rendering NO create/filter/settings affordances. Same pattern as [id].tsx.
 */
export const hasStackToolbar =
  typeof (Stack as { Toolbar?: unknown }).Toolbar === 'function' &&
  Boolean((Stack as { Toolbar?: { Button?: unknown } }).Toolbar?.Button)

// ---------------------------------------------------------------------------
// Kanban helpers — mirror DocumentList's internal client-side sort semantics
// (sortDocs is not exported) so the board shows the same ordering the table
// uses within each column.
// ---------------------------------------------------------------------------

export const EMPTY_DOCS: Record<string, unknown>[] = []

/** Field types whose docs can be rendered as label:value rows on cards. */
export const KANBAN_CARD_FIELD_TYPES = new Set([
  'text', 'email', 'number', 'date', 'select', 'radio', 'checkbox',
  'relationship', 'upload', 'textarea', 'richText', 'point', 'json',
])

export const comparableSortValue = (v: unknown): number | string | null => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (Array.isArray(v)) return comparableSortValue(v[0])
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    return comparableSortValue(obj.title ?? obj.name ?? obj.id ?? null)
  }
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const ts = Date.parse(s)
    if (!Number.isNaN(ts)) return ts
  }
  return s.toLowerCase()
}

export const compareSortValues = (a: unknown, b: unknown): number => {
  const av = comparableSortValue(a)
  const bv = comparableSortValue(b)
  if (av == null && bv == null) return 0
  if (av == null) return -1
  if (bv == null) return 1
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
}

// ---------------------------------------------------------------------------
// Calendar helpers — date fields offered as calendar sources. Names are
// dot-paths (the server view-presets convention, e.g.
// 'scheduling.scheduledPublish'); group/tab/row/collapsible containers are
// walked, array/blocks rows are skipped (per-row dates aren't calendar-usable).
// ---------------------------------------------------------------------------

export const collectDateFieldOptions = (
  fields: ClientField[],
  prefix = '',
  labelPrefix = '',
): DateFieldOption[] => {
  const out: DateFieldOption[] = []
  for (const f of fields) {
    if (f.admin?.hidden) continue
    if (f.type === 'date' && f.name) {
      out.push({ name: prefix + f.name, label: labelPrefix + getFieldLabel(f), type: 'date' })
      continue
    }
    if (f.type === 'group') {
      const sub = (f as { fields?: ClientField[] }).fields ?? []
      // Named groups nest the data path; unnamed groups are presentational
      if (f.name) {
        out.push(
          ...collectDateFieldOptions(sub, `${prefix}${f.name}.`, `${labelPrefix}${getFieldLabel(f)} › `),
        )
      } else {
        out.push(...collectDateFieldOptions(sub, prefix, labelPrefix))
      }
      continue
    }
    if (f.type === 'row' || f.type === 'collapsible') {
      const sub = (f as { fields?: ClientField[] }).fields ?? []
      out.push(...collectDateFieldOptions(sub, prefix, labelPrefix))
      continue
    }
    if (f.type === 'tabs') {
      const tabs =
        (f as { tabs?: Array<{ name?: string; fields?: ClientField[] }> }).tabs ?? []
      for (const tab of tabs) {
        out.push(
          ...collectDateFieldOptions(
            tab.fields ?? [],
            tab.name ? `${prefix}${tab.name}.` : prefix,
            labelPrefix,
          ),
        )
      }
    }
  }
  return out
}

/** Eligible kanban status fields: plain selects (hasMany false) and radios. */
export const isEligibleStatusField = (f: ClientField): boolean => {
  if (!f.name || f.admin?.hidden) return false
  if (f.type === 'select') {
    const sel = f as ClientSelectField
    return !sel.hasMany && Array.isArray(sel.options) && sel.options.length > 0
  }
  if (f.type === 'radio') {
    const rad = f as { options?: unknown[] }
    return Array.isArray(rad.options) && rad.options.length > 0
  }
  return false
}
