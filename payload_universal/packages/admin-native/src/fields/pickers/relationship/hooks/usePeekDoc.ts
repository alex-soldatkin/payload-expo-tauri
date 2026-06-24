import { useEffect, useState } from 'react'

import { payloadApi } from '../../../../utils/api'
import type { RelDoc, RelItem } from '../types'

/**
 * Resolves the peeked row's full document — local RxDB first, REST fallback.
 * Loaded lazily when the peek opens (selected rows only carry id + title).
 */
export const usePeekDoc = (
  peekRow: { key: string; item: RelItem } | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  localDB: any,
  baseURL: string,
  token: string | null,
) => {
  const [peekDoc, setPeekDoc] = useState<RelDoc | null>(null)

  useEffect(() => {
    if (!peekRow) { setPeekDoc(null); return }
    const { relationTo, id } = peekRow.item
    let cancelled = false
    const load = async () => {
      try {
        const localCollection = localDB?.collections?.[relationTo]
        if (localCollection) {
          const rxDoc = await localCollection.findOne(id).exec()
          if (rxDoc) {
            if (!cancelled) setPeekDoc(rxDoc.toJSON() as RelDoc)
            return
          }
        }
      } catch { /* fall through to REST */ }
      try {
        const result = await payloadApi.find({ baseURL, token }, relationTo, {
          where: { id: { equals: id } }, limit: 1, depth: 0,
        })
        if (!cancelled) setPeekDoc((result.docs[0] as RelDoc) ?? null)
      } catch {
        if (!cancelled) setPeekDoc(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [peekRow, localDB, baseURL, token])

  return peekDoc
}
