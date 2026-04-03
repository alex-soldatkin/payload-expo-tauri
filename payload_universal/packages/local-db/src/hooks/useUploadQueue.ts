/**
 * React hook for accessing the pending upload queue reactively.
 * Returns a live-updating list of queue items with their statuses.
 */
import { useCallback, useContext, useEffect, useState } from 'react'
import type { RxDocument } from 'rxdb'
import type { PendingUploadItem } from '../queue/uploadQueue'
import type { PayloadLocalDB } from '../database'

export type UsePendingUploadsResult = {
  items: PendingUploadItem[]
  pendingCount: number
  uploadingCount: number
  completedCount: number
  errorCount: number
  isProcessing: boolean
  retry: (id: string) => Promise<void>
  retryAll: () => Promise<void>
  remove: (id: string) => Promise<void>
  clearCompleted: () => Promise<void>
}

export const usePendingUploads = (
  localDB: PayloadLocalDB | null,
): UsePendingUploadsResult => {
  const [items, setItems] = useState<PendingUploadItem[]>([])

  const uploadCollection = localDB?.uploadCollection
  const uploadQueue = localDB?.uploadQueue

  useEffect(() => {
    if (!uploadCollection) return

    const sub = uploadCollection
      .find({ sort: [{ createdAt: 'desc' }] })
      .$.subscribe({
        next: (results) => {
          setItems(results.map((r: RxDocument<PendingUploadItem>) => r.toJSON() as PendingUploadItem))
        },
        error: () => {},
      })

    return () => sub.unsubscribe()
  }, [uploadCollection])

  const counts = items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return {
    items,
    pendingCount: counts.pending ?? 0,
    uploadingCount: counts.uploading ?? 0,
    completedCount: counts.completed ?? 0,
    errorCount: counts.error ?? 0,
    isProcessing: (counts.uploading ?? 0) > 0,
    retry: useCallback(
      async (id: string) => { await uploadQueue?.retry(id) },
      [uploadQueue],
    ),
    retryAll: useCallback(
      async () => { await uploadQueue?.retryAll() },
      [uploadQueue],
    ),
    remove: useCallback(
      async (id: string) => { await uploadQueue?.remove(id) },
      [uploadQueue],
    ),
    clearCompleted: useCallback(
      async () => { await uploadQueue?.clearCompleted() },
      [uploadQueue],
    ),
  }
}
