import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { payloadApi } from '../../../../utils/api'
import { mergeWhere, useDebouncedValue, whereToMangoSelector } from '../../shared'
import { BROWSE_PAGE_SIZE, type MediaDoc } from '../types'

type UseBrowseArgs = {
  sheetOpen: boolean
  mode: string
  baseURL: string
  token: string | null
  relationTo: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  localDB: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filterOptions: any
  titleField: string
}

/**
 * "Browse existing" data layer — RxDB local prefilter (instant) merged with a
 * debounced/paginated REST search. Self-contained: holds all browse state and
 * exposes the merged display list + load-more trigger.
 */
export const useBrowse = ({
  sheetOpen, mode, baseURL, token, relationTo, localDB, filterOptions, titleField,
}: UseBrowseArgs) => {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [browseDocs, setBrowseDocs] = useState<MediaDoc[]>([])
  const [browseLoaded, setBrowseLoaded] = useState(false)
  const [browseLocalDocs, setBrowseLocalDocs] = useState<MediaDoc[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseLoadingMore, setBrowseLoadingMore] = useState(false)
  const [browseHasNext, setBrowseHasNext] = useState(false)
  const browsePageRef = useRef(1)
  const browseRequestRef = useRef(0)

  const loadBrowse = useCallback(async (reset: boolean) => {
    const requestId = ++browseRequestRef.current
    const page = reset ? 1 : browsePageRef.current + 1
    if (reset) setBrowseLoading(true)
    else setBrowseLoadingMore(true)
    try {
      const q = debouncedSearch.trim()
      const result = await payloadApi.find({ baseURL, token }, relationTo, {
        page,
        limit: BROWSE_PAGE_SIZE,
        depth: 0,
        sort: '-updatedAt',
        where: mergeWhere(filterOptions, q ? { [titleField]: { like: q } } : undefined),
      })
      if (requestId !== browseRequestRef.current) return
      browsePageRef.current = page
      setBrowseDocs((prev) => (reset ? result.docs : [...prev, ...result.docs]))
      setBrowseHasNext(Boolean(result.hasNextPage))
      setBrowseLoaded(true)
    } catch {
      if (requestId !== browseRequestRef.current) return
      if (reset) { setBrowseDocs([]); setBrowseLoaded(false) }
      setBrowseHasNext(false)
    } finally {
      if (requestId === browseRequestRef.current) { setBrowseLoading(false); setBrowseLoadingMore(false) }
    }
  }, [baseURL, token, relationTo, debouncedSearch, filterOptions, titleField])

  useEffect(() => {
    if (!sheetOpen || mode !== 'browse') return
    loadBrowse(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, mode, debouncedSearch])

  useEffect(() => {
    if (!sheetOpen || mode !== 'browse') return
    const localCollection = localDB?.collections?.[relationTo]
    if (!localCollection) { setBrowseLocalDocs([]); return }
    const filterSelector = whereToMangoSelector(filterOptions)
    if (filterSelector === null) { setBrowseLocalDocs([]); return }

    let cancelled = false
    const run = async () => {
      try {
        const results = await localCollection.find({
          selector: { _deleted: { $eq: false }, ...filterSelector },
          sort: [{ updatedAt: 'desc' }],
          limit: 60,
        }).exec()
        if (cancelled) return
        let docs: MediaDoc[] = results.map((r: any) => r.toJSON())
        const q = search.trim().toLowerCase()
        if (q) {
          docs = docs.filter((doc) =>
            ['filename', 'alt', titleField].some((f) => {
              const v = doc[f]
              return v != null && String(v).toLowerCase().includes(q)
            }),
          )
        }
        setBrowseLocalDocs(docs)
      } catch {
        if (!cancelled) setBrowseLocalDocs([])
      }
    }
    run()
    return () => { cancelled = true }
  }, [sheetOpen, mode, search, localDB, relationTo, filterOptions, titleField])

  const browseDisplayDocs = useMemo(() => {
    const seen = new Set<string>()
    const out: MediaDoc[] = []
    const push = (doc: MediaDoc) => {
      const id = String(doc.id ?? '')
      if (id && !seen.has(id)) { seen.add(id); out.push(doc) }
    }
    if (browseLoaded) { browseDocs.forEach(push); browseLocalDocs.forEach(push) }
    else browseLocalDocs.forEach(push)
    return out
  }, [browseDocs, browseLocalDocs, browseLoaded])

  const resetSearch = useCallback(() => setSearch(''), [])

  return {
    search,
    setSearch,
    resetSearch,
    browseLoading,
    browseLoaded,
    browseHasNext,
    browseLoadingMore,
    browseDisplayDocs,
    loadBrowse,
  }
}
