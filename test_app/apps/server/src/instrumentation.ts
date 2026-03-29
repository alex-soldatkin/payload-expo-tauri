/**
 * Next.js instrumentation — runs once when the server starts.
 * Starts the WebSocket sync server alongside the Payload API.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { WebSocketServer } = await import('ws')
      const jwt = await import('jsonwebtoken')
      const { getPayload } = await import('payload')
      const { startSyncWebSocketServer, setSyncTokenVerifier } = await import(
        '@payload-universal/schema'
      )

      const payload = await getPayload({
        config: (await import('./payload.config')).default,
      })

      // Inject JWT verifier so the WS server can authenticate clients
      setSyncTokenVerifier(async (token: string) => {
        try {
          const decoded = jwt.default.verify(token, payload.secret) as {
            id: string
            collection: string
          }
          return decoded?.id ?? null
        } catch {
          return null
        }
      })

      const wsPort = Number(process.env.SYNC_WS_PORT) || 3001
      const wss = new WebSocketServer({ port: wsPort })
      startSyncWebSocketServer(payload, wss)
      console.log(`Sync WebSocket server listening on port ${wsPort}`)
    } catch (err) {
      console.error('Failed to start sync WebSocket server:', err)
    }
  }
}
