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
  type RxCollection,
  type RxDatabase,
  type RxReplicationState,
} from 'rxdb'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'

import type { AdminSchema } from '@payload-universal/admin-schema'
import { buildRxSchema, extractFieldDefs, type PayloadDoc } from './schemaFromPayload'
import { startReplication } from './replication'
import {
  UPLOAD_QUEUE_COLLECTION,
  UploadQueueManager,
  uploadQueueSchema,
  type PendingUploadItem,
} from './uploadQueue'

// Add plugins
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  addRxPlugin(RxDBDevModePlugin)
}
addRxPlugin(RxDBQueryBuilderPlugin)

export type PayloadLocalDB = {
  db: RxDatabase
  collections: Record<string, RxCollection<PayloadDoc>>
  replications: Record<string, RxReplicationState<PayloadDoc, any>>
  uploadCollection: RxCollection<PendingUploadItem>
  uploadQueue: UploadQueueManager
  /** Trigger an immediate pull for a collection */
  pullNow: (slug: string) => Promise<void>
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
  /** Pull interval in ms. Defaults to 30000. */
  pullInterval?: number
  /** RxDB storage factory. Defaults to in-memory. Pass getRxStorageSQLite() for persistence. */
  storage?: any
}

export const createLocalDB = async ({
  schema,
  baseURL,
  token,
  pullInterval = 30_000,
  storage,
}: CreateLocalDBArgs): Promise<PayloadLocalDB> => {
  const db = await createRxDatabase({
    name: 'payload_local',
    storage: storage ?? getRxStorageMemory(),
    multiInstance: false,
    ignoreDuplicate: true,
  })

  const collections: Record<string, RxCollection<PayloadDoc>> = {}
  const replications: Record<string, RxReplicationState<PayloadDoc, any>> = {}

  // Create an RxDB collection for each Payload collection
  for (const [slug, serializedMap] of Object.entries(schema.collections)) {
    const fieldDefs = extractFieldDefs(serializedMap as Array<[string, unknown]>, slug)
    const rxSchema = buildRxSchema(slug, fieldDefs)

    const created = await db.addCollections({
      [slug]: { schema: rxSchema },
    })

    collections[slug] = created[slug]

    // Start replication
    replications[slug] = startReplication({
      baseURL,
      token,
      collection: created[slug],
      slug,
      pullInterval,
    })
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

  const destroy = async () => {
    uploadQueue.destroy()
    for (const rep of Object.values(replications)) {
      await rep.cancel()
    }
    await db.destroy()
  }

  return { db, collections, replications, uploadCollection, uploadQueue, pullNow, destroy }
}
