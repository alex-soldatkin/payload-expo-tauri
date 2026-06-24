// ---------------------------------------------------------------------------
// Client-side `where` evaluation — for local-first (RxDB) doc arrays
// ---------------------------------------------------------------------------
import { getByPath } from '../../utils/schemaHelpers'

import type { WhereClause } from './types'

/** Unwrap populated relationship values ({ id, ... } → id). */
const normalizeId = (v: unknown): unknown => {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'id' in (v as Record<string, unknown>)) {
    return (v as Record<string, unknown>).id
  }
  return v
}

const looseEquals = (docValue: unknown, condValue: unknown): boolean => {
  // hasMany values — match when any element equals
  if (Array.isArray(docValue)) {
    return docValue.some((el) => looseEquals(el, condValue))
  }
  const a = normalizeId(docValue)
  if (a == null) return condValue == null || condValue === ''
  if (typeof a === 'boolean' || condValue === true || condValue === false || condValue === 'true' || condValue === 'false') {
    const toBool = (v: unknown) => v === true || v === 'true'
    return toBool(a) === toBool(condValue)
  }
  return String(a) === String(condValue)
}

/** Coerce to a comparable primitive (numbers / date timestamps / lowercase strings). */
const toComparable = (v: unknown): number | string | null => {
  const raw = normalizeId(v)
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return raw
  if (typeof raw === 'boolean') return raw ? 1 : 0
  if (raw instanceof Date) return raw.getTime()
  const s = String(raw)
  if (/^-?\d+(\.\d+)?$/.test(s.trim())) return Number(s)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = Date.parse(s)
    if (!Number.isNaN(t)) return t
  }
  return s.toLowerCase()
}

const compareOrdered = (docValue: unknown, condValue: unknown): number | null => {
  const a = toComparable(docValue)
  const b = toComparable(condValue)
  if (a == null || b == null) return null
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

/** Payload `like` semantics: every whitespace-separated word matches (case-insensitive). */
const matchesLike = (docValue: unknown, condValue: unknown): boolean => {
  if (docValue == null) return false
  const hay = (Array.isArray(docValue) ? docValue.map(String).join(' ') : String(docValue)).toLowerCase()
  return String(condValue)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word))
}

const evalCondition = (docValue: unknown, operator: string, condValue: unknown): boolean => {
  switch (operator) {
    case 'exists': {
      const wantExists = condValue === true || condValue === 'true'
      const exists = docValue !== null && docValue !== undefined && docValue !== ''
      return wantExists ? exists : !exists
    }
    case 'equals':
      return looseEquals(docValue, condValue)
    case 'not_equals':
      return !looseEquals(docValue, condValue)
    case 'contains': {
      if (docValue == null) return false
      const hay = Array.isArray(docValue) ? docValue.map(String).join(' ') : String(docValue)
      return hay.toLowerCase().includes(String(condValue).toLowerCase())
    }
    case 'like':
      return matchesLike(docValue, condValue)
    case 'not_like':
      return !matchesLike(docValue, condValue)
    case 'in':
    case 'not_in': {
      const arr = Array.isArray(condValue)
        ? condValue
        : String(condValue ?? '').split(',').map((s) => s.trim()).filter(Boolean)
      const hit = arr.some((c) => looseEquals(docValue, c))
      return operator === 'in' ? hit : !hit
    }
    case 'greater_than':
    case 'greater_than_equal':
    case 'less_than':
    case 'less_than_equal': {
      const cmp = compareOrdered(docValue, condValue)
      if (cmp == null) return false
      if (operator === 'greater_than') return cmp > 0
      if (operator === 'greater_than_equal') return cmp >= 0
      if (operator === 'less_than') return cmp < 0
      return cmp <= 0
    }
    default:
      // Unknown operator — don't filter the doc out
      return true
  }
}

/**
 * Evaluate a Payload-style `where` object against a single document.
 * Recurses through arbitrarily nested `and` / `or` arrays (the OR-group
 * shape `{ or: [{ and: [...] }] }` and the legacy flat shape both work).
 * Empty `and` / `or` arrays are vacuous — they match everything, matching
 * Payload's treatment of an empty where.
 */
export const matchesWhere = (doc: Record<string, unknown>, where?: WhereClause): boolean => {
  if (!where) return true
  return Object.entries(where).every(([key, val]) => {
    if (key === 'and' && Array.isArray(val)) {
      return (val as WhereClause[]).every((w) => matchesWhere(doc, w))
    }
    if (key === 'or' && Array.isArray(val)) {
      const arr = val as WhereClause[]
      return arr.length === 0 || arr.some((w) => matchesWhere(doc, w))
    }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.entries(val as Record<string, unknown>).every(([op, condValue]) =>
        evalCondition(getByPath(doc, key), op, condValue),
      )
    }
    return true
  })
}

/**
 * Filter a local doc array with the same `where` object sent to the REST API.
 * Used by DocumentList when data comes from RxDB (`localData` prop).
 */
export const applyWhereToDocs = (
  docs: Record<string, unknown>[],
  where?: WhereClause,
): Record<string, unknown>[] => {
  if (!where) return docs
  return docs.filter((doc) => matchesWhere(doc, where))
}
