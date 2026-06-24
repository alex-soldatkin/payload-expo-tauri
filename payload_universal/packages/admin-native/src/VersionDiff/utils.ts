import type { ClientField } from '../types'
import { getFieldLabel } from '../utils/schemaHelpers'
import {
  deepEqual,
  extractLexicalText,
  getRelationLabel,
  prettyJson,
} from '../utils/diff'
import type { DiffEntry, RowPair, RowRecord } from './types'

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

export const TEXTISH_TYPES = new Set(['text', 'textarea', 'email', 'code', 'json'])
export const MONO_TYPES = new Set(['code', 'json'])

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)

export const isEmptyValue = (v: unknown): boolean => {
  if (v == null) return true
  if (typeof v === 'string') return v.length === 0
  if (Array.isArray(v)) return v.length === 0
  return false
}

const truncate = (s: string, max: number): string =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s

const safeStringify = (value: unknown, space?: number): string => {
  try {
    return JSON.stringify(value, null, space) ?? ''
  } catch {
    return String(value)
  }
}

const resolveLabelString = (
  label: string | Record<string, string> | undefined,
  fallback: string,
): string => {
  if (!label) return fallback
  if (typeof label === 'string') return label
  return label.en || Object.values(label)[0] || fallback
}

/** Stringify a text-ish field value for word-diffing. */
export const textishValue = (field: ClientField, value: unknown): string => {
  if (value == null) return ''
  if (field.type === 'json') return prettyJson(value)
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ')
  return String(value)
}

export const isPrimitiveArray = (v: unknown): v is Array<string | number | boolean | null> =>
  Array.isArray(v) && v.every((x) => x == null || typeof x !== 'object')

/** Format a scalar (or fallback complex) value for the old/new boxes. */
export const formatScalar = (value: unknown, fieldType?: string): string => {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    if (fieldType === 'date') {
      const time = Date.parse(value)
      if (!Number.isNaN(time)) return new Date(time).toLocaleString()
    }
    return value
  }
  // hasMany select/radio etc. — join rather than dump JSON
  if (isPrimitiveArray(value)) {
    return value.length > 0 ? value.map((v) => String(v ?? '—')).join(', ') : '—'
  }
  return safeStringify(value, 2)
}

/** One-line summary used inside added/removed row cards. */
export const compactValue = (field: ClientField, value: unknown): string => {
  if (value == null) return '—'
  switch (field.type) {
    case 'richText': {
      const text = extractLexicalText(value)
      return text.length > 0 ? truncate(text.replace(/\n+/g, ' · '), 160) : '—'
    }
    case 'relationship':
    case 'upload':
      return getRelationLabel(value) || '—'
    case 'array':
      return Array.isArray(value) ? `${value.length} row${value.length === 1 ? '' : 's'}` : '—'
    case 'blocks':
      return Array.isArray(value) ? `${value.length} block${value.length === 1 ? '' : 's'}` : '—'
    case 'json':
      return truncate(safeStringify(value), 160)
    case 'date':
      return formatScalar(value, 'date')
    default:
      break
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) {
    return value
      .map((v) => (isRecord(v) ? getRelationLabel(v) || safeStringify(v) : String(v)))
      .join(', ')
  }
  if (typeof value === 'object') return truncate(safeStringify(value), 160)
  return String(value)
}

/** Full value rendering for the expanded "Unchanged" row. */
export const formatExpandedValue = (field: ClientField, value: unknown): string => {
  if (value == null) return '—'
  switch (field.type) {
    case 'richText':
      return extractLexicalText(value) || '—'
    case 'relationship':
    case 'upload':
      return getRelationLabel(value) || '—'
    case 'json':
      return prettyJson(value) || '—'
    case 'array':
    case 'blocks':
      return compactValue(field, value)
    default:
      return formatScalar(value, field.type)
  }
}

/**
 * Detect a per-locale value map ({ en: …, de: … }) on a localized field.
 * Naturally-object value shapes (richText root, populated relationships,
 * groups, json, point) are excluded so they aren't misread as locale maps.
 */
export const isLocaleMap = (field: ClientField, value: unknown): boolean => {
  if (!field.localized || !isRecord(value)) return false
  switch (field.type) {
    case 'richText':
      return !('root' in value)
    case 'relationship':
    case 'upload':
      return !('id' in value) && !('relationTo' in value) && !('value' in value)
    case 'group':
    case 'json':
    case 'point':
      return false
    default:
      return true
  }
}

// ---------------------------------------------------------------------------
// Field tree walker
// ---------------------------------------------------------------------------

