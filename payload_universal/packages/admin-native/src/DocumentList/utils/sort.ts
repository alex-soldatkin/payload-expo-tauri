/**
 * DocumentList sort helpers — sortable-field extraction, the REST `?sort=`
 * string, and a local doc sorter matching the REST semantics.
 */
import type { ClientField } from '../../types'
import { getByPath } from '../../utils/schemaHelpers'
import { SORTABLE_FIELD_TYPES } from '../types'
import type { DocumentListSort } from '../types'

/**
 * Extract the sortable fields from a collection's root fields.
 * Always includes the built-in createdAt/updatedAt timestamps.
 * Exported so screens can build their own (e.g. native toolbar) sort menus.
 */
export const getSortableFields = (fields: ClientField[]): ClientField[] => {
  const sortable = fields.filter(
    (f) => f.name && !f.admin?.hidden && SORTABLE_FIELD_TYPES.has(f.type),
  )
  const names = new Set(sortable.map((f) => f.name))
  if (!names.has('createdAt')) {
    sortable.push({ name: 'createdAt', type: 'date', label: 'Created At' } as ClientField)
  }
  if (!names.has('updatedAt')) {
    sortable.push({ name: 'updatedAt', type: 'date', label: 'Updated At' } as ClientField)
  }
  return sortable
}

/** Convert a sort spec to the Payload REST `?sort=` string ('-field' for desc). */
export const sortToQueryString = (sort: DocumentListSort): string =>
  sort.direction === 'desc' ? `-${sort.field}` : sort.field

/** Coerce a doc value to something comparable (numbers / timestamps / strings). */
const comparableValue = (v: unknown): number | string | null => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof Date) return v.getTime()
  if (Array.isArray(v)) return comparableValue(v[0])
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    return comparableValue(obj.title ?? obj.name ?? obj.id ?? null)
  }
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const ts = Date.parse(s)
    if (!Number.isNaN(ts)) return ts
  }
  return s.toLowerCase()
}

const compareFieldValues = (a: unknown, b: unknown): number => {
  const av = comparableValue(a)
  const bv = comparableValue(b)
  if (av == null && bv == null) return 0
  if (av == null) return -1
  if (bv == null) return 1
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
}

/** Sort a local doc array with the same semantics as the REST `?sort=` param. */
export const sortDocs = (
  docs: Record<string, unknown>[],
  sort: DocumentListSort,
): Record<string, unknown>[] => {
  const dir = sort.direction === 'desc' ? -1 : 1
  return [...docs].sort(
    (a, b) => dir * compareFieldValues(getByPath(a, sort.field), getByPath(b, sort.field)),
  )
}
