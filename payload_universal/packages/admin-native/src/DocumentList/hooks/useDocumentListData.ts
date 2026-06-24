/**
 * useDocumentListData — the REST / local-first data pipeline for DocumentList:
 * pagination config + persisted page size, sort state (controlled or
 * AsyncStorage-persisted), the find() loader with stale-response discarding,
 * refresh / infinite-scroll handlers, and the derived doc/range values.
 *
 * Extracted verbatim from the DocumentList body — no behaviour change.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ClientField, PaginatedDocs } from '../../types'
import { payloadApi } from '../../utils/api'
import { applyWhereToDocs } from '../../hooks/useDocumentListFilters'
import { sortDocs, sortToQueryString } from '../utils/sort'
import { DEFAULT_SORT, PAGE_SIZE_KEY_PREFIX, SORT_KEY_PREFIX, DEFAULT_PAGE_SIZE_OPTIONS } from '../types'
import type { DocumentListSort } from '../types'

// Optional: AsyncStorage for per-collection list preferences (sort, page size).
// Same persistence pattern as the screen-level summary fields key.
type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
}
let AsyncStorage: AsyncStorageLike | null = null
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default
} catch {
  /* @react-native-async-storage/async-storage not installed — prefs not persisted */
}

type LocalData = {
  docs: Record<string, unknown>[]
  totalDocs: number
  loading: boolean
  refetch: () => void
}

type UseDocumentListDataArgs = {
  collection: string
  baseURL: string
  authToken: string | null
  schema: ReturnType<typeof import('../../PayloadNativeProvider').usePayloadNative>['schema']
  limit: number
  localData?: LocalData
  whereQuery: unknown
  sortProp?: DocumentListSort | null
  onSortChange?: (sort: DocumentListSort) => void
  sortableFields: ClientField[]
}

