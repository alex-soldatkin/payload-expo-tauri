/**
 * POST /api/sync/push — push local changes with field-level three-way merge.
 *
 * Instead of document-level conflict resolution, this performs a field-level
 * merge using the common ancestor (base) as the reference point:
 *
 *   - Field changed only locally → use client value
 *   - Field changed only on server → keep server value
 *   - Field changed on both sides (same field) → client wins (offline edits take precedence)
 *   - Field unchanged → keep as-is
 *
 * This means non-conflicting field changes from both sides are merged
 * automatically. True conflicts (same field changed both places) resolve
 * in favor of the client for the lab notebook use case.
 *
 * Body: {
 *   collection: string,
 *   writes: Array<{
 *     doc: Record<string, unknown>   — the current local document
 *     base: Record<string, unknown>  — the last-known server state (common ancestor)
 *     isDelete?: boolean
 *   }>
 * }
 */
import type { Config } from 'payload'

/** Internal fields that should never be merged — handled by Payload automatically. */
const SKIP_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', '_status',
  // RxDB internal fields (should be stripped by client, but just in case)
  '_deleted', '_rev', '_meta', '_attachments', '_locallyModified',
])

/**
 * Three-way field-level merge.
 *
 * Given a common ancestor (base), client doc, and server doc, produces
 * a merged document that combines non-conflicting changes from both sides.
 * For true conflicts (same field changed on both), client wins.
 */
function threeWayMerge(
  base: Record<string, unknown>,
  client: Record<string, unknown>,
  server: Record<string, unknown>,
): { merged: Record<string, unknown>; mergedFields: string[]; conflictFields: string[] } {
  const merged: Record<string, unknown> = { ...server }
  const mergedFields: string[] = []
  const conflictFields: string[] = []

  // Collect all field keys across all three versions
  const allKeys = new Set([
    ...Object.keys(base),
    ...Object.keys(client),
    ...Object.keys(server),
  ])

  for (const key of allKeys) {
    if (SKIP_FIELDS.has(key)) continue

    const baseVal = JSON.stringify(base[key] ?? null)
    const clientVal = JSON.stringify(client[key] ?? null)
    const serverVal = JSON.stringify(server[key] ?? null)

    const clientChanged = clientVal !== baseVal
    const serverChanged = serverVal !== baseVal

    if (clientChanged && !serverChanged) {
      // Only client modified this field → use client value
      merged[key] = client[key]
      mergedFields.push(key)
    } else if (!clientChanged && serverChanged) {
      // Only server modified this field → keep server value (already in merged)
    } else if (clientChanged && serverChanged) {
      if (clientVal === serverVal) {
        // Both changed to the same value → no conflict
      } else {
        // True conflict — client wins (lab notebook: offline edits take precedence)
        merged[key] = client[key]
        conflictFields.push(key)
      }
    }
    // Neither changed → keep as-is (already in merged from server spread)
  }

  return { merged, mergedFields, conflictFields }
}

type WriteEntry = {
  doc: Record<string, unknown>
  base: Record<string, unknown> | null
  isDelete?: boolean
}

type WriteResult = {
  id: string
  status: 'created' | 'updated' | 'deleted' | 'merged' | 'error'
  mergedFields?: string[]
  conflictFields?: string[]
  error?: string
  serverDoc?: Record<string, unknown>
}

export const createSyncPushEndpoint = (): NonNullable<Config['endpoints']>[number] => ({
  method: 'post',
  path: '/sync/push',
  handler: async (req) => {
    try {
      const body = await req.json?.() ?? {}
      const { collection: collectionSlug, writes } = body as {
        collection?: string
        writes?: WriteEntry[]
      }

      if (!collectionSlug || !Array.isArray(writes) || writes.length === 0) {
        return Response.json({ error: 'collection and writes[] required' }, { status: 400 })
      }

      const results: WriteResult[] = []

      for (const write of writes) {
        const { doc, base, isDelete } = write
        const id = String(doc.id)

        // Strip RxDB internal fields
        const { _deleted, _rev, _meta, _attachments, _locallyModified, ...cleanDoc } = doc as any

        try {
          if (isDelete) {
            // Delete the document
            await req.payload.delete({
              collection: collectionSlug as any,
              id,
              overrideAccess: false,
              req,
            })

            // Write tombstone
            try {
              await req.payload.create({
                collection: '_sync_tombstones' as any,
                data: {
                  docId: id,
                  sourceCollection: collectionSlug,
                  deletedAt: new Date().toISOString(),
                },
                overrideAccess: true,
              })
            } catch {
              // Tombstone collection may not exist — non-fatal
            }

            results.push({ id, status: 'deleted' })
            continue
          }

          // Try to fetch existing server document
          let serverDoc: Record<string, unknown> | null = null
          try {
            serverDoc = await req.payload.findByID({
              collection: collectionSlug as any,
              id,
              depth: 0,
              overrideAccess: false,
              req,
            })
          } catch {
            // 404 — document doesn't exist on server
          }

          if (!serverDoc) {
            // New document — create it
            const created = await req.payload.create({
              collection: collectionSlug as any,
              data: cleanDoc,
              overrideAccess: false,
              req,
            })
            results.push({ id: String(created.id), status: 'created' })
            continue
          }

          // Document exists on server — check if merge is needed
          if (base && serverDoc.updatedAt !== base.updatedAt) {
            // Server has changed since the client's last sync — field-level merge
            const { merged, mergedFields, conflictFields } = threeWayMerge(
              base,
              cleanDoc,
              serverDoc as Record<string, unknown>,
            )

            // Apply the merged document
            await req.payload.update({
              collection: collectionSlug as any,
              id,
              data: merged,
              overrideAccess: false,
              req,
            })

            results.push({
              id,
              status: 'merged',
              mergedFields,
              conflictFields,
              serverDoc: serverDoc as Record<string, unknown>,
            })
          } else {
            // No server-side changes since last sync — simple update
            await req.payload.update({
              collection: collectionSlug as any,
              id,
              data: cleanDoc,
              overrideAccess: false,
              req,
            })
            results.push({ id, status: 'updated' })
          }
        } catch (err) {
          results.push({
            id,
            status: 'error',
            error: err instanceof Error ? err.message : 'Push failed',
          })
        }
      }

      return Response.json({ results })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed'
      return Response.json({ error: msg }, { status: 500 })
    }
  },
})
