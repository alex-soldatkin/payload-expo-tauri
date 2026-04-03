/**
 * JoinField — Native mobile component for Payload's join field type.
 *
 * Renders a scrollable table of related documents from the joined collection,
 * filtered by the inverse relationship (`on` field equals current doc ID).
 *
 * Features:
 * - Configurable columns via `admin.defaultColumns` from Payload config
 * - Horizontal scroll for wide tables, vertical scroll for many rows
 * - Tappable rows → navigate to the related document (Link.Preview for peek/pop)
 * - Local-first: queries RxDB with proper WHERE filter, falls back to REST API
 * - Pagination with "Load more" button
 * - Pull-to-refresh
 * - Column header tap to toggle sort direction
 * - Empty state when no related docs exist or doc not yet saved
 * - Polymorphic join badge for multi-collection joins
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import type { ClientJoinField, FieldComponentProps, PaginatedDocs } from '../types'
import { defaultTheme as t } from '../theme'
import { getFieldDescription, getFieldLabel } from '../schemaHelpers'
import { usePayloadNative } from '../PayloadNativeProvider'
import { useFormData } from '../FormDataContext'
import { payloadApi } from '../api'
import { FieldShell } from './shared'

// No expo-router imports — shared packages must never use router hooks directly.
// Navigation is handled via onRowPress callback prop.

// Dynamic local-db hooks (optional peer dep)
let _useLocalDB: (() => any) | null = null
try {
  _useLocalDB = require('@payload-universal/local-db').useLocalDB
} catch { /* local-db not available */ }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default columns when none specified in config. */
const DEFAULT_COLUMNS = ['id', 'createdAt', 'updatedAt']

/** Column width constraints. */
const COLUMN_MIN_WIDTH = 120
const COLUMN_MAX_WIDTH = 220

/** Best-effort display value for a cell. */
const formatCellValue = (val: unknown): string => {
  if (val === null || val === undefined) return '\u2014'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    // Populated relationship — show title/name/email/id
    return String(obj.title ?? obj.name ?? obj.email ?? obj.id ?? JSON.stringify(val))
  }
  // ISO date → readable format
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    try {
      return new Date(val).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return val }
  }
  return String(val)
}

/** Parse pre-populated join value (Payload sends paginated docs for join fields). */
const parseJoinValue = (value: unknown): PaginatedDocs | null => {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (Array.isArray(v.docs)) return v as unknown as PaginatedDocs
  return null
}

/** Pretty-print a column name: 'createdAt' → 'Created At'. */
const formatColumnName = (col: string): string =>
  col.charAt(0).toUpperCase() + col.slice(1).replace(/([A-Z])/g, ' $1')

// ---------------------------------------------------------------------------
// JoinField Component
// ---------------------------------------------------------------------------

export const JoinField: React.FC<FieldComponentProps<ClientJoinField>> = ({
  field,
  value,
  // onChange not used — join fields are read-only by nature
}) => {
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // If the document hasn't been saved yet, show a placeholder
  if (!parentDocId && !prePopulated) {
    return (
      <FieldShell
        label={getFieldLabel(field, collectionLabel)}
        description={getFieldDescription(field)}
      >
        <View style={styles.container}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Save this document to see related {collectionLabel}
            </Text>
          </View>
        </View>
      </FieldShell>
    )
  }

  const renderHeader = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.headerRow}>
      {columns.map((col) => {
        const isActive = sortField === col
        const arrow = isActive ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''
        return (
          <Pressable
            key={col}
            style={[styles.headerCell, { minWidth: COLUMN_MIN_WIDTH, maxWidth: COLUMN_MAX_WIDTH }]}
            onPress={() => handleColumnSort(col)}
          >
            <Text style={[styles.headerText, isActive && styles.headerTextActive]} numberOfLines={1}>
              {formatColumnName(col)}{arrow}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )

  const renderRow = ({ item }: { item: Record<string, unknown> }) => {
    const docId = String(item.id ?? '')
    const href = `/(admin)/collections/${joinCollection}/${docId}`

    const rowContent = (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dataRow}>
        {columns.map((col) => (
          <View key={col} style={[styles.dataCell, { minWidth: COLUMN_MIN_WIDTH, maxWidth: COLUMN_MAX_WIDTH }]}>
            <Text style={styles.cellText} numberOfLines={2}>
              {formatCellValue(item[col])}
            </Text>
          </View>
        ))}
      </ScrollView>
    )

    return (
      <View style={styles.rowPressable}>
        {rowContent}
      </View>
    )
  }

  const renderEmpty = () => {
    if (loading) return null
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No related {collectionLabel} found</Text>
      </View>
    )
  }

  const renderFooter = () => {
    if (!hasNextPage && !loading) return null
    return (
      <View style={styles.footer}>
        {loading && page > 1 && <ActivityIndicator size="small" />}
        {hasNextPage && !loading && (
          <Pressable style={styles.loadMoreBtn} onPress={handleLoadMore}>
            <Text style={styles.loadMoreText}>
              Load more ({totalDocs - docs.length} remaining)
            </Text>
          </Pressable>
        )}
      </View>
    )
  }

  return (
    <FieldShell
      label={getFieldLabel(field, collectionLabel)}
      description={getFieldDescription(field)}
    >
      <View style={styles.container}>
        {/* Table header bar */}
        <View style={styles.tableHeader}>
          <Text style={styles.countText}>
            {totalDocs > 0
              ? `${totalDocs} ${totalDocs === 1 ? 'item' : 'items'}`
              : ''}
          </Text>
          {isPolymorphic && (
            <View style={styles.badgeContainer}>
              {(field.collection as string[]).map((slug) => (
                <Text key={slug} style={[
                  styles.collectionBadge,
                  slug === joinCollection && styles.collectionBadgeActive,
                ]}>
                  {slug}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Loading spinner for initial load */}
        {loading && docs.length === 0 && (
          <ActivityIndicator style={styles.spinner} />
        )}

        {/* Column headers */}
        {docs.length > 0 && renderHeader()}

        {/* Data rows */}
        <FlatList
          data={docs}
          keyExtractor={(item) => String(item.id ?? Math.random())}
          renderItem={renderRow}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          scrollEnabled={false}
          nestedScrollEnabled
        />
      </View>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
    backgroundColor: t.colors.background,
  },
  countText: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    fontWeight: '500',
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: t.spacing.xs,
  },
  collectionBadge: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    fontWeight: '500',
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
  },
  collectionBadgeActive: {
    color: t.colors.primary,
    fontWeight: '600',
    backgroundColor: '#e8e8e8',
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
    backgroundColor: t.colors.background,
  },
  headerCell: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    justifyContent: 'center',
  },
  headerText: {
    fontSize: t.fontSize.xs,
    fontWeight: '600',
    color: t.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTextActive: {
    color: t.colors.primary,
  },
  rowPressable: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
  },
  dataRow: {
    flexDirection: 'row',
  },
  dataCell: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: t.fontSize.sm,
    color: t.colors.text,
  },
  emptyContainer: {
    paddingVertical: t.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: t.fontSize.sm,
    color: t.colors.textMuted,
    fontStyle: 'italic',
  },
  footer: {
    paddingVertical: t.spacing.md,
    alignItems: 'center',
  },
  loadMoreBtn: {
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.background,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  loadMoreText: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: t.colors.primary,
  },
  spinner: {
    marginVertical: t.spacing.xl,
  },
})
