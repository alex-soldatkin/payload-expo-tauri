// Bottom status bar: online/offline · sync status + initial progress ·
// queued (locally-modified) changes for the active collection.
import { useEffect, useState } from 'react'
import { useLocalDB, useLocalDBStatus, useLocalQuery } from '@payload-universal/local-db'
import { UploadQueuePanel } from './uploads/UploadQueuePanel'

type Props = {
  activeSlug: string | null
  onOpenSettings: () => void
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function StatusBar({ activeSlug, onOpenSettings }: Props) {
  const online = useOnline()
  const localDB = useLocalDB()
  const { syncStatus, syncProgress } = useLocalDBStatus()

  // Queued (unsynced) changes for the active collection. useLocalQuery takes a
  // full MangoQuery; querying a null slug returns an empty result set.
  const { docs: queued } = useLocalQuery(localDB, activeSlug ?? '__none__', {
    selector: { _locallyModified: true },
  })
  const queuedCount = activeSlug ? queued.length : 0

  const syncCell = (() => {
    if (syncStatus === 'error') return { cls: 'error', text: 'Sync error' }
    if (syncStatus === 'syncing') {
      const pct =
        syncProgress.total > 0
          ? ` ${syncProgress.percent}%`
          : ''
      return { cls: 'syncing', text: `Syncing${pct}` }
    }
    if (syncStatus === 'offline') return { cls: 'offline', text: 'Offline sync' }
    return { cls: 'online', text: 'Synced' }
  })()

  return (
    <div className="statusbar">
      <div className="cell">
        <span className={`status-dot ${online ? 'online' : 'offline'}`} />
        {online ? 'Online' : 'Offline'}
      </div>

      <div className="cell">
        <span className={`status-dot ${syncCell.cls}`} />
        {syncCell.text}
        {syncStatus === 'syncing' && syncProgress.total > 0 && (
          <span>
            {' '}
            ({syncProgress.completed}/{syncProgress.total})
          </span>
        )}
      </div>

      <div className="cell">
        {queuedCount > 0
          ? `${queuedCount} unsynced change${queuedCount === 1 ? '' : 's'}`
          : 'No pending changes'}
      </div>

      <UploadQueuePanel />

      <div className="spacer" />

      <button onClick={() => window.payloadDesktop.openWebAdmin()}>Web Admin</button>
      <button onClick={onOpenSettings}>Settings</button>
    </div>
  )
}
