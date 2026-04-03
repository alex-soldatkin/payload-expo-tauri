/**
 * React context provider for the local RxDB database + upload queue.
 *
 * LOCAL-FIRST: The database is made available to consumers as soon as it's
 * created (before replication completes). Persisted SQLite data is available
 * instantly. Replication syncs in the background without blocking the UI.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import type { AdminSchema } from '@payload-universal/admin-schema'
import { createLocalDB, type PayloadLocalDB } from '../database'

export type SyncProgress = {
  /** Total collections being synced */
  total: number
  /** Number of collections finished syncing */
  completed: number
  /** Currently syncing collection slug (or null if idle) */
  current: string | null
}

type LocalDBContextValue = {
  localDB: PayloadLocalDB | null
  isReady: boolean
  error: string | null
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline'
  /** Granular sync progress during initial replication */
  syncProgress: SyncProgress
}

const LocalDBContext = createContext<LocalDBContextValue>({
  localDB: null,
  isReady: false,
  error: null,
  syncStatus: 'idle',
  syncProgress: { total: 0, completed: 0, current: null },
})

export const useLocalDB = () => useContext(LocalDBContext).localDB
export const useLocalDBStatus = () => {
  const ctx = useContext(LocalDBContext)
  return {
    isReady: ctx.isReady,
    error: ctx.error,
    syncStatus: ctx.syncStatus,
    syncProgress: ctx.syncProgress,
  }
}

type Props = {
  children: React.ReactNode
  schema: AdminSchema | null
  baseURL: string
  token: string | null
  /** Pull interval in ms. Defaults to 30000. Only used without wsURL. */
  pullInterval?: number
  /** Custom RxDB storage. Defaults to in-memory. */
  storage?: any
  /** WebSocket URL for real-time sync. When provided, uses WS instead of polling. */
  wsURL?: string
  /** Called when sync progress changes (for toast / splash UI). */
  onSyncProgress?: (progress: SyncProgress) => void
  /** Called when sync completes. */
  onSyncComplete?: () => void
  /** Called when a background sync receives new documents. */
  onSyncUpdate?: (collection: string, count: number) => void
}

export const LocalDBProvider: React.FC<Props> = ({
  children,
  schema,
  baseURL,
  token,
  pullInterval = 30_000,
  storage,
  wsURL,
  onSyncProgress,
  onSyncComplete,
  onSyncUpdate,
}) => {
  const [localDB, setLocalDB] = useState<PayloadLocalDB | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'offline'>('idle')
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    total: 0,
    completed: 0,
    current: null,
  })

  const dbRef = useRef<PayloadLocalDB | null>(null)
  const initRef = useRef(false)
  const tokenRef = useRef(token)
  tokenRef.current = token // always keep ref in sync with latest prop

  useEffect(() => {
    if (!schema || !token || initRef.current) return
    initRef.current = true

    let cancelled = false

    const init = async () => {
      try {
        const db = await createLocalDB({
          schema,
          baseURL,
          token: () => tokenRef.current,
          pullInterval,
          storage,
          wsURL,
        })

        if (cancelled) {
          await db.destroy()
          return
        }

        // Start upload queue auto-processing
        db.uploadQueue.startAutoProcess(15_000)

        dbRef.current = db
        setLocalDB(db)

        // LOCAL-FIRST: Make DB available immediately
        setIsReady(true)

        // Track sync progress for each collection
        const slugs = Object.keys(db.replications)
        const total = slugs.length

        if (total > 0) {
          setSyncStatus('syncing')
          const progress: SyncProgress = { total, completed: 0, current: slugs[0] }
          setSyncProgress(progress)
          onSyncProgress?.(progress)

          // Sync each collection and update progress
          for (const slug of slugs) {
            if (cancelled) break
            const rep = db.replications[slug]
            const p: SyncProgress = { total, completed: progress.completed, current: slug }
            setSyncProgress(p)
            onSyncProgress?.(p)

            try {
              await rep.awaitInitialReplication()

              // Count docs synced for this collection
              try {
                const count = await db.collections[slug]?.count().exec()
                if (count && count > 0) onSyncUpdate?.(slug, count)
              } catch { /* non-fatal */ }
            } catch {
              // Non-fatal — data may be stale but the app is still usable
            }

            progress.completed++
          }

          if (!cancelled) {
            const final: SyncProgress = { total, completed: total, current: null }
            setSyncProgress(final)
            setSyncStatus('idle')
            onSyncProgress?.(final)
            onSyncComplete?.()
          }
        } else if (wsURL) {
          // WS sync — no polling replications to track, just mark idle
          setSyncStatus('idle')
          onSyncComplete?.()
        }

      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize local database')
          setSyncStatus('error')
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [schema, token, baseURL, pullInterval, storage, wsURL])

  // Clean up on unmount (or hot reload)
  useEffect(() => {
    return () => {
      if (dbRef.current) {
        dbRef.current.destroy().catch(() => {})
        dbRef.current = null
      }
      // Reset so the init effect can re-run after a hot reload
      initRef.current = false
      setLocalDB(null)
      setIsReady(false)
    }
  }, [])

  return (
    <LocalDBContext.Provider value={{ localDB, isReady, error, syncStatus, syncProgress }}>
      {children}
    </LocalDBContext.Provider>
  )
}
