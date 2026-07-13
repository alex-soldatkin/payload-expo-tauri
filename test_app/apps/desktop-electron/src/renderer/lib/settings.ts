// Per-server settings + URL derivation helpers.
//
// Mirrors the mobile `_layout.tsx` WebSocket convention: a `wss://<host>/ws`
// URL for https servers, or `ws://<hostname>:3001` for http dev servers.

export type DesktopSettings = {
  serverURL?: string
  wsURLOverride?: string
  token?: string
  email?: string
}

/**
 * Derive the sync WebSocket URL for a server.
 *   - explicit override wins
 *   - https:  →  wss://<host>/ws            (host includes any :port)
 *   - http:   →  ws://<hostname>:<port+1>   (dev convention: WS runs next to
 *                the server — 3050 → 3051; without an explicit port, 3001)
 */
export function deriveWsURL(serverURL: string, override?: string): string | undefined {
  if (override && override.trim()) return override.trim()
  let url: URL
  try {
    url = new URL(serverURL)
  } catch {
    return undefined
  }
  if (url.protocol === 'https:') {
    return `wss://${url.host}/ws`
  }
  if (url.protocol === 'http:') {
    const wsPort = url.port ? Number(url.port) + 1 : 3001
    return `ws://${url.hostname}:${wsPort}`
  }
  return undefined
}

/**
 * A filesystem/DB-safe slug for a server URL (host + port), used as the
 * per-server SQLite database name prefix so each server keeps an isolated
 * local database.
 */
export function serverSlug(serverURL: string): string {
  let host = serverURL
  try {
    host = new URL(serverURL).host || serverURL
  } catch {
    // fall through — use the raw string
  }
  return host.replace(/[^A-Za-z0-9._-]/g, '_')
}

/** Normalise a user-entered server URL (trim, strip trailing slashes). */
export function normalizeServerURL(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}
