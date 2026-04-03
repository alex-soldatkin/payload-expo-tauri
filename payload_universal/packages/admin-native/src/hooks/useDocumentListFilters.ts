/**
 * Hook that manages search text + structured filters and produces
 * a Payload REST API `where` query object.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type ActiveFilter = {
  id: string
  field: string
  fieldLabel: string
  operator: string
  operatorLabel: string
  value: unknown
}

type Args = {
  /** Field names to search across for free-text queries. */
  searchFields?: string[]
}

const DEFAULT_SEARCH_FIELDS = ['title', 'name', 'email', 'slug', 'filename']

let nextId = 0
const genId = () => `filter-${++nextId}`

export const useDocumentListFilters = (args?: Args) => {
  const searchFields = args?.searchFields ?? DEFAULT_SEARCH_FIELDS

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

  const addFilter = useCallback((f: Omit<ActiveFilter, 'id'>) => {
    setFilters((prev) => [...prev, { ...f, id: genId() }])
  }, [])

  const removeFilter = useCallback((id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const clearAllFilters = useCallback(() => {
    setFilters([])
    setSearchText('')
    setDebouncedSearch('')
  }, [])

  // Build the Payload `where` query
  const whereQuery = useMemo(() => {
    const clauses: Record<string, unknown>[] = []

    // Text search → or across search fields
    if (debouncedSearch.trim()) {
      const orClauses = searchFields.map((field) => ({
        [field]: { contains: debouncedSearch.trim() },
      }))
      clauses.push({ or: orClauses })
    }

    // Structured filters
    for (const f of filters) {
      clauses.push({ [f.field]: { [f.operator]: f.value } })
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
    addFilter,
    removeFilter,
    clearAllFilters,
    whereQuery,
    hasActiveFilters,
  }
}
