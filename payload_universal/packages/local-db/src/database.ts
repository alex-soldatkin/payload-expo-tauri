/**
 * Polyfill globalThis.crypto for Hermes (React Native).
 * RxDB requires crypto.getRandomValues AND crypto.subtle.digest.
 * Hermes doesn't expose either. We polyfill both using expo-crypto.
 */
import { getRandomValues as expoGetRandomValues, digest as expoDigest, CryptoDigestAlgorithm } from 'expo-crypto'

const subtlePolyfill = {
  async digest(algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> {
    // Map Web Crypto algorithm names to expo-crypto
    const algoMap: Record<string, CryptoDigestAlgorithm> = {
      'SHA-1': CryptoDigestAlgorithm.SHA1,
      'SHA-256': CryptoDigestAlgorithm.SHA256,
      'SHA-384': CryptoDigestAlgorithm.SHA384,
      'SHA-512': CryptoDigestAlgorithm.SHA512,
    }
    const algo = algoMap[algorithm as string] ?? CryptoDigestAlgorithm.SHA256
    return expoDigest(algo, data)
  },
}

if (typeof globalThis.crypto === 'undefined') {
  ;(globalThis as any).crypto = {
    getRandomValues: expoGetRandomValues,
    subtle: subtlePolyfill,
  }
} else {
  if (typeof globalThis.crypto.getRandomValues === 'undefined') {
    ;(globalThis.crypto as any).getRandomValues = expoGetRandomValues
  }
  if (typeof globalThis.crypto.subtle === 'undefined') {
    ;(globalThis.crypto as any).subtle = subtlePolyfill
  } else if (typeof globalThis.crypto.subtle.digest === 'undefined') {
    ;(globalThis.crypto.subtle as any).digest = subtlePolyfill.digest
  }
}

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
  removeRxDatabase,
  type RxCollection,
  type RxDatabase,
  type RxReplicationState,
} from 'rxdb'
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'

import type { AdminSchema } from '@payload-universal/admin-schema'
import { buildRxSchema, extractFieldDefs, type PayloadDoc } from './schemaFromPayload'
import { startReplication } from './replication'
import { startSyncReplication, type SyncReplicationState } from './syncReplication'
import {
  UPLOAD_QUEUE_COLLECTION,
  UploadQueueManager,
  uploadQueueSchema,
  type PendingUploadItem,
} from './uploadQueue'

// Add plugins (dev-mode plugin omitted — it requires a storage validator wrapper
// which adds overhead and provides little value with our permissive JSON schemas)
addRxPlugin(RxDBQueryBuilderPlugin)

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
  /** Auth token */
  token: string | null
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
  // If a previous instance exists (e.g. hot reload), destroy it first to avoid DB9.
  if (_existingDB) {
    try { await _existingDB.destroy() } catch { /* already closed */ }
    _existingDB = null
  }

  const resolvedStorage = storage ?? getRxStorageMemory()
  const db = await createRxDatabase({
    name: 'payload_local',
    storage: resolvedStorage,
    multiInstance: false,
  })

  const collections: Record<string, RxCollection<PayloadDoc>> = {}
  const replications: Record<string, RxReplicationState<PayloadDoc, any>> = {}

  // Create an RxDB collection for each Payload collection.
  // If schema version changed (e.g. after an app update), the old collection
  // is silently removed and re-created with the new schema.
  for (const [slug, serializedMap] of Object.entries(schema.collections)) {
    const fieldDefs = extractFieldDefs(serializedMap as Array<[string, unknown]>, slug)
    const rxSchema = buildRxSchema(slug, fieldDefs)

    try {
      const created = await db.addCollections({
        [slug]: { schema: rxSchema },
      })
      collections[slug] = created[slug]
    } catch (err) {
      // Schema conflict — remove old collection and recreate
      try {
        if (db.collections[slug]) {
          await db.collections[slug].remove()
        }
        const created = await db.addCollections({
          [slug]: { schema: rxSchema },
        })
        collections[slug] = created[slug]
      } catch (retryErr) {
        console.warn(`[local-db] Failed to create collection "${slug}":`, retryErr)
      }
    }
  }

  // Start replication: WebSocket (real-time) or polling (fallback)
  let syncState: SyncReplicationState | null = null

  if (wsURL) {
    // WebSocket-driven sync — real-time push, field-level merge
    syncState = startSyncReplication({
      baseURL,
      wsURL,
      token,
      collections,
    })
  } else {
    // Polling-based replication (legacy fallback)
    for (const [slug, col] of Object.entries(collections)) {
      replications[slug] = startReplication({
        baseURL,
        token,
        collection: col,
        slug,
        pullInterval,
      })
    }
  }

  // Create the local-only upload queue collection (NOT replicated)
  const uploadCollections = await db.addCollections({
    [UPLOAD_QUEUE_COLLECTION]: { schema: uploadQueueSchema },
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
    if (syncState) {
      await syncState.pushNow()
    }
  }

  const destroy = async () => {
    uploadQueue.destroy()
    syncState?.destroy()
    for (const rep of Object.values(replications)) {
      await rep.cancel()
    }
    await db.destroy()
  }

  const instance: PayloadLocalDB = {
    db, collections, replications, syncState,
    uploadCollection, uploadQueue, pullNow, pushNow, destroy,
  }
  _existingDB = instance
  return instance
}
