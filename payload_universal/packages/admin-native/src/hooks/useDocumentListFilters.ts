/**
 * Hook that manages search text + structured filters and produces
 * a Payload REST API `where` query object.
 *
 * Web-parity OR-group model (WhereBuilder semantics): filters live in
 * OR-groups — conditions inside a group AND together, groups OR together.
 * Each `ActiveFilter` carries a `groupIndex`; the flat `filters` array is
 * kept as the public shape for backward compatibility (chips props), with
 * a derived `groups: FilterGroup[]` view for group-aware UIs.
 *
 * Serialization:
 *  - single group → the original flat AND shape (`{ and: [...] }` /
 *    single clause), so existing consumers and persisted queries keep working
 *  - multiple groups → `{ or: [{ and: [...] }, { and: [...] }] }` (web parity)
 *  - free-text search ANDs on top of the whole filter expression
 *
 * Filters can be edited in place via `updateFilter` (chip tap → editor
 * pre-filled). `addFilter` accepts a `newGroup` flag to start a new OR-group
 * (web "+ Or"); otherwise the filter joins the current (last) group.
 *
 * Persistence: pass `collection` to persist the groups per collection in
 * AsyncStorage (`list_filters:{collection}`). The stored value is versioned
 * (`{ v: 2, groups: [...] }`); a legacy flat `ActiveFilter[]` array is read
 * gracefully as a single group.
 *
 * Also exports `applyWhereToDocs`, a client-side evaluator for the same
 * `where` shape (including nested or/and) so local-first (RxDB) doc arrays
 * honour search + filters without a round-trip.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ClientField } from '../types'
import { getByPath, getFieldLabel } from '../utils/schemaHelpers'
import { getOperatorsForFieldType } from '../utils/filterOperators'

export type ActiveFilter = {
  id: string
  field: string
  fieldLabel: string
  operator: string
  operatorLabel: string
  value: unknown
  /** Human-readable value for chip display (e.g. relationship doc title). */
  valueLabel?: string
  /**
   * OR-group this filter belongs to (0-based, contiguous). Conditions with
   * the same groupIndex AND together; distinct groups OR together.
   * Absent ⇒ group 0 (legacy flat AND shape).
   */
  groupIndex?: number
}

/** One OR-group: a list of AND-combined conditions (web WhereBuilder row). */
export type FilterGroup = ActiveFilter[]

/**
 * A condition payload without runtime identity (no id / groupIndex) — the
 * exchange shape for presets: `whereToFilterGroups` produces groups of these
 * and `setFilterGroups` replaces the active filters with them.
 */
export type FilterCondition = Omit<ActiveFilter, 'id' | 'groupIndex'>

type Args = {
  /** Field names to search across for free-text queries. */
  searchFields?: string[]
  /**
   * Collection slug — when provided, filter groups persist per collection
   * in AsyncStorage (`list_filters:{collection}`).
   */
  collection?: string
}

const DEFAULT_SEARCH_FIELDS = ['title', 'name', 'email', 'slug', 'filename']

let nextId = 0
const genId = () => `filter-${++nextId}`

// ---------------------------------------------------------------------------
// Persistence — optional AsyncStorage, same pattern as DocumentList's
// `list_sort:` / `list_page_size:` keys.
// ---------------------------------------------------------------------------

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem?: (key: string) => Promise<void>
}
let AsyncStorage: AsyncStorageLike | null = null
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default
} catch {
  /* @react-native-async-storage/async-storage not installed — filters not persisted */
}

const FILTERS_KEY_PREFIX = 'list_filters:'
const FILTERS_SHAPE_VERSION = 2

type PersistedFilter = Omit<ActiveFilter, 'id' | 'groupIndex'>
type PersistedFiltersV2 = { v: number; groups: PersistedFilter[][] }

const isValidPersistedFilter = (f: unknown): f is PersistedFilter => {
  if (!f || typeof f !== 'object') return false
  const o = f as Record<string, unknown>
  return typeof o.field === 'string' && typeof o.operator === 'string' && 'value' in o
}

/**
 * Parse a persisted value, accepting both shapes:
 *  - v2: `{ v: 2, groups: PersistedFilter[][] }`
 *  - legacy (v1): flat `ActiveFilter[]` array → one single group
 * Returns groups of validated condition payloads (without ids).
 */