export function useDocumentListData({
  collection,
  baseURL,
  authToken,
  schema,
  limit,
  localData,
  whereQuery,
  sortProp,
  onSortChange,
  sortableFields,
}: UseDocumentListDataArgs) {
  const [data, setData] = useState<PaginatedDocs | null>(null)
  const [loading, setLoading] = useState(!localData)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // ── Pagination — schema defaultLimit + persisted per-page selection ──
  const paginationCfg = useMemo(() => {
    const clientCollections = (schema?.clientConfig as unknown as {
      collections?: Array<{
        slug: string
        admin?: { pagination?: { defaultLimit?: number; limits?: number[] } }
      }>
    } | undefined)?.collections
    return clientCollections?.find((c) => c.slug === collection)?.admin?.pagination
  }, [schema, collection])

  const [storedPageSize, setStoredPageSize] = useState<number | null>(null)
  useEffect(() => {
    if (!AsyncStorage) return
    let cancelled = false
    AsyncStorage.getItem(PAGE_SIZE_KEY_PREFIX + collection)
      .then((val) => {
        if (cancelled || !val) return
        const n = Number(val)
        if (Number.isFinite(n) && n > 0) setStoredPageSize(n)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [collection])

  const pageSize = storedPageSize ?? paginationCfg?.defaultLimit ?? limit
  const pageSizeOptions = useMemo(() => {
    const base = paginationCfg?.limits?.length ? paginationCfg.limits : DEFAULT_PAGE_SIZE_OPTIONS
    return base.includes(pageSize) ? base : [...base, pageSize].sort((a, b) => a - b)
  }, [paginationCfg, pageSize])

  const handlePageSizeChange = useCallback(
    (n: number) => {
      setStoredPageSize(n)
      AsyncStorage?.setItem(PAGE_SIZE_KEY_PREFIX + collection, String(n)).catch(() => {})
    },
    [collection],
  )

  // ── Sort — controlled via props, or internal + persisted per collection ──
  const sortControlled = sortProp !== undefined
  const [internalSort, setInternalSort] = useState<DocumentListSort | null>(null)

  useEffect(() => {
    if (sortControlled || !AsyncStorage) return
    let cancelled = false
    AsyncStorage.getItem(SORT_KEY_PREFIX + collection)
      .then((val) => {
        if (cancelled || !val) return
        try {
          const parsed = JSON.parse(val) as DocumentListSort
          if (
            parsed &&
            typeof parsed.field === 'string' &&
            (parsed.direction === 'asc' || parsed.direction === 'desc')
          ) {
            setInternalSort(parsed)
          }
        } catch {
          /* corrupt entry — ignore */
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [collection, sortControlled])

  const effectiveSort = useMemo<DocumentListSort>(() => {
    const s = sortControlled ? sortProp : internalSort
    if (!s) return DEFAULT_SORT
    // Persisted/external sort field may no longer exist — fall back safely
    if (sortableFields.length > 0 && !sortableFields.some((f) => f.name === s.field)) {
      return DEFAULT_SORT
    }
    return s
  }, [sortControlled, sortProp, internalSort, sortableFields])

  const handleSortChange = useCallback(
    (s: DocumentListSort) => {
      onSortChange?.(s)
      if (!sortControlled) {
        setInternalSort(s)
        AsyncStorage?.setItem(SORT_KEY_PREFIX + collection, JSON.stringify(s)).catch(() => {})
      }
    },
    [onSortChange, sortControlled, collection],
  )

  // Table-mode header tap-to-sort: toggle direction on the active column,
  // otherwise select it with a sensible default (desc for dates, asc else) —
  // mirrors the web admin column header behaviour.
  const handleHeaderSortPress = useCallback(
    (field: string, type: string) => {
      const next: DocumentListSort =
        effectiveSort.field === field
          ? { field, direction: effectiveSort.direction === 'asc' ? 'desc' : 'asc' }
          : { field, direction: type === 'date' ? 'desc' : 'asc' }
      handleSortChange(next)
    },
    [effectiveSort, handleSortChange],
  )

  const sortString = sortToQueryString(effectiveSort)

  // ── Local-first pipeline: filter + sort + paginate the provided docs ──
  const whereForDocs = whereQuery as Record<string, unknown> | undefined

  const sortedLocalDocs = useMemo(() => {
    if (!localData) return null
    const filtered = applyWhereToDocs(localData.docs, whereForDocs)
    return sortDocs(filtered, effectiveSort)
  }, [localData, whereForDocs, effectiveSort])

  const [visibleCount, setVisibleCount] = useState(pageSize)
  useEffect(() => {
    setVisibleCount(pageSize)
  }, [pageSize, collection, whereForDocs, sortString])

  const effectiveDocs = sortedLocalDocs
    ? sortedLocalDocs.slice(0, visibleCount)
    : data?.docs ?? []
  const effectiveTotalDocs = sortedLocalDocs ? sortedLocalDocs.length : data?.totalDocs ?? 0
  const effectiveLoading = localData ? localData.loading : loading

  const tokenRef = useRef(authToken)
  tokenRef.current = authToken

  // Stable request counter to discard stale responses
  const requestIdRef = useRef(0)

  const load = useCallback(
    async (p: number, append = false, where?: Record<string, unknown>) => {
      const token = tokenRef.current
      if (!token) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      const reqId = ++requestIdRef.current
      try {
        setError(null)
        const result = await payloadApi.find({ baseURL, token }, collection, {
          page: p,
          limit: pageSize,
          depth: 0,
          sort: sortString,
          where,
        })
        // Discard if a newer request was started
        if (reqId !== requestIdRef.current) return
        setData((prev) =>
          append && prev
            ? { ...result, docs: [...prev.docs, ...result.docs] }
            : result,
        )
      } catch (err) {
        if (reqId !== requestIdRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [baseURL, collection, pageSize, sortString],
  )

  // Initial load + re-load when filters/search/sort/page-size change
  // (skip if using local data)
  useEffect(() => {
    if (localData) return
    if (!authToken) return
    setLoading(true)
    setPage(1)
    load(1, false, whereQuery as Record<string, unknown> | undefined)
  }, [localData, authToken, load, whereQuery])

  const handleRefresh = useCallback(() => {
    if (localData) {
      localData.refetch()
      return
    }
    setRefreshing(true)
    setPage(1)
    load(1, false, whereQuery as Record<string, unknown> | undefined)
  }, [localData, load, whereQuery])

  const handleEndReached = useCallback(() => {
    if (localData) {
      // Client-side "load more" over the locally filtered/sorted docs
      if (sortedLocalDocs && visibleCount < sortedLocalDocs.length) {
        setVisibleCount((c) => Math.min(c + pageSize, sortedLocalDocs.length))
      }
      return
    }
    if (data?.hasNextPage && !loading) {
      const next = page + 1
      setPage(next)
      load(next, true, whereQuery as Record<string, unknown> | undefined)
    }
  }, [localData, sortedLocalDocs, visibleCount, pageSize, data, loading, page, load, whereQuery])

  // "X–Y of Z" pagination meta
  const shownCount = Math.min(effectiveDocs.length, effectiveTotalDocs)
  const rangeLabel =
    effectiveTotalDocs > 0 ? `1–${shownCount} of ${effectiveTotalDocs}` : null

  const retry = useCallback(() => {
    setLoading(true)
    load(1, false, whereQuery as Record<string, unknown> | undefined)
  }, [load, whereQuery])

  return {
    data,
    error,
    pageSize,
    pageSizeOptions,
    handlePageSizeChange,
    effectiveSort,
    handleSortChange,
    handleHeaderSortPress,
    effectiveDocs,
    effectiveTotalDocs,
    effectiveLoading,
    refreshing,
    rangeLabel,
    handleRefresh,
    handleEndReached,
    retry,
    hasNextPage: Boolean(data?.hasNextPage),
    isLocal: Boolean(localData),
  }
}
