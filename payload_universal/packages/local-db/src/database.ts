/**
 * Creates and manages the RxDB database instance and its collections.
 *
 * The database is initialized from the Payload admin schema:
 *   1. For each Payload collection, an RxDB collection is created
 *   2. A local _pending_uploads collection is created (not replicated)
 *   3. Replication is started for each Payload collection
 *   4. The upload queue manager is started
 */
import {
  addRxPlugin,
  createRxDatabase,
  defaultConflictHandler,
  removeRxDatabase,
  type RxCollection,
  type RxConflictHandler,
  type RxDatabase,
} from 'rxdb'
// The RxReplicationState class lives in the replication plugin, not the core entry.
import type { RxReplicationState } from 'rxdb/plugins/replication'
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema'

import type { AdminSchema } from '@payload-universal/admin-schema'
import { buildRxSchema, extractFieldDefs, type PayloadDoc } from './utils/schemaFromPayload'
import { startReplication } from './sync/replication'
import { startSyncReplication, type SyncReplicationState } from './sync/syncReplication'
import {
  UPLOAD_QUEUE_COLLECTION,
  UploadQueueManager,
  uploadQueueSchema,
  type PendingUploadItem,
} from './queue/uploadQueue'

// Add plugins (dev-mode plugin omitted — it requires a storage validator wrapper
// which adds overhead and provides little value with our permissive JSON schemas)
addRxPlugin(RxDBQueryBuilderPlugin)
addRxPlugin(RxDBMigrationSchemaPlugin)

/** Track the singleton database instance to avoid DB9 (duplicate database) errors. */
let _existingDB: PayloadLocalDB | null = null

export type PayloadLocalDB = {
  db: RxDatabase
  collections: Record<string, RxCollection<PayloadDoc>>
  replications: Record<string, RxReplicationState<PayloadDoc, any>>
  /** WebSocket sync state (when using sync replication) */
  syncState: SyncReplicationState | null
  uploadCollection: RxCollection<PendingUploadItem>
  uploadQueue: UploadQueueManager
  /** Trigger an immediate pull for a collection */
  pullNow: (slug: string) => Promise<void>
  /** Push all locally-modified documents now */
  pushNow: () => Promise<void>
  /** Stop all replications and close the database */
  destroy: () => Promise<void>
}

export type CreateLocalDBArgs = {
  /** The admin schema fetched from the server */
  schema: AdminSchema
  /** Server base URL */
  baseURL: string
  /** Auth token or getter function for the latest token (supports re-auth). */
  token: string | null | (() => string | null)
  /** Pull interval in ms. Defaults to 30000. Only used with polling replication. */
  pullInterval?: number
  /** RxDB storage factory. Defaults to in-memory. Pass getRxStorageSQLite() for persistence. */
  storage?: any
  /**
   * WebSocket URL for real-time sync (e.g. ws://localhost:3001).
   * When provided, uses WS-driven sync instead of polling.
   */
  wsURL?: string
}