const parsePersistedFilters = (raw: string): PersistedFilter[][] | null => {
  try {
    const parsed: unknown = JSON.parse(raw)
    // Legacy flat shape — a plain array of filters (one AND group)
    if (Array.isArray(parsed)) {
      const flat = parsed.filter(isValidPersistedFilter)
      return flat.length > 0 ? [flat] : []
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as PersistedFiltersV2).groups)) {
      return (parsed as PersistedFiltersV2).groups
        .filter(Array.isArray)
        .map((g) => (g as unknown[]).filter(isValidPersistedFilter))
        .filter((g) => g.length > 0)
    }
  } catch {
    /* corrupt entry — ignore */
  }
  return null
}

// ---------------------------------------------------------------------------
// Group helpers
// ---------------------------------------------------------------------------

/** Re-pack group indexes so they are contiguous and start at 0. */
const normalizeGroupIndexes = (list: ActiveFilter[]): ActiveFilter[] => {
  const order = Array.from(new Set(list.map((f) => f.groupIndex ?? 0))).sort((a, b) => a - b)
  const remap = new Map(order.map((gi, i) => [gi, i]))
  // Stable sort keeps insertion order within each group
  return [...list]
    .sort((a, b) => remap.get(a.groupIndex ?? 0)! - remap.get(b.groupIndex ?? 0)!)
    .map((f) => ({ ...f, groupIndex: remap.get(f.groupIndex ?? 0)! }))
}

const groupFilters = (list: ActiveFilter[]): FilterGroup[] => {
  const groups: FilterGroup[] = []
  for (const f of list) {
    const gi = f.groupIndex ?? 0
    if (!groups[gi]) groups[gi] = []
    groups[gi].push(f)
  }
  return groups.filter((g) => g && g.length > 0)
}

const maxGroupIndex = (list: ActiveFilter[]): number =>
  list.reduce((max, f) => Math.max(max, f.groupIndex ?? 0), -1)