export const collectDiffs = (
  fields: ClientField[],
  from: Record<string, unknown>,
  to: Record<string, unknown>,
  pathPrefix = '',
  labelPrefix = '',
): DiffEntry[] => {
  const entries: DiffEntry[] = []

  for (const field of fields) {
    const name = field.name
    const type = field.type

    // Virtual / presentational fields carry no version data
    if (type === 'ui' || type === 'join') continue

    const subFields = (field as { fields?: ClientField[] }).fields

    // Structural fields without their own name — traverse sub-fields
    if (!name && (type === 'row' || type === 'collapsible') && subFields) {
      entries.push(...collectDiffs(subFields, from, to, pathPrefix, labelPrefix))
      continue
    }
    if (!name && type === 'tabs' && (field as { tabs?: unknown[] }).tabs) {
      const tabs = (field as { tabs?: Array<{ name?: string; label?: string | Record<string, string>; fields?: ClientField[] }> }).tabs ?? []
      for (const tab of tabs) {
        if (!tab.fields) continue
        if (tab.name) {
          // Named tab — data is nested under tab.name
          const tabFrom = isRecord(from[tab.name]) ? (from[tab.name] as Record<string, unknown>) : {}
          const tabTo = isRecord(to[tab.name]) ? (to[tab.name] as Record<string, unknown>) : {}
          const tabLabel = resolveLabelString(tab.label, tab.name)
          entries.push(...collectDiffs(
            tab.fields,
            tabFrom,
            tabTo,
            pathPrefix ? `${pathPrefix}.${tab.name}` : tab.name,
            `${labelPrefix}${tabLabel} › `,
          ))
        } else {
          // Unnamed tab — data lives at the parent level
          entries.push(...collectDiffs(tab.fields, from, to, pathPrefix, labelPrefix))
        }
      }
      continue
    }

    if (!name) continue

    const path = pathPrefix ? `${pathPrefix}.${name}` : name
    const valueFrom = from[name]
    const valueTo = to[name]
    const label = getFieldLabel(field, name)

    // Group fields — recurse with a label prefix ("Meta › Title")
    if (type === 'group' && subFields) {
      const groupFrom = isRecord(valueFrom) ? valueFrom : {}
      const groupTo = isRecord(valueTo) ? valueTo : {}
      entries.push(...collectDiffs(subFields, groupFrom, groupTo, path, `${labelPrefix}${label} › `))
      continue
    }

    entries.push({
      path,
      label: `${labelPrefix}${label}`,
      field,
      valueFrom,
      valueTo,
      changed: !deepEqual(valueFrom, valueTo),
    })
  }

  return entries
}

// ---------------------------------------------------------------------------
// Array / blocks per-row pairing
// ---------------------------------------------------------------------------

const rowId = (row: RowRecord): string | null => {
  const id = row.id
  if (typeof id === 'string' && id.length > 0) return id
  if (typeof id === 'number') return String(id)
  return null
}

/** Pair up rows by `id` when every row has one, else by index. */
export const pairRows = (fromRows: RowRecord[], toRows: RowRecord[]): RowPair[] => {
  const pairs: RowPair[] = []
  const useIds =
    fromRows.length > 0 &&
    toRows.length > 0 &&
    fromRows.every((r) => rowId(r) !== null) &&
    toRows.every((r) => rowId(r) !== null)

  if (useIds) {
    const fromById = new Map<string, RowRecord>()
    for (const row of fromRows) fromById.set(rowId(row) as string, row)
    const toIds = new Set(toRows.map((r) => rowId(r) as string))

    toRows.forEach((row, i) => {
      const id = rowId(row) as string
      const match = fromById.get(id)
      if (!match) {
        pairs.push({ key: id, status: 'added', to: row, num: i + 1 })
      } else {
        pairs.push({
          key: id,
          status: deepEqual(match, row) ? 'same' : 'changed',
          from: match,
          to: row,
          num: i + 1,
        })
      }
    })
    fromRows.forEach((row, i) => {
      const id = rowId(row) as string
      if (!toIds.has(id)) pairs.push({ key: id, status: 'removed', from: row, num: i + 1 })
    })
  } else {
    const max = Math.max(fromRows.length, toRows.length)
    for (let i = 0; i < max; i++) {
      const from = fromRows[i]
      const to = toRows[i]
      if (from && to) {
        pairs.push({
          key: String(i),
          status: deepEqual(from, to) ? 'same' : 'changed',
          from,
          to,
          num: i + 1,
        })
      } else if (to) {
        pairs.push({ key: String(i), status: 'added', to, num: i + 1 })
      } else if (from) {
        pairs.push({ key: String(i), status: 'removed', from, num: i + 1 })
      }
    }
  }
  return pairs
}
