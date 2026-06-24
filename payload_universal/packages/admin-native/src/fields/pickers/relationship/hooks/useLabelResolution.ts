import { useEffect, useState } from 'react'

import { payloadApi } from '../../../../utils/api'
import { docDisplayTitle } from '../../shared'
import type { RelItem } from '../types'

/**
 * Resolves human labels for selected ids that arrived without inline docs —
 * local RxDB first (per id), then a batched REST `id in [...]` fallback. Owns
 * the label cache and exposes a setter so selection can prime it eagerly.
 */
export const useLabelResolution = (
  selectedItems: RelItem[],
  cacheKey: (it: RelItem) => string,
  titleFieldFor: (slug: string) => string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  localDB: any,
  baseURL: string,
  token: string | null,
) => {
  const [labelCache, setLabelCache] = useState<Record<string, string>>({})

  useEffect(() => {
    const missing = selectedItems.filter((it) => it.title == null && labelCache[cacheKey(it)] == null)
    if (missing.length === 0) return
    let cancelled = false
    const resolve = async () => {
      const updates: Record<string, string> = {}
      const byCollection: Record<string, string[]> = {}
      for (const it of missing) (byCollection[it.relationTo] ??= []).push(it.id)

      for (const [slug, ids] of Object.entries(byCollection)) {
        const titleField = titleFieldFor(slug)
        const remaining: string[] = []
        const localCollection = localDB?.collections?.[slug]
        if (localCollection) {
          for (const id of ids) {
            try {
              const rxDoc = await localCollection.findOne(id).exec()
              if (rxDoc) updates[`${slug}:${id}`] = docDisplayTitle(rxDoc.toJSON(), titleField)
              else remaining.push(id)
            } catch { remaining.push(id) }
          }
        } else {
          remaining.push(...ids)
        }
        if (remaining.length > 0) {
          try {
            const result = await payloadApi.find({ baseURL, token }, slug, {
              where: { id: { in: remaining } }, limit: remaining.length, depth: 0,
            })
            for (const doc of result.docs) {
              updates[`${slug}:${String(doc.id)}`] = docDisplayTitle(doc, titleField)
            }
          } catch { /* leave ids as labels */ }
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setLabelCache((prev) => ({ ...prev, ...updates }))
      }
    }
    resolve()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, localDB, baseURL, token])

  return { labelCache, setLabelCache }
}
