/**
 * POST /api/sync/pull — selective pull of full documents by ID.
 *
 * The client sends a list of document IDs it needs (determined by diffing
 * against the lightweight /sync/diff response). The server returns only
 * those full documents, avoiding unnecessary data transfer.
 *
 * Body: { collection: string, ids: string[] }
 */
import type { Config } from 'payload'

export const createSyncPullEndpoint = (): NonNullable<Config['endpoints']>[number] => ({
  method: 'post',
  path: '/sync/pull',
  handler: async (req) => {
    try {
      const body = await req.json?.() ?? {}
      const { collection: collectionSlug, ids } = body as {
        collection?: string
        ids?: string[]
      }

      if (!collectionSlug || !Array.isArray(ids) || ids.length === 0) {
        return Response.json({ error: 'collection and ids[] required' }, { status: 400 })
      }

      // Fetch in batches of 50 to avoid query size limits
      const allDocs: Record<string, unknown>[] = []
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50)
        const result = await req.payload.find({
          collection: collectionSlug as any,
          where: { id: { in: batch } },
          limit: batch.length,
          depth: 0,
          overrideAccess: false,
          req,
        })
        allDocs.push(...result.docs)
      }

      // Check tombstones for IDs not found (deleted docs)
      const foundIds = new Set(allDocs.map((d: any) => String(d.id)))
      const missingIds = ids.filter((id) => !foundIds.has(id))

      if (missingIds.length > 0) {
        try {
          const tombResult = await req.payload.find({
            collection: '_sync_tombstones' as any,
            where: {
              and: [
                { sourceCollection: { equals: collectionSlug } },
                { docId: { in: missingIds } },
              ],
            },
            limit: missingIds.length,
            depth: 0,
            overrideAccess: false,
            req,
          })
          for (const tomb of tombResult.docs as any[]) {
            allDocs.push({
              id: tomb.docId,
              _deleted: true,
              updatedAt: tomb.deletedAt,
            })
          }
        } catch {
          // Tombstone collection may not exist
        }
      }

      return Response.json({ docs: allDocs })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pull failed'
      return Response.json({ error: msg }, { status: 500 })
    }
  },
})
