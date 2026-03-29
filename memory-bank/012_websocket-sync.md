# WebSocket Sync Architecture (2026-03-29)

## Overview
Real-time bidirectional sync between Payload CMS (MongoDB) and Expo mobile app (RxDB/SQLite).
Designed for offline-first lab notebook use case where scientists lose connectivity in the lab.

## Server Components

### Sync Endpoints (auto-registered via createPayloadConfig)
```
GET  /api/sync/diff   — lightweight {id, updatedAt} manifests since checkpoint
POST /api/sync/pull   — selective full-doc fetch by specific IDs
POST /api/sync/push   — push with field-level three-way merge
```

### WebSocket Server (port 3001)
- Started via Next.js instrumentation (`apps/server/src/instrumentation.ts`)
- Uses `ws` package (Node.js WebSocket server)
- JWT authentication on first message
- Broadcasts change events from `afterChange`/`afterDelete` hooks
- Catchup on reconnect: sends missed changes since client's last checkpoint
- Heartbeat every 30s to detect stale connections

### File Layout
```
payload_universal/packages/schema/src/endpoints/
  syncDiff.ts         — GET /api/sync/diff handler
  syncPull.ts         — POST /api/sync/pull handler
  syncPush.ts         — POST /api/sync/push handler + three-way merge logic
  syncWebSocket.ts    — WS server, broadcastChange(), createSyncHooks()
  syncTombstones.ts   — _sync_tombstones collection config + afterDelete hook
```

### Hook Injection
`createPayloadConfig` automatically injects into every user collection:
- `afterChange` → broadcasts WS change event
- `afterDelete` → broadcasts WS delete event + writes tombstone record

## Client Components

### syncReplication.ts (local-db package)
Replaces polling-based replication when `wsURL` is provided to `createLocalDB()`.

**WS message flow:**
```
Client → { type: "auth", token: "JWT..." }
Server → { type: "auth_ok" }
Client → { type: "catchup", checkpoints: { posts: {updatedAt, id}, ... } }
Server → { type: "change", collection: "posts", id: "abc", updatedAt: "..." } (×N)
         (ongoing real-time events as other clients/web admin make changes)
```

**Pull path (server → client):**
1. Receive WS `change` event
2. Check local RxDB: skip if `_locallyModified === true`
3. Skip if local `updatedAt` already matches
4. Fetch full doc via `POST /api/sync/pull`
5. Upsert into local RxDB with `_locallyModified: false`

**Push path (client → server):**
1. Local write sets `_locallyModified: true`
2. RxDB change subscription triggers debounced push (1s)
3. Find all docs with `_locallyModified: true`
4. `POST /api/sync/push` with `{ doc, base }` for each
5. Server performs three-way merge, returns results
6. Clear `_locallyModified` on success

## Field-Level Three-Way Merge

### Algorithm (in syncPush.ts)
Given three versions of a document:
- **base**: last-known server state (common ancestor)
- **client**: current local document
- **server**: current server document

For each field:
```
clientChanged = (client[field] !== base[field])
serverChanged = (server[field] !== base[field])

if clientChanged && !serverChanged  → use client value
if !clientChanged && serverChanged  → use server value (keep)
if clientChanged && serverChanged:
  if client[field] === server[field] → no conflict (same change)
  else                               → CLIENT WINS (offline edits take precedence)
if neither changed                  → keep as-is
```

### Lab Notebook Scenario
1. Scientist goes into lab (offline), edits "notes" and "results" fields
2. Colleague on web admin edits "status" field on same document
3. Scientist comes back online, WS reconnects
4. Push fires: `base` = pre-offline version, `client` = scientist's version, `server` = colleague's version
5. Merge: "notes" (client-only change) → scientist's value, "status" (server-only change) → colleague's value, "results" (client-only) → scientist's value
6. Result: both changes preserved, no data loss

### When Same Field Is Changed on Both Sides
Client wins — the scientist's offline edits always take precedence. This is intentional for the lab notebook use case where physical experiment observations cannot be re-created.

## _locallyModified Flag
- Added to every RxDB document schema as a boolean field
- Set to `true` by `useLocalMutations` (create/update/remove)
- Checked during pull: incoming WS events for locally-modified docs are ignored
- Cleared after successful push to server
- Never sent to server (stripped along with _rev, _meta, _attachments)

## Tombstones
- Payload DELETE physically removes docs from MongoDB
- `_sync_tombstones` collection stores `{docId, sourceCollection, deletedAt}`
- Diff endpoint queries both main collection and tombstones
- Tombstones can be pruned after 30 days
- Clients not synced in 30 days need full re-sync (rare edge case)

## Configuration
```tsx
// _layout.tsx
<LocalDBProvider
  wsURL="ws://localhost:3001"   // enables WS sync (omit for polling fallback)
  storage={sqliteStorage}
  ...
/>
```

```ts
// payload.config.ts — sync endpoints auto-enabled
createPayloadConfig({
  includeSyncEndpoints: true,  // default: true
  ...
})
```

## Graceful Degradation
- If `wsURL` not provided → falls back to polling-based replication (30s interval)
- If WS disconnects → auto-reconnect after 3s, catchup on reconnect
- If push fails (network error) → retries on next debounce cycle
- If local DB not ready → screens fall back to direct REST API calls
