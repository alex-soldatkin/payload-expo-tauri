/**
 * GET /api/sync/diff — lightweight diff endpoint.
 *
 * Returns only { id, updatedAt } for documents changed since a given checkpoint.
 * The client compares these against local state and only fetches full docs
 * for the ones that actually differ.
 *
 * Query params:
 *   collection  — Payload collection slug (required)
 *   since       — ISO 8601 timestamp checkpoint
 *   sinceId     — cursor ID within the same timestamp
 *   limit       — batch size (default 200)
 */
import type { Config } from 'payload'

export const createSyncDiffEndpoint = (): NonNullable<Config['endpoints']>[number] => ({
  method: 'get',
  path: '/sync/diff',
  handler: async (req) => {
    const url = new URL(req.url)
    const collectionSlug = url.searchParams.get('collection')
    const since = url.searchParams.get('since')
    const sinceId = url.searchParams.get('sinceId')
    const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500)

    if (!collectionSlug) {
      return Response.json({ error: 'collection param required' }, { status: 400 })
    }

    try {
      // Query only id + updatedAt using Payload's select to minimize transfer
      const where: Record<string, unknown> = {}
      if (since) {
        where.updatedAt = { greater_than_equal: since }
      }

      const result = await req.payload.find({
        collection: collectionSlug as any,
        where,
        sort: 'updatedAt',
        limit,
        depth: 0,
        select: { id: true, updatedAt: true },
        overrideAccess: false,
        req,
      })

      // Filter out the exact checkpoint doc (cursor-based pagination)
      let docs = result.docs.map((doc: any) => ({
        id: String(doc.id),
        updatedAt: doc.updatedAt as string,
        _deleted: false,
      }))

      if (since && sinceId) {
        docs = docs.filter((d) => {
          if (d.updatedAt > since) return true
          if (d.updatedAt === since && d.id > sinceId) return true
          return false
        })
      }

      // Also check tombstones for deletions
      let tombstones: Array<{ id: string; updatedAt: string; _deleted: boolean }> = []
      try {
        const tombResult = await req.payload.find({
          collection: '_sync_tombstones' as any,
          where: {
            and: [
              { sourceCollection: { equals: collectionSlug } },
              ...(since ? [{ deletedAt: { greater_than_equal: since } }] : []),
            ],
          },
          sort: 'deletedAt',
          limit,
          depth: 0,
          overrideAccess: false,
          req,
        })
        tombstones = tombResult.docs.map((t: any) => ({
          id: String(t.docId),
          updatedAt: t.deletedAt as string,
          _deleted: true,
        }))
      } catch {
        // Tombstone collection may not exist yet — not fatal
      }

      const allDocs = [...docs, ...tombstones].sort((a, b) =>
        a.updatedAt === b.updatedAt
          ? a.id.localeCompare(b.id)
          : a.updatedAt.localeCompare(b.updatedAt),
      )

      const last = allDocs.length > 0 ? allDocs[allDocs.length - 1] : null
      const checkpoint = last
        ? { updatedAt: last.updatedAt, id: last.id }
        : since && sinceId
          ? { updatedAt: since, id: sinceId }
          : null

      return Response.json({ docs: allDocs, checkpoint })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Diff failed'
      return Response.json({ error: msg }, { status: 500 })
    }
  },
})
