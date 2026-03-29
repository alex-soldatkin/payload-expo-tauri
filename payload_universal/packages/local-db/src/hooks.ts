/**
 * React hooks for reading from the local RxDB database.
 *
 * These replace direct REST API calls in the UI layer:
 *   useLocalCollection(slug) → reactive paginated list (replaces DocumentList API calls)
 *   useLocalDocument(slug, id) → reactive single document (replaces DocumentForm API calls)
 *   useLocalQuery(slug, query) → reactive filtered/sorted query
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MangoQuery, RxCollection, RxDocument } from 'rxdb'
import type { PayloadDoc } from './schemaFromPayload'
import type { PayloadLocalDB } from './database'

// ---------------------------------------------------------------------------
// useLocalCollection — reactive paginated list
// ---------------------------------------------------------------------------

export type UseLocalCollectionResult = {
  docs: PayloadDoc[]
  totalDocs: number
  loading: boolean
  error: string | null
  refetch: () => void
  page: number
  setPage: (p: number) => void
  hasNextPage: boolean
}

export const useLocalCollection = (
  localDB: PayloadLocalDB | null,
  slug: string,
  options?: {
    limit?: number
    sort?: string
    where?: Record<string, unknown>
  },
): UseLocalCollectionResult => {
  const [docs, setDocs] = useState<PayloadDoc[]>([])
  const [totalDocs, setTotalDocs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)

  const limit = options?.limit ?? 20
  const sortField = options?.sort ?? '-updatedAt'
  const where = options?.where

  const collection = localDB?.collections[slug]

  useEffect(() => {
    if (!collection) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Build the RxDB query
    const selector: Record<string, unknown> = { _deleted: { $eq: false } }

    // Convert Payload where format to Mango query
    if (where) {
      for (const [field, condition] of Object.entries(where)) {
        if (field === 'and' || field === 'or') {
          // Skip complex queries for now — handled server-side via replication
          continue
        }
        if (typeof condition === 'object' && condition !== null) {
          const ops = condition as Record<string, unknown>
          for (const [op, val] of Object.entries(ops)) {
            const mangoOp = payloadOpToMango(op)
            if (mangoOp) {
              selector[field] = { [mangoOp]: val }
            }
          }
        }
      }
    }

    // Determine sort direction
    const isDesc = sortField.startsWith('-')
    const sortKey = isDesc ? sortField.slice(1) : sortField

    const query = collection.find({
      selector,
      sort: [{ [sortKey]: isDesc ? 'desc' : 'asc' } as any],
      skip: (page - 1) * limit,
      limit,
    })

    // Subscribe to reactive results
    const sub = query.$.subscribe({
      next: (results) => {
        setDocs(results.map((r: RxDocument<PayloadDoc>) => r.toJSON() as PayloadDoc))
        setLoading(false)
      },
      error: (err) => {
        setError(err?.message ?? 'Query failed')
        setLoading(false)
      },
    })

    // Also get total count
    collection.count({ selector }).exec().then((count: number) => {
      setTotalDocs(count)
    })

    return () => sub.unsubscribe()
  }, [collection, page, limit, sortField, where, refreshKey])

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), [])

  return {
    docs,
    totalDocs,
    loading,
    error,
    refetch,
    page,
    setPage,
    hasNextPage: page * limit < totalDocs,
  }
}

// ---------------------------------------------------------------------------
// useLocalDocument — reactive single document
// ---------------------------------------------------------------------------

export type UseLocalDocumentResult = {
  doc: PayloadDoc | null
  loading: boolean
  error: string | null
  /** Update the document locally (optimistic — will sync to server). */
  update: (data: Partial<PayloadDoc>) => Promise<void>
  /** Delete the document locally (will sync to server). */
  remove: () => Promise<void>
}

export const useLocalDocument = (
  localDB: PayloadLocalDB | null,
  slug: string,
  id: string | null,
): UseLocalDocumentResult => {
  const [doc, setDoc] = useState<PayloadDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const collection = localDB?.collections[slug]

  useEffect(() => {
    if (!collection || !id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const sub = collection.findOne(id).$.subscribe({
      next: (result) => {
        setDoc(result ? (result.toJSON() as PayloadDoc) : null)
        setLoading(false)
      },
      error: (err) => {
        setError(err?.message ?? 'Failed to load document')
        setLoading(false)
      },
    })

    return () => sub.unsubscribe()
  }, [collection, id])

  const update = useCallback(async (data: Partial<PayloadDoc>) => {
    if (!collection || !id) return
    const rxDoc = await collection.findOne(id).exec()
    if (rxDoc) {
      await rxDoc.incrementalPatch({
        ...data,
        updatedAt: new Date().toISOString(),
      })
    }
  }, [collection, id])

  const remove = useCallback(async () => {
    if (!collection || !id) return
    const rxDoc = await collection.findOne(id).exec()
    if (rxDoc) {
      await rxDoc.incrementalPatch({ _deleted: true })
    }
  }, [collection, id])

  return { doc, loading, error, update, remove }
}

// ---------------------------------------------------------------------------
// useLocalQuery — reactive filtered query
// ---------------------------------------------------------------------------

export const useLocalQuery = (
  localDB: PayloadLocalDB | null,
  slug: string,
  mangoQuery: MangoQuery<PayloadDoc>,
): { docs: PayloadDoc[]; loading: boolean } => {
  const [docs, setDocs] = useState<PayloadDoc[]>([])
  const [loading, setLoading] = useState(true)

  const collection = localDB?.collections[slug]
  const queryKey = JSON.stringify(mangoQuery)

  useEffect(() => {
    if (!collection) {
      setLoading(false)
      return
    }

    setLoading(true)
    const query = collection.find(mangoQuery)
    const sub = query.$.subscribe({
      next: (results) => {
        setDocs(results.map((r: RxDocument<PayloadDoc>) => r.toJSON() as PayloadDoc))
        setLoading(false)
      },
      error: () => setLoading(false),
    })

    return () => sub.unsubscribe()
  }, [collection, queryKey])

  return { docs, loading }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const payloadOpToMango = (op: string): string | null => {
  const map: Record<string, string> = {
    equals: '$eq',
    not_equals: '$ne',
    greater_than: '$gt',
    greater_than_equal: '$gte',
    less_than: '$lt',
    less_than_equal: '$lte',
    contains: '$regex',
    in: '$in',
    not_in: '$nin',
    exists: '$exists',
  }
  return map[op] ?? null
}
