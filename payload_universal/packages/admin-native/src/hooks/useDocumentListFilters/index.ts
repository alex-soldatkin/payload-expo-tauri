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

import type { ActiveFilter, Args, FilterCondition, FilterGroup, PersistedFiltersV2 } from './types'
import { genId, groupFilters, maxGroupIndex, normalizeGroupIndexes } from './groups'
import {
  AsyncStorage,
  FILTERS_KEY_PREFIX,
  FILTERS_SHAPE_VERSION,
  parsePersistedFilters,
} from './persistence'

// Re-export every symbol the pre-folder module exposed so `from
// './useDocumentListFilters'` (→ ./useDocumentListFilters/index) keeps its
// public surface identical.
export type { ActiveFilter, FilterCondition, FilterGroup, WhereClause } from './types'
export { filtersToWhere, whereToFilterGroups } from './converters'
export { applyWhereToDocs, matchesWhere } from './whereEval'

const DEFAULT_SEARCH_FIELDS = ['title', 'name', 'email', 'slug', 'filename']

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
