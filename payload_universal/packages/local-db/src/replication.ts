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
import { Subject, interval as rxInterval } from 'rxjs'
import { map } from 'rxjs/operators'
import type { PayloadDoc } from './schemaFromPayload'

export type ReplicationConfig = {
  baseURL: string
  /** Token or getter function for the latest token (supports re-auth). */
  token: string | null | (() => string | null)
  collection: RxCollection<PayloadDoc>
  slug: string
  /** Pull batch size. Defaults to 50. */
  batchSize?: number
  /** Pull interval in ms. Defaults to 30000 (30s). 0 = manual only. */
  pullInterval?: number
  /** Enable live push (react to local writes). Defaults to true. */
  livePush?: boolean
  /** Whether this collection has drafts enabled. When true, pulls include draft documents. */
  hasDrafts?: boolean
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
    token: tokenOrGetter,
    collection,
    slug,
    batchSize = 50,
    pullInterval = 30_000,
    livePush = true,
    hasDrafts = false,
  } = config

  /** Always get the latest token (supports re-auth after logout/login). */
  const getToken = (): string | null =>
    typeof tokenOrGetter === 'function' ? tokenOrGetter() : tokenOrGetter

  const replicationConfig: any = {
    collection,
    replicationIdentifier: `payload-${slug}`,
    deletedField: '_deleted',
    live: livePush,
    retryTime: 5000,

    pull: {
      async handler(checkpoint, size) {
        const params = new URLSearchParams()
        params.set('limit', String(size || batchSize))
        params.set('sort', 'updatedAt,id') // Deterministic sort
        params.set('depth', '0')

        // Include draft documents in pull results so the mobile app
        // shows both draft and published content.
        if (hasDrafts) {
          params.set('draft', 'true')
        }

        if (checkpoint) {
          // Fetch docs updated after the checkpoint
          params.set('where[updatedAt][greater_than_equal]', checkpoint.updatedAt)
        }

        const res = await fetch(`${baseURL}/api/${slug}?${params}`, {
          headers: buildHeaders(getToken()),
        })

        if (!res.ok) {
          throw new Error(`Pull failed for ${slug}: ${res.status}`)
        }

        const data = await res.json()
        const docs: PayloadDoc[] = (data.docs ?? []).map((doc: Record<string, unknown>) => ({
          ...doc,
          id: String(doc.id),
          _deleted: false,
          _locallyModified: false,
        }))

        // Also check for tombstones (server-side deletions).
        // Always fetch ALL tombstones for this collection (they're lightweight
        // and there are usually few). The checkpoint filter only applies to
        // regular docs, not tombstones — a tombstone's deletedAt might be
        // before the current checkpoint if the doc was deleted while the client
        // was syncing other changes.
        try {
          const tombParams = new URLSearchParams()
          tombParams.set('limit', '200')
          tombParams.set('sort', 'deletedAt')
          tombParams.set('depth', '0')
          tombParams.set('where[sourceCollection][equals]', slug)
          const tombRes = await fetch(`${baseURL}/api/_sync_tombstones?${tombParams}`, {
            headers: buildHeaders(getToken()),
          })
          if (tombRes.ok) {
            const tombData = await tombRes.json()
            for (const tomb of tombData.docs ?? []) {
              docs.push({
                id: String(tomb.docId),
                updatedAt: tomb.deletedAt,
                createdAt: tomb.deletedAt,
                _deleted: true,
              } as PayloadDoc)
            }
          }
        } catch {
          // Non-fatal — tombstone collection may not exist
        }

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
      initialCheckpoint: null,
      // Emit at regular intervals to trigger re-pull (live pulling).
      // Without this, the pull handler only runs once on startup.
      stream$: pullInterval > 0
        ? rxInterval(pullInterval).pipe(map(() => 'RESYNC' as const))
        : new Subject<'RESYNC'>().asObservable(),
    },

    push: {
      async handler(changeRows) {
        const conflicts: PayloadDoc[] = []

        for (const row of changeRows) {
          const doc = row.newDocumentState
          const isNew = !row.assumedMasterState

          // Strip RxDB internal fields before sending to Payload REST API
          const { _deleted, _rev, _meta, _attachments, _locallyModified, ...payloadBody } = doc as any

          // When the document is a draft, append ?draft=true so Payload
          // skips required-field validation on the server side.
          const isDraft = payloadBody._status === 'draft'

          try {
            if (doc._deleted) {
              // Delete
              await fetch(`${baseURL}/api/${slug}/${doc.id}`, {
                method: 'DELETE',
                headers: buildHeaders(getToken()),
              })
            } else if (isNew) {
              // Create — include the client-generated id in the body.
              // Payload's MongoDB adapter accepts it as _id if it's a valid ObjectId
              // (24-char hex string). This ensures server and local IDs match.
              const createURL = isDraft ? `${baseURL}/api/${slug}?draft=true` : `${baseURL}/api/${slug}`
              const res = await fetch(createURL, {
                method: 'POST',
                headers: buildHeaders(getToken()),
                body: JSON.stringify(payloadBody),
              })
              if (!res.ok) {
                const body = await res.json().catch(() => ({}))
                if (res.status === 400 || res.status === 409) {
                  const existing = await fetch(`${baseURL}/api/${slug}/${doc.id}`, {
                    headers: buildHeaders(getToken()),
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
                  headers: buildHeaders(getToken()),
                }).then((r) => r.json()).catch(() => null)

                if (serverDoc && serverDoc.updatedAt !== assumed.updatedAt) {
                  // Server has a newer version — conflict, server wins
                  conflicts.push({ ...serverDoc, _deleted: false })
                  continue
                }
              }

              const updateURL = isDraft ? `${baseURL}/api/${slug}/${doc.id}?draft=true` : `${baseURL}/api/${slug}/${doc.id}`
              const res = await fetch(updateURL, {
                method: 'PATCH',
                headers: buildHeaders(getToken()),
                body: JSON.stringify(payloadBody),
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
  }

  return replicateRxCollection<PayloadDoc, Checkpoint>(replicationConfig)
}
