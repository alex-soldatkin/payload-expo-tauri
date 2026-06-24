/**
 * useJoinData — query + pagination + sort state for the join table.
 *
 * Local-first: queries RxDB with a proper reverse-relationship WHERE filter,
 * falls back to the REST API. Owns the optional `@payload-universal/local-db`
 * peer-dep require, the initial/sort/parent-id reload effects, and the
 * load-more / refresh / column-sort handlers. Returns the derived join
 * descriptors (columns, parent id, collection label) the table renders from.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ClientJoinField } from '../../../types'
import { usePayloadNative } from '../../../PayloadNativeProvider'
import { useFormData } from '../../../contexts/FormDataContext'
import { payloadApi } from '../../../utils/api'
import { DEFAULT_COLUMNS, parseJoinValue } from '../utils'

// Dynamic local-db hooks (optional peer dep)
let _useLocalDB: (() => any) | null = null
try {
  _useLocalDB = require('@payload-universal/local-db').useLocalDB
} catch { /* local-db not available */ }

export function useJoinData(field: ClientJoinField, value: unknown) {
  const { baseURL, auth, schema } = usePayloadNative()
  const formCtx = useFormData()
  const [docs, setDocs] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [page, setPage] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [sortField, setSortField] = useState<string>(
    field.defaultSort?.replace(/^-/, '') || 'createdAt',
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    field.defaultSort?.startsWith('-') ? 'desc' : 'asc',
  )
  const loadedRef = useRef(false)

  // Resolve the joined collection slug (use first for polymorphic)
  const joinCollection = Array.isArray(field.collection)
    ? field.collection[0]
    : field.collection

  // Resolve `on` — the field in the joined collection pointing back here
  const onField = field.on

  // Parent document ID — needed to build the WHERE filter
  const parentDocId = useMemo(() => {
    // 1. From the FormDataContext (set by DocumentForm)
    if (formCtx?.formData?.id) return String(formCtx.formData.id)
    // 2. From the pre-populated value (look at any doc's `on` field)
    const pre = parseJoinValue(value)
    if (pre?.docs?.[0]) {
      const ref = (pre.docs[0] as Record<string, unknown>)[onField]
      if (ref) {
        if (typeof ref === 'object' && ref !== null) return String((ref as Record<string, unknown>).id ?? '')
        return String(ref)
      }
    }
    return null
  }, [formCtx?.formData?.id, value, onField])

  // Columns to display
  const columns: string[] = useMemo(() => {
    if (field.admin?.defaultColumns && field.admin.defaultColumns.length > 0) {
      return field.admin.defaultColumns
    }
    return DEFAULT_COLUMNS
  }, [field.admin?.defaultColumns])

  // Limit per page
  const limit = field.defaultLimit || 10

  // Pre-populated data from server
  const prePopulated = parseJoinValue(value)

  // Local DB access
  const localDB = _useLocalDB ? _useLocalDB() : null
  const localCollection = localDB?.collections?.[joinCollection]

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadDocs = useCallback(async (
    pageNum: number,
    append: boolean = false,
    isRefresh: boolean = false,
  ) => {
    // Can't load related docs without a saved parent document
    if (!parentDocId && !prePopulated) return

    if (isRefresh) setRefreshing(true)
    else if (!append) setLoading(true)

    const sortStr = `${sortDir === 'desc' ? '-' : ''}${sortField}`

    try {
      // Use pre-populated data on first load if available
      if (!append && pageNum === 1 && prePopulated && !isRefresh) {
        setDocs(prePopulated.docs as Array<Record<string, unknown>>)
        setHasNextPage(prePopulated.hasNextPage)
        setTotalDocs(prePopulated.totalDocs)
        setPage(1)
        return
      }

      if (localCollection && parentDocId) {
        // Local-first: query RxDB with proper reverse-relationship filter
        const selector: Record<string, unknown> = {
          _deleted: { $eq: false },
          [onField]: { $eq: parentDocId },
        }

        const results = await localCollection.find({
          selector,
          sort: [{ [sortField]: sortDir }],
          limit,
          skip: (pageNum - 1) * limit,
        }).exec()

        const newDocs = results.map((r: any) => r.toJSON())
        const count = await localCollection.count({ selector }).exec()

        if (append) {
          setDocs((prev) => [...prev, ...newDocs])
        } else {
          setDocs(newDocs)
        }
        setHasNextPage(pageNum * limit < count)
        setTotalDocs(count)
        setPage(pageNum)
      } else if (parentDocId) {
        // REST API fallback with proper WHERE filter
        const where: Record<string, unknown> = {
          [onField]: { equals: parentDocId },
        }

        // Handle polymorphic relationship target
        if (Array.isArray(field.targetField?.relationTo)) {
          where[onField] = {
            equals: {
              relationTo: formCtx?.slug,
              value: parentDocId,
            },
          }
        }

        // Merge with field-level where config
        const mergedWhere = field.where
          ? { and: [where, field.where] }
          : where

        const result = await payloadApi.find(
          { baseURL, token: auth.token },
          joinCollection,
          {
            page: pageNum,
            limit,
            sort: sortStr,
            depth: 0,
            where: mergedWhere,
          },
        )

        if (append) {
          setDocs((prev) => [...prev, ...result.docs])
        } else {
          setDocs(result.docs)
        }
        setHasNextPage(result.hasNextPage)
        setTotalDocs(result.totalDocs)
        setPage(pageNum)
      }
    } catch (err) {
      console.warn(`[JoinField] Failed to load ${joinCollection}:`, err)
      if (!append) setDocs([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [
    localCollection, baseURL, auth.token, joinCollection, onField,
    sortField, sortDir, limit, prePopulated, field.where,
    parentDocId, field.targetField?.relationTo, formCtx?.slug,
  ])

  // Initial load
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    loadDocs(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when sort changes (after initial load)
  useEffect(() => {
    if (!loadedRef.current) return
    loadDocs(1)
  }, [sortField, sortDir]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when parent doc ID becomes available (e.g. after initial save)
  useEffect(() => {
    if (!loadedRef.current || !parentDocId) return
    loadDocs(1)
  }, [parentDocId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !loading) {
      loadDocs(page + 1, true)
    }
  }, [hasNextPage, loading, page, loadDocs])

  const handleRefresh = useCallback(() => {
    loadDocs(1, false, true)
  }, [loadDocs])

  const handleColumnSort = useCallback((col: string) => {
    if (sortField === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(col)
      setSortDir('asc')
    }
  }, [sortField])

  // ---------------------------------------------------------------------------
  // Resolve collection label
  // ---------------------------------------------------------------------------

  const collectionLabel = useMemo(() => {
    if (!schema?.menuModel?.collections) return joinCollection
    const col = schema.menuModel.collections.find(
      (c: any) => c.slug === joinCollection,
    )
    return col?.labels?.plural || joinCollection
  }, [schema, joinCollection])

  const isPolymorphic = Array.isArray(field.collection)

  return {
    docs,
    loading,
    refreshing,
    hasNextPage,
    page,
    totalDocs,
    sortField,
    sortDir,
    parentDocId,
    prePopulated,
    columns,
    joinCollection,
    collectionLabel,
    isPolymorphic,
    handleLoadMore,
    handleRefresh,
    handleColumnSort,
  }
}
