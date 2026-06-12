/**
 * useCollectionCounts — live document counts per collection from local RxDB.
 *
 * Uses RxDB's reactive `count()` query (`query.$`) so each dashboard badge
 * updates instantly as documents sync/insert/delete, without materializing
 * full result sets. Falls back to a one-shot `exec()` if the reactive count
 * observable is unavailable.
 */
import { useEffect, useState } from 'react'

import type { PayloadLocalDB } from '@payload-universal/local-db'

export function useCollectionCounts(
  localDB: PayloadLocalDB | null,
  slugs: string[],
): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({})

  // Stable key so the effect re-runs only when the slug set changes.
  const slugKey = slugs.join(',')

  useEffect(() => {
    if (!localDB) return
    const subs: Array<{ unsubscribe?: () => void }> = []

    const setCount = (slug: string, n: number) => {
      setCounts((prev) => (prev[slug] === n ? prev : { ...prev, [slug]: n }))
    }

    for (const slug of slugKey.split(',').filter(Boolean)) {
      const col = (localDB.collections as Record<string, any>)?.[slug]
      if (!col) continue
      try {
        const query = col.count({ selector: { _deleted: { $eq: false } } })
        if (query?.$?.subscribe) {
          // Reactive count — cheap subscription, no doc materialization
          subs.push(
            query.$.subscribe(
              (n: number) => setCount(slug, n),
              () => {
                /* count stream error — leave the last value */
              },
            ),
          )
        } else if (query?.exec) {
          query
            .exec()
            .then((n: number) => setCount(slug, n))
            .catch(() => {})
        }
      } catch {
        /* count not supported for this collection — skip */
      }
    }

    return () => {
      for (const sub of subs) sub.unsubscribe?.()
    }
  }, [localDB, slugKey])

  return counts
}
