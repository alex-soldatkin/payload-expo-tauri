// Watches sync status transitions and surfaces them as toasts — the desktop
// twin of the mobile SyncToastBridge: syncing→idle = success, →error = error.
import { useEffect, useRef } from 'react'
import { useLocalDBStatus } from '@payload-universal/local-db'
import { useToast } from './ToastProvider'

export function SyncToastBridge() {
  const { showToast } = useToast()
  const { syncStatus } = useLocalDBStatus()
  const prev = useRef(syncStatus)

  useEffect(() => {
    if (prev.current === 'syncing' && syncStatus === 'idle') {
      showToast('Sync complete', { type: 'success', duration: 2000 })
    }
    if (syncStatus === 'error' && prev.current !== 'error') {
      showToast('Sync error — using local data', { type: 'error' })
    }
    prev.current = syncStatus
  }, [syncStatus, showToast])

  return null
}
