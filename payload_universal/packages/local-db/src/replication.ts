/**
 * RxDB ↔ Payload REST API replication engine.
 *
 * For each collection:
 *   Pull: GET /api/{slug}?where[updatedAt][greater_than]=checkpoint&sort=updatedAt&limit=batchSize
 *   Push: POST /api/{slug} (create) or PATCH /api/{slug}/{id} (update)
 *
 * Uses Payload's `updatedAt` as the replication checkpoint.
 * Conflict strategy: server wins (last-write-wins based on updatedAt).
 */
import { replicateRxCollection } from 'rxdb/plugins/replication'
import type { RxCollection, RxReplicationState } from 'rxdb'
import type { PayloadDoc } from './schemaFromPayload'

export type ReplicationConfig = {
  baseURL: string
  token: string | null
  collection: RxCollection<PayloadDoc>
  slug: string
  /** Pull batch size. Defaults to 50. */
  batchSize?: number
  /** Pull interval in ms. Defaults to 30000 (30s). 0 = manual only. */
  pullInterval?: number
  /** Enable live push (react to local writes). Defaults to true. */
  livePush?: boolean
}

type Checkpoint = {
  updatedAt: string
  id: string
} | null

const buildHeaders = (token: string | null): Record<string, string> => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...(token ? { Authorization: `JWT ${token}` } : {}),
})

export const startReplication = (
  config: ReplicationConfig,
): RxReplicationState<PayloadDoc, Checkpoint> => {
  const {
    baseURL,
    token,
    collection,
    slug,
    batchSize = 50,
    pullInterval = 30_000,
    livePush = true,
  } = config

  return replicateRxCollection<PayloadDoc, Checkpoint>({
    collection,
    replicationIdentifier: `payload-${slug}`,
    deletedField: '_deleted',
    live: livePush,
    retryTime: 5000,

    pull: {
      async handler(checkpoint, size) {
        const params = new URLSearchParams()
        params.set('limit', String(size || batchSize))
        params.set('sort', 'updatedAt')
        params.set('depth', '0')

        if (checkpoint) {
          // Fetch docs updated after the checkpoint
          params.set('where[updatedAt][greater_than_equal]', checkpoint.updatedAt)
        }

        const res = await fetch(`${baseURL}/api/${slug}?${params}`, {
          headers: buildHeaders(token),
        })

        if (!res.ok) {
          throw new Error(`Pull failed for ${slug}: ${res.status}`)
        }

        const data = await res.json()
        const docs: PayloadDoc[] = (data.docs ?? []).map((doc: Record<string, unknown>) => ({
          ...doc,
          id: String(doc.id),
          _deleted: false,
        }))

        // Filter out docs we already have at this exact checkpoint
        // (the query uses greater_than_equal so the checkpoint doc may come back)
        const filtered = checkpoint
          ? docs.filter((d) => {
              if (d.updatedAt > checkpoint.updatedAt) return true
              if (d.updatedAt === checkpoint.updatedAt && d.id > checkpoint.id) return true
              return false
            })
          : docs

        const newCheckpoint: Checkpoint = filtered.length > 0
          ? {
              updatedAt: filtered[filtered.length - 1].updatedAt,
              id: filtered[filtered.length - 1].id,
            }
          : checkpoint

        return {
          documents: filtered,
          checkpoint: newCheckpoint,
        }
      },
      batchSize,
      ...(pullInterval > 0 ? { initialCheckpoint: null } : {}),
    },

    push: {
      async handler(changeRows) {
        const conflicts: PayloadDoc[] = []

        for (const row of changeRows) {
          const doc = row.newDocumentState
          const isNew = !row.assumedMasterState

          try {
            if (doc._deleted) {
              // Delete
              await fetch(`${baseURL}/api/${slug}/${doc.id}`, {
                method: 'DELETE',
                headers: buildHeaders(token),
              })
            } else if (isNew) {
              // Create
              const res = await fetch(`${baseURL}/api/${slug}`, {
                method: 'POST',
                headers: buildHeaders(token),
                body: JSON.stringify(doc),
              })
              if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                // If it's a conflict (doc already exists), return as conflict
                if (res.status === 400 || res.status === 409) {
                  const existing = await fetch(`${baseURL}/api/${slug}/${doc.id}`, {
                    headers: buildHeaders(token),
                  }).then((r) => r.json()).catch(() => null)
                  if (existing) conflicts.push({ ...existing, _deleted: false })
                  continue
                }
                throw new Error(body.errors?.[0]?.message || `Push create failed: ${res.status}`)
              }
            } else {
              // Update — check for conflicts via updatedAt
              const assumed = row.assumedMasterState
              if (assumed) {
                const serverDoc = await fetch(`${baseURL}/api/${slug}/${doc.id}?depth=0`, {
                  headers: buildHeaders(token),
                }).then((r) => r.json()).catch(() => null)

                if (serverDoc && serverDoc.updatedAt !== assumed.updatedAt) {
                  // Server has a newer version — conflict, server wins
                  conflicts.push({ ...serverDoc, _deleted: false })
                  continue
                }
              }

              const res = await fetch(`${baseURL}/api/${slug}/${doc.id}`, {
                method: 'PATCH',
                headers: buildHeaders(token),
                body: JSON.stringify(doc),
              })
              if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                throw new Error(body.errors?.[0]?.message || `Push update failed: ${res.status}`)
              }
            }
          } catch (err) {
            // Network errors are retried by RxDB automatically
            throw err
          }
        }

        return conflicts
      },
      batchSize: 1, // Push one at a time for conflict detection
    },
  })
}
