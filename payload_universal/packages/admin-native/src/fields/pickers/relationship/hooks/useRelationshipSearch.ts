import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { payloadApi } from '../../../../utils/api'
import { mergeWhere, useDebouncedValue, whereToMangoSelector } from '../../shared'
import { PAGE_SIZE, type RelDoc } from '../types'

type UseRelationshipSearchArgs = {
  open: boolean
  baseURL: string
  token: string | null
  activeCollection: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  localDB: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterOptions: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sortOptions: any
  titleFieldFor: (slug: string) => string | undefined
}

/**
 * Relationship results data layer — RxDB local prefilter (instant) merged with
 * a debounced/paginated REST search, server-side filterOptions + sortOptions
 * applied. Self-contained: owns search/server/local state and the merged list.
 */
export const useRelationshipSearch = ({
  open, baseURL, token, activeCollection, localDB, filterOptions, sortOptions, titleFieldFor,
}: UseRelationshipSearchArgs) => {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [serverDocs, setServerDocs] = useState<RelDoc[]>([])
  const [serverLoaded, setServerLoaded] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [localDocs, setLocalDocs] = useState<RelDoc[]>([])
  const pageRef = useRef(1)
  const requestIdRef = useRef(0)

  const buildWhere = useCallback((searchTerm: string): Record<string, unknown> | undefined => {
    const titleField = titleFieldFor(activeCollection) ?? 'id'
    const searchWhere = searchTerm.trim()
      ? { [titleField]: { like: searchTerm.trim() } }
      : undefined
    return mergeWhere(filterOptions, searchWhere)
  }, [activeCollection, filterOptions, titleFieldFor])

  const sortFor = useCallback((slug: string): string => {
    const so = sortOptions
    if (typeof so === 'string') return so
    if (so && typeof so === 'object') return so[slug] ?? '-updatedAt'
    return '-updatedAt'
  }, [sortOptions])

  const loadServer = useCallback(async (reset: boolean) => {
    const requestId = ++requestIdRef.current
    const page = reset ? 1 : pageRef.current + 1
    if (reset) setLoading(true)
    else setLoadingMore(true)
    try {
      const result = await payloadApi.find({ baseURL, token }, activeCollection, {
        page,
        limit: PAGE_SIZE,
        depth: 0,
        sort: sortFor(activeCollection),
        where: buildWhere(debouncedSearch),
      })
      if (requestId !== requestIdRef.current) return
      pageRef.current = page
      setServerDocs((prev) => (reset ? result.docs : [...prev, ...result.docs]))
      setHasNextPage(Boolean(result.hasNextPage))
      setServerLoaded(true)
    } catch {
      if (requestId !== requestIdRef.current) return
      if (reset) { setServerDocs([]); setServerLoaded(false) }
      setHasNextPage(false)
    } finally {
      if (requestId === requestIdRef.current) { setLoading(false); setLoadingMore(false) }
    }
  }, [baseURL, token, activeCollection, debouncedSearch, buildWhere, sortFor])

  useEffect(() => {
    if (!open) return
    loadServer(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeCollection, debouncedSearch])

  // ---- RxDB local prefilter (instant results while server search runs) ----

  useEffect(() => {
    if (!open) { return }
    const localCollection = localDB?.collections?.[activeCollection]
    if (!localCollection) { setLocalDocs([]); return }

    // Skip the local tier entirely when filterOptions can't be converted —
    // never show docs the server-side filter would exclude.
    const filterSelector = whereToMangoSelector(filterOptions)
    if (filterSelector === null) { setLocalDocs([]); return }

    let cancelled = false
    const run = async () => {
      try {
        const results = await localCollection.find({
          selector: { _deleted: { $eq: false }, ...filterSelector },
          sort: [{ updatedAt: 'desc' }],
          limit: 50,
        }).exec()
        if (cancelled) return
        let docs: RelDoc[] = results.map((r: any) => r.toJSON())
        const q = search.trim().toLowerCase()
        if (q) {
          const titleField = titleFieldFor(activeCollection)
          docs = docs.filter((doc) => {
            const fields = new Set(['title', 'name', 'email', 'id'])
            if (titleField) fields.add(titleField)
            return Array.from(fields).some((f) => {
              const val = doc[f]
              return val != null && String(val).toLowerCase().includes(q)
            })
          })
        }
        setLocalDocs(docs)
      } catch {
        if (!cancelled) setLocalDocs([])
      }
    }
    run()
    return () => { cancelled = true }
  }, [open, activeCollection, search, localDB, filterOptions, titleFieldFor])

  // ---- merged display list ----

  const displayDocs = useMemo(() => {
    const seen = new Set<string>()
    const out: RelDoc[] = []
    const push = (doc: RelDoc) => {
      const id = String(doc.id ?? '')
      if (id && !seen.has(id)) { seen.add(id); out.push(doc) }
    }
    if (serverLoaded) {
      serverDocs.forEach(push)
      localDocs.forEach(push) // local-only (e.g. unsynced) docs appended
    } else {
      localDocs.forEach(push)
    }
    return out
  }, [serverDocs, localDocs, serverLoaded])

  // Reset server paging when switching the active polymorphic collection.
  const resetServer = useCallback(() => {
    setServerDocs([])
    setServerLoaded(false)
    setHasNextPage(false)
  }, [])

  return {
    search,
    setSearch,
    serverLoaded,
    hasNextPage,
    loading,
    loadingMore,
    displayDocs,
    loadServer,
    resetServer,
  }
}