export const useDocumentListFilters = (args?: Args) => {
  const searchFields = args?.searchFields ?? DEFAULT_SEARCH_FIELDS
  const collection = args?.collection

  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters] = useState<ActiveFilter[]>([])

  // Debounce search text (300ms)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedSearch(searchText), 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [searchText])

  /** OR-groups view of the flat filter list (group-aware UIs). */
  const groups = useMemo<FilterGroup[]>(() => groupFilters(filters), [filters])

  /**
   * Add a filter. By default it joins the current (last) group — AND with the
   * existing conditions. Pass `newGroup: true` (web "+ Or") to start a new
   * OR-group, or an explicit `groupIndex` to target a specific group.
   */
  const addFilter = useCallback(
    (f: Omit<ActiveFilter, 'id'> & { newGroup?: boolean }) => {
      setFilters((prev) => {
        const { newGroup, ...rest } = f
        const last = maxGroupIndex(prev)
        const groupIndex = newGroup
          ? last + 1
          : rest.groupIndex ?? Math.max(last, 0)
        return normalizeGroupIndexes([...prev, { ...rest, id: genId(), groupIndex }])
      })
    },
    [],
  )

  /**
   * Update an existing filter in place (chip editing). The filter stays in
   * its OR-group unless the patch carries `newGroup: true` (move to a fresh
   * group) or an explicit `groupIndex`.
   */
  const updateFilter = useCallback(
    (id: string, patch: Partial<Omit<ActiveFilter, 'id'>> & { newGroup?: boolean }) => {
      setFilters((prev) => {
        const { newGroup, ...rest } = patch
        const next = prev.map((f) =>
          f.id === id
            ? { ...f, ...rest, ...(newGroup ? { groupIndex: maxGroupIndex(prev) + 1 } : {}) }
            : f,
        )
        return normalizeGroupIndexes(next)
      })
    },
    [],
  )

  const removeFilter = useCallback((id: string) => {
    // Dropping the last condition of a group removes the group (web parity);
    // normalization re-packs the remaining group indexes.
    setFilters((prev) => normalizeGroupIndexes(prev.filter((f) => f.id !== id)))
  }, [])

  /**
   * Replace ALL active filters with the given OR-groups (preset application).
   * Each condition gets a fresh id; group order maps to group indexes. The
   * per-collection persistence write-through applies as usual.
   */
  const setFilterGroups = useCallback((newGroups: FilterCondition[][]) => {
    setFilters(() => {
      const next: ActiveFilter[] = []
      newGroups.forEach((group, gi) => {
        for (const f of group) next.push({ ...f, id: genId(), groupIndex: gi })
      })
      return normalizeGroupIndexes(next)
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setFilters([])
    setSearchText('')
    setDebouncedSearch('')
  }, [])

  // ── Persistence — restore once per collection, then write-through ──
  const restoredRef = useRef<string | null>(null)
  useEffect(() => {
    if (!collection || !AsyncStorage) return
    if (restoredRef.current === collection) return
    let cancelled = false
    AsyncStorage.getItem(FILTERS_KEY_PREFIX + collection)
      .then((raw) => {
        if (cancelled) return
        restoredRef.current = collection
        if (!raw) return
        const persistedGroups = parsePersistedFilters(raw)
        if (!persistedGroups || persistedGroups.length === 0) return
        const restored: ActiveFilter[] = []
        persistedGroups.forEach((group, gi) => {
          for (const f of group) {
            restored.push({
              ...f,
              fieldLabel: typeof f.fieldLabel === 'string' ? f.fieldLabel : f.field,
              operatorLabel: typeof f.operatorLabel === 'string' ? f.operatorLabel : f.operator,
              id: genId(),
              groupIndex: gi,
            })
          }
        })
        // Don't clobber filters the user added before the restore resolved
        setFilters((prev) => (prev.length > 0 ? prev : restored))
      })
      .catch(() => {
        if (!cancelled) restoredRef.current = collection
      })
    return () => { cancelled = true }
  }, [collection])

  useEffect(() => {
    if (!collection || !AsyncStorage) return
    // Skip writes until the initial restore for this collection resolved
    if (restoredRef.current !== collection) return
    const key = FILTERS_KEY_PREFIX + collection
    if (filters.length === 0) {
      if (AsyncStorage.removeItem) AsyncStorage.removeItem(key).catch(() => {})
      else AsyncStorage.setItem(key, JSON.stringify({ v: FILTERS_SHAPE_VERSION, groups: [] })).catch(() => {})
      return
    }
    const payload: PersistedFiltersV2 = {
      v: FILTERS_SHAPE_VERSION,
      groups: groupFilters(filters).map((g) =>
        g.map(({ id: _id, groupIndex: _gi, ...rest }) => rest),
      ),
    }
    AsyncStorage.setItem(key, JSON.stringify(payload)).catch(() => {})
  }, [collection, filters])

  // ── Build the Payload `where` query ──
  // Single group → flat AND shape (backward compatible); multiple groups →
  // `{ or: [{ and: [...] }] }` (web WhereBuilder parity). Free-text search
  // ANDs with the whole filter expression.
  const whereQuery = useMemo(() => {
    const clauses: Record<string, unknown>[] = []

    // Text search → or across search fields
    if (debouncedSearch.trim()) {
      const orClauses = searchFields.map((field) => ({
        [field]: { contains: debouncedSearch.trim() },
      }))
      clauses.push({ or: orClauses })
    }

    const filterGroups = groupFilters(filters)
    const toClause = (f: ActiveFilter) => ({ [f.field]: { [f.operator]: f.value } })

    if (filterGroups.length === 1) {
      // Flat AND shape — same as the pre-group behaviour
      for (const f of filterGroups[0]) clauses.push(toClause(f))
    } else if (filterGroups.length > 1) {
      clauses.push({
        or: filterGroups.map((g) => ({ and: g.map(toClause) })),
      })
    }

    if (clauses.length === 0) return undefined
    if (clauses.length === 1) return clauses[0]
    return { and: clauses }
  }, [debouncedSearch, filters, searchFields])

  const hasActiveFilters = filters.length > 0 || debouncedSearch.trim().length > 0

  return {
    searchText,
    setSearchText,
    filters,
    /** Filters grouped by OR-group (conditions AND within, groups OR across). */
    groups,
    addFilter,
    updateFilter,
    removeFilter,
    /** Replace all filters with preset OR-groups (see `whereToFilterGroups`). */
    setFilterGroups,
    clearAllFilters,
    whereQuery,
    hasActiveFilters,
  }
}

// ---------------------------------------------------------------------------
// Where ⇄ filter-group conversion — view presets & payload-query-presets
// ---------------------------------------------------------------------------

/**
 * Serialize structured filters to a Payload `where` object (presets persist
 * this verbatim). Mirrors the hook's `whereQuery` serialization minus the
 * free-text search clause:
 *   - no filters        → undefined
 *   - one group, 1 cond → flat clause
 *   - one group, n cond → `{ and: [...] }`
 *   - multiple groups   → `{ or: [{ and: [...] }] }`
 */
export const filtersToWhere = (filters: ActiveFilter[]): WhereClause | undefined => {
  const filterGroups = groupFilters(filters)
  const toClause = (f: ActiveFilter): WhereClause => ({ [f.field]: { [f.operator]: f.value } })
  if (filterGroups.length === 0) return undefined
  if (filterGroups.length === 1) {
    const clauses = filterGroups[0].map(toClause)
    return clauses.length === 1 ? clauses[0] : { and: clauses }
  }
  return { or: filterGroups.map((g) => ({ and: g.map(toClause) })) }
}

/** Operators the on-device evaluator (`matchesWhere`) understands. */
const LOCAL_OPERATORS = new Set([
  'exists',
  'equals',
  'not_equals',
  'contains',
  'like',
  'not_like',
  'in',
  'not_in',
  'greater_than',
  'greater_than_equal',
  'less_than',
  'less_than_equal',
])

/**
 * Parse a Payload `where` object back into the OR-group filter model.
 *
 * Handles the canonical query-preset shape (`{ or: [{ and: [...] }] }` —
 * the server's transformWhereQuery output), the flat AND shape, and single
 * clauses. Conditions are returned in groups for `setFilterGroups`.
 *
 * `unsupported` lists conditions the result cannot faithfully express or
 * that the local evaluator cannot run (`field op` strings):
 *   - operators outside the local evaluator's set (geo `near`/`within`/…) —
 *     the condition is still INCLUDED (matchesWhere passes unknown operators
 *     through, REST queries would honour them) so callers can surface the
 *     limitation inline;
 *   - `or` arrays nested deeper than the top level (not representable in the
 *     two-level group model) — these are SKIPPED.
 *
 * Pass `fields` to resolve human-readable field/operator labels for chips.
 */
export const whereToFilterGroups = (
  where: WhereClause | null | undefined,
  fields?: ClientField[],
): { groups: FilterCondition[][]; unsupported: string[] } => {
  const unsupported: string[] = []
  if (!where || typeof where !== 'object' || Array.isArray(where)) {
    return { groups: [], unsupported }
  }

  const fieldByName = new Map<string, ClientField>()
  for (const f of fields ?? []) {
    if (f.name) fieldByName.set(f.name, f)
  }

  const conditionFor = (fieldName: string, operator: string, value: unknown): FilterCondition => {
    const field = fieldByName.get(fieldName)
    const opLabel = field
      ? getOperatorsForFieldType(field.type).find((o) => o.value === operator)?.label
      : undefined
    if (!LOCAL_OPERATORS.has(operator)) unsupported.push(`${fieldName} ${operator}`)
    return {
      field: fieldName,
      fieldLabel: field ? getFieldLabel(field) : fieldName,
      operator,
      operatorLabel: opLabel ?? operator.replace(/_/g, ' '),
      value,
    }
  }

  /** Flatten a clause (recursing nested `and`) into one AND-group. */
  const parseInto = (clause: WhereClause, group: FilterCondition[]): void => {
    for (const [key, val] of Object.entries(clause)) {
      if (key === 'and' && Array.isArray(val)) {
        for (const c of val as unknown[]) {
          if (c && typeof c === 'object' && !Array.isArray(c)) parseInto(c as WhereClause, group)
        }
        continue
      }
      if (key === 'or' && Array.isArray(val)) {
        const arr = (val as unknown[]).filter(
          (c): c is WhereClause => Boolean(c) && typeof c === 'object' && !Array.isArray(c),
        )
        // A single-entry `or` is just its entry; anything wider can't be
        // expressed inside a group — skip it and report.
        if (arr.length === 1) parseInto(arr[0], group)
        else if (arr.length > 1) unsupported.push('(nested or)')
        continue
      }
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const [op, condValue] of Object.entries(val as Record<string, unknown>)) {
          group.push(conditionFor(key, op, condValue))
        }
      }
    }
  }

  const groups: FilterCondition[][] = []
  const entries = Object.entries(where)
  const isTopLevelOr = entries.length === 1 && entries[0][0] === 'or' && Array.isArray(entries[0][1])

  if (isTopLevelOr) {
    for (const clause of entries[0][1] as unknown[]) {
      if (!clause || typeof clause !== 'object' || Array.isArray(clause)) continue
      const group: FilterCondition[] = []
      parseInto(clause as WhereClause, group)
      if (group.length > 0) groups.push(group)
    }
  } else {
    const group: FilterCondition[] = []
    parseInto(where, group)
    if (group.length > 0) groups.push(group)
  }

  return { groups, unsupported }
}

// ---------------------------------------------------------------------------
// Client-side `where` evaluation — for local-first (RxDB) doc arrays
// ---------------------------------------------------------------------------

export type WhereClause = Record<string, unknown>

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
