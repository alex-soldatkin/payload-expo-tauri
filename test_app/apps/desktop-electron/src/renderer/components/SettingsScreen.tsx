// Server / sync settings: shows the active server, logout, change-server, and
// a destructive "reset local data" wired to resetAndResync.
import { useEffect, useState } from 'react'
import { useLocalDBStatus } from '@payload-universal/local-db'
import { deriveWsURL } from '../lib/settings'
import { applyTheme, THEME_CHOICES, type ThemeChoice } from '../lib/theme'

const THEME_LABELS: Record<ThemeChoice, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

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

  // Theme choice is self-contained here: read the persisted value on mount,
  // then persist + apply immediately on change (write-through, like the boot
  // path in main.tsx). 'system' clears the override so the OS wins.
  const [theme, setTheme] = useState<ThemeChoice>('system')
  useEffect(() => {
    let cancelled = false
    window.payloadDesktop
      .getSettings()
      .then((s) => {
        if (!cancelled) setTheme((s.theme as ThemeChoice) ?? 'system')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const chooseTheme = (next: ThemeChoice) => {
    setTheme(next)
    applyTheme(next)
    void window.payloadDesktop.setSettings({ theme: next }).catch(() => {})
  }

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
            <span className="k">Appearance</span>
            {/* Three-way segmented control; reuses the .chip.toggle pill look. */}
            <div className="theme-seg" role="radiogroup" aria-label="Theme">
              {THEME_CHOICES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={theme === c}
                  className={`chip toggle${theme === c ? ' on' : ''}`}
                  onClick={() => chooseTheme(c)}
                >
                  {THEME_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
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