export const createLocalDB = async ({
  schema,
  baseURL,
  token,
  pullInterval = 30_000,
  storage,
  wsURL,
}: CreateLocalDBArgs): Promise<PayloadLocalDB> => {
  // If a previous instance exists (e.g. hot reload), fully remove it
  // (destroy + wipe data) so there's no stale DB in RxDB's registry.
  if (_existingDB) {
    try { await _existingDB.db.remove() } catch {
      try { await _existingDB.destroy() } catch { /* already closed */ }
    }
    _existingDB = null
  }

  const resolvedStorage = storage ?? getRxStorageMemory()

  // Helper: create the RxDatabase.
  // closeDuplicates: automatically close any prior instance with the same
  // name that's still in RxDB's internal registry. This prevents DB8
  // (duplicate name in registry) without requiring dev-mode — unlike
  // ignoreDuplicate which throws DB9 in production builds.
  const openDB = () =>
    createRxDatabase({
      name: 'payload_local',
      storage: resolvedStorage,
      multiInstance: false,
      closeDuplicates: true,
    })

  let db = await openDB()

  const collections: Record<string, RxCollection<PayloadDoc>> = {}
  const replications: Record<string, RxReplicationState<PayloadDoc, any>> = {}

  // Skip Payload's internal collections — they don't need local-first sync
  // and often return 403/501 when queried with a regular user token.
  const INTERNAL_SLUGS = new Set([
    'payload-preferences',
    'payload-migrations',
    'payload-locked-documents',
    'payload-kv',
    '_sync_tombstones',
  ])

  // Prepare the list of collection schemas we need to create
  const collectionEntries: Array<{ slug: string; rxSchema: any }> = []
  for (const [slug, serializedMap] of Object.entries(schema.collections)) {
    if (INTERNAL_SLUGS.has(slug) || slug.startsWith('payload-')) continue
    const fieldDefs = extractFieldDefs(serializedMap as Array<[string, unknown]>, slug)
    collectionEntries.push({ slug, rxSchema: buildRxSchema(slug, fieldDefs) })
  }

  // Conflict resolution: offline edits must never be silently dropped.
  // RxDB's default handler resolves every conflict to the server state — but
  // Payload assigns its own updatedAt on create/update, so the pushed state
  // never matches the server echo and the next pull ALWAYS flags a "conflict".
  // With the default handler that pull would clobber any offline edit made
  // between push-ack and pull (proven data loss). When the local fork carries
  // an unpushed edit (_locallyModified), the local version wins and gets
  // re-pushed; otherwise fall back to server-wins.
  const payloadConflictHandler: RxConflictHandler<PayloadDoc> = {
    isEqual: defaultConflictHandler.isEqual as RxConflictHandler<PayloadDoc>['isEqual'],
    resolve: async (input) => {
      if ((input.newDocumentState as PayloadDoc & { _locallyModified?: boolean })._locallyModified) {
        return input.newDocumentState
      }
      return input.realMasterState
    },
  }

  // Try to add all collections. On DB6 (schema conflict), wipe everything
  // and retry ONCE with a fresh database — no recursive call needed.
  let needsRetry = false
  for (const { slug, rxSchema } of collectionEntries) {
    try {
      const created = await db.addCollections({
        [slug]: { schema: rxSchema, migrationStrategies: {}, autoMigrate: true, conflictHandler: payloadConflictHandler },
      })
      collections[slug] = created[slug]
    } catch (err: any) {
      const errStr = String(err)
      if (errStr.includes('DB6')) {
        console.warn(`[local-db] Schema conflict (DB6) for "${slug}". Will wipe and retry...`)
        needsRetry = true
        break
      } else {
        console.warn(`[local-db] Failed to create collection "${slug}":`, err)
      }
    }
  }

  // DB6 recovery: remove the half-built DB (destroy + wipe data in one
  // atomic call that also clears RxDB's internal registry), then re-open.
  if (needsRetry) {
    try { await db.remove() } catch {
      // Fallback if .remove() fails: close + wipe separately
      // (RxDB v16 renamed destroy() to close())
      try { await db.close() } catch { /* ignore */ }
      try { await removeRxDatabase('payload_local', resolvedStorage) } catch { /* ignore */ }
    }

    // Clear collected state from the failed attempt
    for (const key of Object.keys(collections)) delete collections[key]

    // Re-open fresh
    db = await openDB()

    for (const { slug, rxSchema } of collectionEntries) {
      try {
        const created = await db.addCollections({
          [slug]: { schema: rxSchema, migrationStrategies: {}, autoMigrate: true, conflictHandler: payloadConflictHandler },
        })
        collections[slug] = created[slug]
      } catch (retryErr) {
        console.warn(`[local-db] Failed to create collection "${slug}" after DB reset:`, retryErr)
      }
    }
  }

  // Build a lookup for collections with drafts enabled (from the menu model).
  // When drafts are enabled, the replication pull must include draft documents.
  const draftSlugs = new Set<string>(
    schema.menuModel?.collections
      ?.filter((c: { drafts?: boolean }) => c.drafts)
      .map((c: { slug: string }) => c.slug) ?? []
  )

  // Always start polling replication for initial pull + background sync.
  // This handles the bulk data transfer efficiently (batched REST queries).
  for (const [slug, col] of Object.entries(collections)) {
    replications[slug] = startReplication({
      baseURL,
      token,
      collection: col,
      slug,
      pullInterval: pullInterval || 30_000, // always poll for changes (including deletions)
      livePush: true, // Push enabled — ID reconciliation no longer upserts (no loop)
      hasDrafts: draftSlugs.has(slug),
    })
    // Replication failures (push rejections, pull errors) were previously
    // swallowed — a stalled doc just sat "unsynced" with no trace. Surface
    // them so apps (and debugging sessions) can see WHY sync is stuck.
    replications[slug].error$.subscribe((err) => {
      // RxDB wraps handler throws as RC_PUSH/RC_PULL with the real errors in
      // err.parameters.errors — surface those, the wrapper text is useless.
      const inner = (err as { parameters?: { errors?: unknown[] } }).parameters?.errors
        ?.map((e) => {
          if (e instanceof Error) return e.message
          try {
            return JSON.stringify(e).slice(0, 300)
          } catch {
            return String(e)
          }
        })
        .join('; ')
      console.error(`[local-db] replication error (${slug}): ${inner || err.message || err}`)
    })
  }

  // If WebSocket URL is provided, also start WS sync for real-time push notifications.
  // WS handles instant change events; polling handles the initial bulk pull + push.
  let syncState: SyncReplicationState | null = null

  if (wsURL) {
    syncState = startSyncReplication({
      baseURL,
      wsURL,
      token,
      collections,
    })
  }

  // Create the local-only upload queue collection (NOT replicated)
  const uploadCollections = await db.addCollections({
    [UPLOAD_QUEUE_COLLECTION]: { schema: uploadQueueSchema, migrationStrategies: {}, autoMigrate: true },
  })
  const uploadCollection = uploadCollections[UPLOAD_QUEUE_COLLECTION] as RxCollection<PendingUploadItem>

  // Patch helper: update a field in a local RxDB doc (used by upload queue on success)
  const patchLocalDoc = async (collectionSlug: string, docId: string, fieldPath: string, value: string) => {
    const col = collections[collectionSlug]
    if (!col) return
    const rxDoc = await col.findOne(docId).exec()
    if (rxDoc) {
      await rxDoc.incrementalPatch({
        [fieldPath]: value,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  const uploadQueue = new UploadQueueManager(uploadCollection, baseURL, token, patchLocalDoc)

  const pullNow = async (slug: string) => {
    const rep = replications[slug]
    if (rep) {
      await rep.reSync()
      await rep.awaitInSync()
    }
  }

  const pushNow = async () => {
    // The WS sync state is pull-only (push is handled by the polling
    // replication's live push), so pushNow is optional — guard the call.
    if (syncState?.pushNow) {
      await syncState.pushNow()
    }
  }

  const destroy = async () => {
    uploadQueue.destroy()
    syncState?.destroy()
    for (const rep of Object.values(replications)) {
      await rep.cancel()
    }
    // RxDB v16 renamed destroy() to close()
    await db.close()
  }

  const instance: PayloadLocalDB = {
    db, collections, replications, syncState,
    uploadCollection, uploadQueue, pullNow, pushNow, destroy,
  }
  _existingDB = instance
  return instance
}

/**
 * Completely wipe the local database and reset the singleton.
 *
 * After this call the LocalDBProvider can re-init a fresh database
 * that re-syncs everything from the server.
 *
 * @param storage - The same RxDB storage that was used to create the DB.
 *                  Required so `removeRxDatabase` can locate persisted data.
 */
export const resetLocalDB = async (storage?: any): Promise<void> => {
  // 1. Stop replications, upload queue, WS sync
  if (_existingDB) {
    // db.remove() = destroy + wipe data + clear RxDB registry in one call
    try {
      await _existingDB.uploadQueue.destroy()
      _existingDB.syncState?.destroy()
      for (const rep of Object.values(_existingDB.replications)) {
        try { await rep.cancel() } catch { /* ignore */ }
      }
      await _existingDB.db.remove()
    } catch {
      // Fallback: destroy instance + wipe separately
      try { await _existingDB.destroy() } catch { /* ignore */ }
      const resolvedStorage = storage ?? getRxStorageMemory()
      try { await removeRxDatabase('payload_local', resolvedStorage) } catch { /* ignore */ }
    }
    _existingDB = null
    return
  }

  // 2. No running instance — just wipe persisted data
  const resolvedStorage = storage ?? getRxStorageMemory()
  try {
    await removeRxDatabase('payload_local', resolvedStorage)
  } catch {
    /* May fail if the DB was already removed — safe to ignore */
  }
}
