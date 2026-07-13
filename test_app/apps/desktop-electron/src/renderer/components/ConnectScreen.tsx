// First-run screen: pick the self-hosted Payload deployment to sync against.
import { useState } from 'react'
import { normalizeServerURL } from '../lib/settings'

// Clearly-marked placeholder — swap for the real hosted deployment URL.
export const HOSTED_URL = 'https://app.payload-universal.example'
const LOCAL_DEV_URL = 'http://127.0.0.1:3050'

type Props = {
  initialURL?: string
  initialWsOverride?: string
  onConnect: (serverURL: string, wsURLOverride?: string) => void
}

export function ConnectScreen({ initialURL, initialWsOverride, onConnect }: Props) {
  const [url, setUrl] = useState(initialURL ?? '')
  const [wsOverride, setWsOverride] = useState(initialWsOverride ?? '')
  const [showAdvanced, setShowAdvanced] = useState(Boolean(initialWsOverride))
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const normalized = normalizeServerURL(url)
    if (!normalized) {
      setError('Enter a server URL.')
      return
    }
    try {
      const parsed = new URL(normalized)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setError('URL must start with http:// or https://')
        return
      }
    } catch {
      setError('That does not look like a valid URL.')
      return
    }
    onConnect(normalized, wsOverride.trim() || undefined)
  }

  return (
    <div className="screen">
      <div className="screen-drag" />
      <div className="screen-body">
        <div className="card">
          <h1>Connect to your Payload</h1>
          <p className="muted">
            This desktop app is a local-first client. Your data lives in an
            isolated on-device database and syncs to a self-hosted Payload
            deployment. Each server keeps its own separate local database — sign
            in to the tenant you own.
          </p>

          <div className="field">
            <label htmlFor="server-url">Server deployment URL</label>
            <input
              id="server-url"
              placeholder="https://your-payload.example.com"
              value={url}
              autoFocus
              spellCheck={false}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          <div className="preset-row">
            <button onClick={() => setUrl(HOSTED_URL)} title={HOSTED_URL}>
              Hosted (placeholder)
            </button>
            <button onClick={() => setUrl(LOCAL_DEV_URL)} title={LOCAL_DEV_URL}>
              Local dev
            </button>
          </div>

          <button className="link" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? 'Hide advanced' : 'Advanced'}
          </button>
          {showAdvanced && (
            <div className="field">
              <label htmlFor="ws-url">WebSocket URL override (optional)</label>
              <input
                id="ws-url"
                placeholder="wss://your-payload.example.com/ws"
                value={wsOverride}
                spellCheck={false}
                onChange={(e) => setWsOverride(e.target.value)}
              />
            </div>
          )}

          {error && <div className="error-box">{error}</div>}

          <button className="primary" onClick={submit}>
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
