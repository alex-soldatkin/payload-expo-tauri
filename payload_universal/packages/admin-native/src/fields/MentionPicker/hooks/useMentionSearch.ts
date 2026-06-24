import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { usePayloadNative } from '../../../PayloadNativeProvider'
import { payloadApi } from '../../../utils/api'
import { _useLocalDB } from '../deps'
import type { FlatRow, MentionResult, SectionData } from '../types'
import { collectionLabel, DEBOUNCE_MS, docTitle, PER_COLLECTION_LIMIT, TOTAL_LIMIT } from '../utils'

/**
 * Owns the MentionPicker search lifecycle: local search text (seeded from the
 * external prop), debounced cross-collection query (local RxDB first, REST
 * fallback), and the grouped/flattened data shapes consumed by the FlatList.
 */
export function useMentionSearch(visible: boolean, externalSearchText: string) {
  const { baseURL, auth, schema } = usePayloadNative()
  const localDB = _useLocalDB ? _useLocalDB() : null

  // Local search state — initialised from the external searchText prop
  const [search, setSearch] = useState(externalSearchText)
  const [results, setResults] = useState<MentionResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external searchText into local state when it changes
  useEffect(() => {
    setSearch(externalSearchText)
  }, [externalSearchText])

  // Visible (non-hidden) collections derived from menuModel
  const visibleCollections = useMemo(() => {
    if (!schema?.menuModel?.collections) return []
    return schema.menuModel.collections.filter((c: any) => !c.hidden)
  }, [schema])

  // ---- Search logic (debounced) ----

  const performSearch = useCallback(async (query: string) => {
    if (!visibleCollections.length) {
      setResults([])
      return
    }

    setLoading(true)

    try {
      const allResults: MentionResult[] = []
      const q = query.trim().toLowerCase()

      // Search each collection in parallel
      const promises = visibleCollections.map(async (col: any) => {
        const useAsTitle: string | undefined = col.useAsTitle
        const label = collectionLabel(col)
        const slug: string = col.slug

        let docs: Array<Record<string, unknown>> = []

        try {
          const localCollection = localDB?.collections?.[slug]

          if (localCollection) {
            // Local-first: query RxDB
            if (q.length > 0 && useAsTitle) {
              // Use $regex for the useAsTitle field
              const rxDocs = await localCollection.find({
                selector: {
                  _deleted: { $eq: false },
                  [useAsTitle]: { $regex: new RegExp(q, 'i') },
                },
                limit: PER_COLLECTION_LIMIT,
              }).exec()
              docs = rxDocs.map((r: any) => r.toJSON())
            } else {
              // No search text or no useAsTitle — fetch all and filter in JS
              const rxDocs = await localCollection.find({
                selector: { _deleted: { $eq: false } },
                sort: [{ updatedAt: 'desc' }],
                limit: PER_COLLECTION_LIMIT,
              }).exec()
              const allDocs = rxDocs.map((r: any) => r.toJSON())
              if (q.length > 0) {
                docs = allDocs.filter((doc: Record<string, unknown>) =>
                  docTitle(doc, useAsTitle).toLowerCase().includes(q),
                )
              } else {
                docs = allDocs
              }
            }
          } else {
            // Fallback: REST API search
            const titleField = useAsTitle || 'title'
            const where = q.length > 0
              ? { [titleField]: { like: q } }
              : undefined
            const result = await payloadApi.find(
              { baseURL, token: auth.token },
              slug,
              { limit: PER_COLLECTION_LIMIT, depth: 0, sort: '-updatedAt', where },
            )
            docs = result.docs
          }
        } catch {
          // Silently skip collections that fail to query
          docs = []
        }

        return docs.map((doc) => ({
          collection: slug,
          id: String(doc.id),
          title: docTitle(doc, useAsTitle),
          collectionLabel: label,
          collectionIcon: col.icon,
        }))
      })

      const perCollectionResults = await Promise.all(promises)

      for (const batch of perCollectionResults) {
        for (const item of batch) {
          if (allResults.length >= TOTAL_LIMIT) break
          allResults.push(item)
        }
        if (allResults.length >= TOTAL_LIMIT) break
      }

      setResults(allResults)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [visibleCollections, localDB, baseURL, auth.token])

  // Debounced search trigger
  useEffect(() => {
    if (!visible) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      performSearch(search)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, visible, performSearch])

  // Reset state when sheet closes
  useEffect(() => {
    if (!visible) {
      setResults([])
      setLoading(false)
    }
  }, [visible])

  // ---- Group results by collection for section rendering ----

  const sections = useMemo<SectionData[]>(() => {
    const map = new Map<string, SectionData>()
    for (const item of results) {
      let section = map.get(item.collection)
      if (!section) {
        section = {
          slug: item.collection,
          label: item.collectionLabel,
          icon: item.collectionIcon,
          data: [],
        }
        map.set(item.collection, section)
      }
      section.data.push(item)
    }
    return Array.from(map.values())
  }, [results])

  // Flatten sections into a single list with section headers for FlatList
  const flatData = useMemo<FlatRow[]>(() => {
    const items: FlatRow[] = []
    for (const section of sections) {
      items.push({ type: 'header', section })
      for (const item of section.data) {
        items.push({ type: 'item', item })
      }
    }
    return items
  }, [sections])

  return { search, setSearch, loading, flatData }
}
