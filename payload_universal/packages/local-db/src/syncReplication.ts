/**
 * WebSocket-driven sync replication engine.
 *
 * Replaces the polling-based replication with a real-time push model:
 *   1. WS connection receives lightweight change notifications
 *   2. Client diffs against local state, selectively pulls only changed docs
 *   3. Local writes are pushed via /sync/push with field-level three-way merge
 *   4. On reconnect, requests catchup of missed changes
 *
 * Conflict resolution:
 *   - Field-level three-way merge (non-conflicting fields merge automatically)
 *   - True conflicts (same field changed both places): client wins
 *   - _locallyModified flag tracks which docs have unpushed local changes
 */
import type { RxCollection } from 'rxdb'
import type { PayloadDoc } from './schemaFromPayload'

// ------------------------------------------------------------------ types

export type SyncReplicationConfig = {
  baseURL: string
  wsURL: string
  token: string | null
  collections: Record<string, RxCollection<PayloadDoc>>
  /** Push debounce in ms. Default 1000. */
  pushDebounce?: number
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
  /** Stop all sync and close the WebSocket */
  destroy: () => void
  /** Push all locally-modified documents now */
  pushNow: () => Promise<void>
  /** Current connection status */
  readonly connected: boolean
}

// ------------------------------------------------------------------ helpers

const buildHeaders = (token: string | null): Record<string, string> => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...(token ? { Authorization: `JWT ${token}` } : {}),
})

// ------------------------------------------------------------------ main

export function startSyncReplication(config: SyncReplicationConfig): SyncReplicationState {
  const { baseURL, wsURL, token, collections, pushDebounce = 1000 } = config

  let ws: WebSocket | null = null
  let destroyed = false
  let connected = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let pushTimer: ReturnType<typeof setTimeout> | null = null

  // Per-collection checkpoints (persisted in-memory; on restart, catchup from epoch)
  const checkpoints: Record<string, Checkpoint> = {}

  // Track RxDB change subscriptions for push
  const changeSubs: Array<{ unsubscribe: () => void }> = []

  // ------------------------------------------------------------------
  // PULL: Handle incoming change notifications
  // ------------------------------------------------------------------

  async function handleChangeEvent(event: ChangeEvent): Promise<void> {
    const { collection: slug, id, updatedAt, _deleted } = event
    const col = collections[slug]
    if (!col) return

    // Check if we have this doc locally
    const localDoc = await col.findOne(id).exec()
    const localDocData = localDoc ? localDoc.toJSON(true) : null

    if (localDocData) {
      // Skip if locally modified — our version takes precedence
      if ((localDocData as any)._locallyModified) return

      // Skip if our local version is already up-to-date
      if (localDocData.updatedAt === updatedAt && !_deleted) return
    }

    if (_deleted) {
      // Remote deletion — soft-delete locally if not locally modified
      if (localDoc && !(localDocData as any)?._locallyModified) {
        await localDoc.incrementalPatch({ _deleted: true } as any)
      }
      return
    }

    // Fetch the full document via selective pull
    try {
      const res = await fetch(`${baseURL}/api/sync/pull`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({ collection: slug, ids: [id] }),
      })
      if (!res.ok) return

      const data = await res.json()
      const serverDoc = data.docs?.[0]
      if (!serverDoc) return

      // Upsert into local RxDB
      await col.upsert({
        ...serverDoc,
        id: String(serverDoc.id),
        _deleted: false,
        _locallyModified: false,
      } as any)
    } catch {
      // Network error — will retry on next event or reconnect catchup
    }
  }

  // ------------------------------------------------------------------
  // PUSH: Send locally-modified documents to the server
  // ------------------------------------------------------------------

  async function pushLocalChanges(): Promise<void> {
    for (const [slug, col] of Object.entries(collections)) {
      try {
        // Find all locally-modified, non-deleted documents
        const modifiedDocs = await col.find({
          selector: { _locallyModified: { $eq: true }, _deleted: { $eq: false } },
        }).exec()

        if (modifiedDocs.length === 0) continue

        const writes = modifiedDocs.map((rxDoc) => {
          const doc = rxDoc.toJSON(true) // include meta
          // The assumed master state is what we last saw from the server
          // RxDB stores this internally; we approximate with the doc minus local changes
          // For proper three-way merge, we need the base version
          const base = (rxDoc as any)._meta?.lwt
            ? { ...doc, updatedAt: (rxDoc as any)._syncBase?.updatedAt ?? doc.updatedAt }
            : null

          return {
            doc: stripRxDBFields(doc),
            base: base ? stripRxDBFields(base) : null,
          }
        })

        const res = await fetch(`${baseURL}/api/sync/push`, {
          method: 'POST',
          headers: buildHeaders(token),
          body: JSON.stringify({ collection: slug, writes }),
        })

        if (!res.ok) continue

        const data = await res.json()

        // Clear _locallyModified for successfully pushed documents
        for (const result of data.results ?? []) {
          if (result.status === 'created' || result.status === 'updated' || result.status === 'merged') {
            const rxDoc = await col.findOne(result.id).exec()
            if (rxDoc) {
              await rxDoc.incrementalPatch({ _locallyModified: false } as any)
            }
          }
        }
      } catch {
        // Network error — will retry on next push cycle
      }
    }
  }

  function stripRxDBFields(doc: Record<string, unknown>): Record<string, unknown> {
    const { _deleted, _rev, _meta, _attachments, _locallyModified, _syncBase, ...clean } = doc as any
    return clean
  }

  // Debounced push — triggered when local changes are detected
  function schedulePush(): void {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      if (!destroyed) pushLocalChanges()
    }, pushDebounce)
  }

  // ------------------------------------------------------------------
  // WEBSOCKET CONNECTION
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
      // Authenticate
      ws!.send(JSON.stringify({ type: 'auth', token }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : '')

        if (msg.type === 'auth_ok') {
          // Send catchup request for all collections
          const catchupCheckpoints: Record<string, Checkpoint> = {}
          for (const slug of Object.keys(collections)) {
            catchupCheckpoints[slug] = checkpoints[slug] ?? {
              updatedAt: '1970-01-01T00:00:00.000Z',
              id: '',
            }
          }
          ws!.send(JSON.stringify({ type: 'catchup', checkpoints: catchupCheckpoints }))

          // Also push any pending local changes
          pushLocalChanges()
          return
        }

        if (msg.type === 'change') {
          // Update checkpoint
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

  // ------------------------------------------------------------------
  // SUBSCRIBE TO LOCAL CHANGES (for push)
  // ------------------------------------------------------------------

  for (const [slug, col] of Object.entries(collections)) {
    const sub = col.$.subscribe((changeEvent) => {
      // Any local write triggers a debounced push
      schedulePush()
    })
    changeSubs.push(sub)
  }

  // ------------------------------------------------------------------
  // START
  // ------------------------------------------------------------------

  connect()

  // ------------------------------------------------------------------
  // PUBLIC API
  // ------------------------------------------------------------------

  return {
    get connected() {
      return connected
    },
    pushNow: pushLocalChanges,
    destroy() {
      destroyed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (pushTimer) clearTimeout(pushTimer)
      for (const sub of changeSubs) sub.unsubscribe()
      ws?.close()
      ws = null
    },
  }
}
