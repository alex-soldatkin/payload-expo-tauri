// Server / sync settings: shows the active server, logout, change-server, and
// a destructive "reset local data" wired to resetAndResync.
import { useState } from 'react'
import { useLocalDBStatus } from '@payload-universal/local-db'
import { deriveWsURL } from '../lib/settings'

type Props = {
  serverURL: string
  wsURLOverride?: string
  email?: string
  onLogout: () => void
  onChangeServer: () => void
}

export function SettingsScreen({
  serverURL,
  wsURLOverride,
  email,
  onLogout,
  onChangeServer,
}: Props) {
  const { resetAndResync, isResetting } = useLocalDBStatus()
  const [confirmingReset, setConfirmingReset] = useState(false)

  const effectiveWs = deriveWsURL(serverURL, wsURLOverride)

  return (
    <div className="main">
      <div className="main-header">
        <h2>Settings</h2>
      </div>
      <div className="main-scroll">
        <div className="settings">
          <div className="row">
            <span className="k">Server</span>
            <span className="v">{serverURL}</span>
          </div>
          {email && (
            <div className="row">
              <span className="k">Signed in as</span>
              <span className="v">{email}</span>
            </div>
          )}
          <div className="row">
            <span className="k">WebSocket</span>
            <span className="v">
              {effectiveWs ?? '(polling)'}
              {wsURLOverride ? '  (override)' : ''}
            </span>
          </div>

          <p className="warn">
            Each server keeps its own isolated on-device database. Changing the
            server or signing out never deletes another server's local data.
          </p>

          <div className="settings-actions">
            <button onClick={onChangeServer} disabled={isResetting}>
              Change server
            </button>
            <button onClick={onLogout} disabled={isResetting}>
              Log out
            </button>
            <button
              onClick={() => window.payloadDesktop.openWebAdmin()}
              disabled={isResetting}
            >
              Open Web Admin
            </button>
          </div>

          <div className="row">
            <span className="k">Local data</span>
            <p className="warn">
              Reset wipes this server's local database and re-syncs everything
              from scratch. Unsynced local changes will be lost.
            </p>
            {confirmingReset ? (
              <div className="settings-actions">
                <button
                  className="danger"
                  disabled={isResetting}
                  onClick={async () => {
                    await resetAndResync()
                    setConfirmingReset(false)
                  }}
                >
                  {isResetting ? 'Resetting…' : 'Yes, reset & re-sync'}
                </button>
                <button onClick={() => setConfirmingReset(false)} disabled={isResetting}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="settings-actions">
                <button className="danger" onClick={() => setConfirmingReset(true)}>
                  Reset local data
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
