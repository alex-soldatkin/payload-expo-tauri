// Filter-group → RxDB Mango selector translation (issue #20 remainder).
//
// The desktop list hook (`useLocalCollection`) feeds this selector to RxDB,
// whose SQLite storage converts Mango operators to SQL via mango-to-sql.ts.
// Supported there: $eq $ne $gt $gte $lt $lte $in $nin $exists $and $or.
//
//   equals        → $eq
//   not_equals    → $ne
//   greater_than  → $gt
//   less_than     → $lt
//   in            → $in   (comma-split string → array of trimmed non-empty)
//   exists        → $exists (true/false)
//
// `contains` maps to $regex in Mango, which mango-to-sql.ts lists in JS_ONLY_OPS
// and CANNOT translate to SQL. Rather than rely on that JS post-filter (which
// only runs inside the RxDB storage adapter and is not wired through the desktop
// hook), we EXCLUDE `contains` rules from the pushed-down selector entirely and
// return them separately so DocumentList can apply them client-side to the
// returned page docs. This is the same local-first strategy the mobile client
// uses (applyWhereToDocs). Trade-off: a `contains`-only group filters just the
// current page, not the full server result — acceptable for v1.
//
// Composition (mirrors mobile `filtersToWhere`):
//   0 groups            → undefined
//   1 group             → { $and: [ ...conds ] }
//   n groups            → { $or: [ { $and: [...] }, ... ] }
//
// NOTE: the current desktop hook (packages/local-db hooks.ts) only forwards a
// FLAT selector and drops top-level $and/$or, so multi-group OR pushdown is a
// no-op there today. The client-side predicate below (`matchesGroups`) is the
// source of truth for the visible page in every case, guaranteeing correctness
// regardless of how much the hook manages to push to SQL.

import type { FilterGroups, FilterOp, FilterRule } from './types'

const MANGO_OP: Partial<Record<FilterOp, string>> = {
  equals: '$eq',
  not_equals: '$ne',
  greater_than: '$gt',
  less_than: '$lt',
  in: '$in',
  exists: '$exists',
}

/** Split a comma-separated `in` value into trimmed, non-empty tokens. */
export function splitInValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function ruleToMango(rule: FilterRule): Record<string, unknown> | null {
  const mango = MANGO_OP[rule.op]
  if (!mango) return null // `contains` (handled client-side) or unknown
  if (rule.op === 'in') {
    return { [rule.field]: { $in: splitInValue(rule.value) } }
  }
  if (rule.op === 'exists') {
    return { [rule.field]: { $exists: rule.value === true || rule.value === 'true' } }
  }
  return { [rule.field]: { [mango]: rule.value } }
}

export type BuiltSelector = {
  /** Mango selector for pushdown (contains rules excluded), or undefined. */
  selector: Record<string, unknown> | undefined
  /** `contains` rules that must be applied client-side, grouped as given. */
  containsGroups: FilterGroups
  /** True when any group carries a `contains` rule. */
  hasContains: boolean
}

/** Build the pushdown selector + the client-side `contains` residue. */
export function buildSelector(groups: FilterGroups): BuiltSelector {
  const andGroups: Record<string, unknown>[] = []
  const containsGroups: FilterGroups = []
  let hasContains = false

  for (const group of groups) {
    const conds: Record<string, unknown>[] = []
    const groupContains: FilterRule[] = []
    for (const rule of group) {
      if (rule.op === 'contains') {
        groupContains.push(rule)
        hasContains = true
        continue
      }
      const mango = ruleToMango(rule)
      if (mango) conds.push(mango)
    }
    containsGroups.push(groupContains)
    if (conds.length > 0) andGroups.push({ $and: conds })
  }

  let selector: Record<string, unknown> | undefined
  if (andGroups.length === 1) {
    selector = andGroups[0]
  } else if (andGroups.length > 1) {
    selector = { $or: andGroups }
  }

  return { selector, containsGroups, hasContains }
}

// --------------------------------------------------------------------------
// Client-side predicate — evaluates the FULL group model against a doc.
// Used by DocumentList to correct the visible page (parity with mobile's
// applyWhereToDocs / matchesWhere). Handles every op, incl. `contains`.
// --------------------------------------------------------------------------

function getValue(doc: Record<string, unknown>, field: string): unknown {
  return doc[field]
}

function toComparable(v: unknown): number | string | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  const s = String(v)
  if (/^-?\d+(\.\d+)?$/.test(s.trim())) return Number(s)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = Date.parse(s)
    if (!Number.isNaN(t)) return t
  }
  return s.toLowerCase()
}

function looseEquals(docValue: unknown, condValue: unknown): boolean {
  if (Array.isArray(docValue)) return docValue.some((el) => looseEquals(el, condValue))
  if (docValue == null) return condValue == null || condValue === ''
  const bools = [true, false, 'true', 'false']
  if (typeof docValue === 'boolean' || bools.includes(condValue as never)) {
    const toBool = (x: unknown) => x === true || x === 'true'
    return toBool(docValue) === toBool(condValue)
  }
  return String(docValue) === String(condValue)
}

function evalRule(doc: Record<string, unknown>, rule: FilterRule): boolean {
  const docValue = getValue(doc, rule.field)
  switch (rule.op) {
    case 'equals':
      return looseEquals(docValue, rule.value)
    case 'not_equals':
      return !looseEquals(docValue, rule.value)
    case 'contains': {
      if (docValue == null) return false
      const hay = Array.isArray(docValue) ? docValue.map(String).join(' ') : String(docValue)
      return hay.toLowerCase().includes(String(rule.value).toLowerCase())
    }
    case 'in': {
      const arr = splitInValue(rule.value)
      return arr.some((c) => looseEquals(docValue, c))
    }
    case 'exists': {
      const want = rule.value === true || rule.value === 'true'
      const exists = docValue !== null && docValue !== undefined && docValue !== ''
      return want ? exists : !exists
    }
    case 'greater_than':
    case 'less_than': {
      const a = toComparable(docValue)
      const b = toComparable(rule.value)
      if (a == null || b == null) return false
      const cmp = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
      return rule.op === 'greater_than' ? cmp > 0 : cmp < 0
    }
    default:
      return true
  }
}

/** OR across groups, AND within a group. Empty groups match everything. */
export function matchesGroups(doc: Record<string, unknown>, groups: FilterGroups): boolean {
  const active = groups.filter((g) => g.length > 0)
  if (active.length === 0) return true
  return active.some((group) => group.every((rule) => evalRule(doc, rule)))
}

/** Count of non-empty rules across all groups — for the toolbar badge. */
export function countRules(groups: FilterGroups): number {
  return groups.reduce((n, g) => n + g.length, 0)
}
