/**
 * React context provider for the local RxDB database + upload queue.
 *
 * Initializes the database when the admin schema is available,
 * starts replication + upload queue auto-processing,
 * and provides everything to the component tree via context.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

import type { AdminSchema } from '@payload-universal/admin-schema'
import { createLocalDB, type PayloadLocalDB } from './database'

type LocalDBContextValue = {
  localDB: PayloadLocalDB | null
  isReady: boolean
  error: string | null
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline'
}

const LocalDBContext = createContext<LocalDBContextValue>({
  localDB: null,
  isReady: false,
  error: null,
  syncStatus: 'idle',
})

export const useLocalDB = () => useContext(LocalDBContext).localDB
export const useLocalDBStatus = () => {
  const ctx = useContext(LocalDBContext)
  return {
    isReady: ctx.isReady,
    error: ctx.error,
    syncStatus: ctx.syncStatus,
  }
}

type Props = {
  children: React.ReactNode
  schema: AdminSchema | null
  baseURL: string
  token: string | null
  /** Pull interval in ms. Defaults to 30000. */
  pullInterval?: number
  /** Custom RxDB storage. Defaults to in-memory. */
  storage?: any
}

export const LocalDBProvider: React.FC<Props> = ({
  children,
  schema,
  baseURL,
  token,
  pullInterval = 30_000,
  storage,
}) => {
  const [localDB, setLocalDB] = useState<PayloadLocalDB | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'offline'>('idle')

  const dbRef = useRef<PayloadLocalDB | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (!schema || !token || initRef.current) return
    initRef.current = true

    let cancelled = false

    const init = async () => {
      try {
        setSyncStatus('syncing')
        const db = await createLocalDB({
          schema,
          baseURL,
          token,
          pullInterval,
          storage,
        })

        if (cancelled) {
          await db.destroy()
          return
        }

        // Start upload queue auto-processing
        db.uploadQueue.startAutoProcess(15_000)

        dbRef.current = db
        setLocalDB(db)
        setIsReady(true)
        setSyncStatus('idle')

        // Wait for initial pull to complete for all collections
        const pullPromises = Object.values(db.replications).map(async (rep) => {
          try {
            await rep.awaitInitialReplication()
          } catch {
            // Non-fatal
          }
        })
        await Promise.allSettled(pullPromises)

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
  }, [schema, token, baseURL, pullInterval, storage])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (dbRef.current) {
        dbRef.current.destroy().catch(() => {})
        dbRef.current = null
      }
    }
  }, [])

  return (
    <LocalDBContext.Provider value={{ localDB, isReady, error, syncStatus }}>
      {children}
    </LocalDBContext.Provider>
  )
}
