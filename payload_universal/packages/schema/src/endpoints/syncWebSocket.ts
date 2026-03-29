/**
 * WebSocket sync server — pushes real-time change notifications to connected clients.
 *
 * Architecture:
 *   1. Payload afterChange/afterDelete hooks call `broadcastChange()`
 *   2. Connected clients receive lightweight notifications: { collection, id, updatedAt }
 *   3. Clients diff against local state and selectively pull only what's needed
 *
 * The WS server runs alongside the Next.js server on a separate port.
 * Clients authenticate by sending a JWT token in the first message.
 *
 * On reconnect, the client sends its last checkpoint and the server
 * pushes a catchup diff of everything missed.
 */
import type { Payload } from 'payload'

// ws types — the actual WebSocketServer is injected at runtime by the consuming
// server app (which has `ws` installed). This file only defines the logic.
type WebSocketLike = {
  readyState: number
  send: (data: string) => void
  close: (code?: number, reason?: string) => void
  terminate: () => void
  ping: () => void
  on: (event: string, handler: (...args: any[]) => void) => void
  onopen: ((event: any) => void) | null
  onmessage: ((event: any) => void) | null
  onclose: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
}
const WS_OPEN = 1

export type SyncChangeEvent = {
  type: 'change'
  collection: string
  id: string
  updatedAt: string
  _deleted?: boolean
}

export type SyncCatchupRequest = {
  type: 'catchup'
  checkpoints: Record<string, { updatedAt: string; id: string }>
}

type AuthenticatedClient = {
  ws: WebSocket
  userId: string
  alive: boolean
}

let clients: AuthenticatedClient[] = []
let wss: any = null
let payload: Payload | null = null

/**
 * Broadcast a change event to all connected, authenticated clients.
 * Called from Payload afterChange / afterDelete hooks.
 */
export function broadcastChange(event: SyncChangeEvent): void {
  const msg = JSON.stringify(event)
  for (const client of clients) {
    if (client.ws.readyState === WS_OPEN) {
      client.ws.send(msg)
    }
  }
}

/**
 * Handle a catchup request — send the client all changes since their checkpoints.
 */
async function handleCatchup(client: AuthenticatedClient, request: SyncCatchupRequest): Promise<void> {
  if (!payload) return

  for (const [collectionSlug, checkpoint] of Object.entries(request.checkpoints)) {
    try {
      const result = await payload.find({
        collection: collectionSlug as any,
        where: { updatedAt: { greater_than: checkpoint.updatedAt } },
        sort: 'updatedAt',
        limit: 500,
        depth: 0,
        select: { id: true, updatedAt: true },
        overrideAccess: true,
      })

      for (const doc of result.docs as any[]) {
        const event: SyncChangeEvent = {
          type: 'change',
          collection: collectionSlug,
          id: String(doc.id),
          updatedAt: doc.updatedAt,
        }
        if (client.ws.readyState === WS_OPEN) {
          client.ws.send(JSON.stringify(event))
        }
      }

      // Also check tombstones
      try {
        const tombResult = await payload.find({
          collection: '_sync_tombstones' as any,
          where: {
            and: [
              { sourceCollection: { equals: collectionSlug } },
              { deletedAt: { greater_than: checkpoint.updatedAt } },
            ],
          },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })
        for (const tomb of tombResult.docs as any[]) {
          const event: SyncChangeEvent = {
            type: 'change',
            collection: collectionSlug,
            id: String(tomb.docId),
            updatedAt: tomb.deletedAt,
            _deleted: true,
          }
          if (client.ws.readyState === WS_OPEN) {
            client.ws.send(JSON.stringify(event))
          }
        }
      } catch {
        // Tombstone collection may not exist
      }
    } catch (err) {
      // Non-fatal — client will retry on next cycle
    }
  }
}

/** Token verifier — injected by the consuming server at startup. */
let _verifyToken: ((token: string) => Promise<string | null>) | null = null

/** Set the token verification function. Called by the server's instrumentation. */
export function setSyncTokenVerifier(fn: (token: string) => Promise<string | null>): void {
  _verifyToken = fn
}

async function verifyToken(token: string): Promise<string | null> {
  if (_verifyToken) return _verifyToken(token)
  // Fallback: trust the token (development only — should always set a real verifier)
  return 'anonymous'
}

/**
 * Start the WebSocket sync server.
 *
 * The caller creates the WebSocketServer (since the `ws` package is a
 * server-side dependency) and passes it in. This function wires up the
 * auth, message handling, heartbeat, and change broadcasting.
 *
 * @param payloadInstance — the initialized Payload instance
 * @param webSocketServer — a `new WebSocketServer({ port })` instance
 */
export function startSyncWebSocketServer(
  payloadInstance: Payload,
  webSocketServer: any,
): void {
  payload = payloadInstance
  wss = webSocketServer

  // Heartbeat to detect stale connections
  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) {
        client.ws.terminate()
        continue
      }
      client.alive = false
      client.ws.ping()
    }
    clients = clients.filter((c) => c.ws.readyState !== 3 /* CLOSED */)
  }, 30_000)

  wss.on('close', () => clearInterval(heartbeat))

  wss.on('connection', (ws: any) => {
    let authenticated = false
    let client: AuthenticatedClient | null = null

    // Client must send auth token as first message
    const authTimeout = setTimeout(() => {
      if (!authenticated) ws.close(4001, 'Auth timeout')
    }, 10_000)

    ws.on('pong', () => {
      if (client) client.alive = true
    })

    ws.on('message', async (data: any) => {
      try {
        const msg = JSON.parse(data.toString())

        if (!authenticated) {
          if (msg.type === 'auth' && msg.token) {
            const userId = await verifyToken(msg.token)
            if (userId) {
              authenticated = true
              clearTimeout(authTimeout)
              client = { ws, userId, alive: true }
              clients.push(client)
              ws.send(JSON.stringify({ type: 'auth_ok' }))
            } else {
              ws.close(4003, 'Invalid token')
            }
          } else {
            ws.close(4002, 'Auth required')
          }
          return
        }

        if (msg.type === 'catchup' && msg.checkpoints && client) {
          await handleCatchup(client, msg)
        }
      } catch {
        // Malformed message
      }
    })

    ws.on('close', () => {
      clearTimeout(authTimeout)
      clients = clients.filter((c) => c.ws !== ws)
    })
  })

  payloadInstance.logger.info('Sync WebSocket server started')
}

/**
 * Create Payload hooks that broadcast changes to connected WS clients.
 * Inject these into every synced collection's hooks.
 */
export function createSyncHooks(collectionSlug: string) {
  return {
    afterChange: [
      ({ doc, operation }: { doc: any; operation: string }) => {
        broadcastChange({
          type: 'change',
          collection: collectionSlug,
          id: String(doc.id),
          updatedAt: doc.updatedAt ?? new Date().toISOString(),
        })
        return doc
      },
    ],
    afterDelete: [
      ({ doc }: { doc: any }) => {
        broadcastChange({
          type: 'change',
          collection: collectionSlug,
          id: String(doc.id),
          updatedAt: new Date().toISOString(),
          _deleted: true,
        })
        return doc
      },
    ],
  }
}
