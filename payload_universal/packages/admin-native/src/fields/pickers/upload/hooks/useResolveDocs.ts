import { useEffect, useState } from 'react'

import { payloadApi } from '../../../../utils/api'
import type { MediaDoc } from '../types'

type Item = { id: string; doc: MediaDoc | null }

/**
 * Resolves selected ids without inline docs — local RxDB first, REST fallback.
 * Owns the docsById cache and exposes a setter so the picker can prime it on
 * select/upload, plus `docFor` for value rows.
 */
export const useResolveDocs = (
  items: Item[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  localDB: any,
  baseURL: string,
  token: string | null,
  relationTo: string,
) => {
  const [docsById, setDocsById] = useState<Record<string, MediaDoc | null>>({})

  useEffect(() => {
    const missing = items.filter((it) => it.doc == null && docsById[it.id] === undefined)
    if (missing.length === 0) return
    let cancelled = false
    const resolve = async () => {
      const updates: Record<string, MediaDoc | null> = {}
      const localCollection = localDB?.collections?.[relationTo]
      for (const it of missing) {
        try {
          if (localCollection) {
            const rxDoc = await localCollection.findOne(it.id).exec()
            if (rxDoc) { updates[it.id] = rxDoc.toJSON(); continue }
          }
          updates[it.id] = await payloadApi.findByID({ baseURL, token }, relationTo, it.id, { depth: 0 })
        } catch {
          updates[it.id] = null
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setDocsById((prev) => ({ ...prev, ...updates }))
      }
    }
    resolve()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, localDB, baseURL, token, relationTo])

  const docFor = (id: string): MediaDoc | null =>
    docsById[id] ?? items.find((it) => it.id === id)?.doc ?? null

  return { docsById, setDocsById, docFor }
}
