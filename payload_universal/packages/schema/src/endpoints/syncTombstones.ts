/**
 * _sync_tombstones collection — tracks deleted documents for sync.
 *
 * Payload's DELETE physically removes documents from MongoDB, so the diff
 * endpoint has no way to detect deletions. This hidden collection stores
 * lightweight tombstone records that are written by afterDelete hooks and
 * queried by the diff/pull endpoints.
 *
 * Tombstones older than 30 days can be pruned — clients that haven't synced
 * in 30 days will need a full re-sync.
 */
import type { CollectionConfig } from 'payload'

export const SyncTombstones: CollectionConfig = {
  slug: '_sync_tombstones',
  admin: {
    hidden: true,
  },
  access: {
    // Only accessible via API with valid auth (overrideAccess handles internal calls)
    read: ({ req }) => !!req.user,
    create: () => true, // Created internally by hooks
    delete: () => true,
  },
  fields: [
    {
      name: 'docId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'sourceCollection',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'deletedAt',
      type: 'date',
      required: true,
      index: true,
    },
  ],
}

/**
 * Create an afterDelete hook that writes a tombstone.
 * Inject into every synced collection.
 */
export function createTombstoneHook(collectionSlug: string) {
  return async ({ doc, req }: { doc: any; req: any }) => {
    try {
      await req.payload.create({
        collection: '_sync_tombstones',
        data: {
          docId: String(doc.id),
          sourceCollection: collectionSlug,
          deletedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
    } catch {
      // Non-fatal — worst case the client won't know about this deletion
      // until a full re-sync
    }
    return doc
  }
}
