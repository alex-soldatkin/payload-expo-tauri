/**
 * WebSocket-driven sync — PULL ONLY.
 *
 * Receives real-time change notifications from the server via WebSocket.
 * When a change is received, fetches the full doc via /sync/pull and
 * upserts it into the local RxDB.
 *
 * Push is handled by the polling replication (replication.ts) which
 * uses RxDB's built-in push handler with proper conflict detection.
 * This avoids the infinite loop caused by having two independent push paths.
 */
import type { RxCollection } from 'rxdb'
import type { PayloadDoc } from '../utils/schemaFromPayload'

export type SyncReplicationConfig = {
  baseURL: string
  wsURL: string
  token: string | null | (() => string | null)
  collections: Record<string, RxCollection<PayloadDoc>>
}

type ChangeEvent = {
  type: 'change'
  collection: string
  id: string
  updatedAt: string
  _deleted?: boolean
}

type Checkpoint = { updatedAt: string; id: string }

export type SyncReplicationState = {
  destroy: () => void
  readonly connected: boolean
}

const buildHeaders = (token: string | null): Record<string, string> => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...(token ? { Authorization: `JWT ${token}` } : {}),
})

export function startSyncReplication(config: SyncReplicationConfig): SyncReplicationState {
  const { baseURL, wsURL, token: tokenOrGetter, collections } = config

  const getToken = (): string | null =>
    typeof tokenOrGetter === 'function' ? tokenOrGetter() : tokenOrGetter

  let ws: WebSocket | null = null
  let destroyed = false
  let connected = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const checkpoints: Record<string, Checkpoint> = {}

  // ------------------------------------------------------------------
  // PULL: Handle incoming change notifications
  // ------------------------------------------------------------------

  async function handleChangeEvent(event: ChangeEvent): Promise<void> {
    const { collection: slug, id, updatedAt, _deleted } = event
    const col = collections[slug]
    if (!col) return

    const localDoc = await col.findOne(id).exec()
    const localData = localDoc ? localDoc.toJSON(true) : null

    if (localData) {
      // Skip if locally modified — our version takes precedence
      if ((localData as any)._locallyModified) return
      // Skip if already up-to-date
      if (localData.updatedAt === updatedAt && !_deleted) return
    }

    if (_deleted) {
      if (localDoc && !(localData as any)?._locallyModified) {
        await localDoc.incrementalPatch({ _deleted: true } as any)
      }
      return
    }

    // Fetch the full document
    try {
      const res = await fetch(`${baseURL}/api/${slug}/${id}?depth=0`, {
        headers: buildHeaders(getToken()),
      })
      if (!res.ok) return
      const serverDoc = await res.json()
      if (!serverDoc) return

      await col.upsert({
        ...serverDoc,
        id: String(serverDoc.id),
        _deleted: false,
        _locallyModified: false,
      } as any)
    } catch {
      // Network error — will retry on next event
    }
  }

  // ------------------------------------------------------------------
  // WEBSOCKET CONNECTION (pull-only)
  // ------------------------------------------------------------------

  function connect(): void {
    if (destroyed) return

    try {
      ws = new WebSocket(wsURL)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      connected = true
      ws!.send(JSON.stringify({ type: 'auth', token: getToken() }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : '')

        if (msg.type === 'auth_ok') {
          // Send catchup request
          const catchupCheckpoints: Record<string, Checkpoint> = {}
          for (const slug of Object.keys(collections)) {
            catchupCheckpoints[slug] = checkpoints[slug] ?? {
              updatedAt: '1970-01-01T00:00:00.000Z',
              id: '',
            }
          }
          ws!.send(JSON.stringify({ type: 'catchup', checkpoints: catchupCheckpoints }))
          return
        }

        if (msg.type === 'change') {
          const cp = checkpoints[msg.collection]
          if (!cp || msg.updatedAt > cp.updatedAt || (msg.updatedAt === cp.updatedAt && msg.id > cp.id)) {
            checkpoints[msg.collection] = { updatedAt: msg.updatedAt, id: msg.id }
          }
          handleChangeEvent(msg as ChangeEvent)
          return
        }
      } catch {
        // Malformed message
      }
    }

    ws.onclose = () => {
      connected = false
      if (!destroyed) scheduleReconnect()
    }

    ws.onerror = () => {
      connected = false
      ws?.close()
    }
  }

  function scheduleReconnect(): void {
    if (destroyed || reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, 3000)
  }

  connect()

  return {
    get connected() {
      return connected
    },
    destroy() {
      destroyed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
      ws = null
    },
  }
}
