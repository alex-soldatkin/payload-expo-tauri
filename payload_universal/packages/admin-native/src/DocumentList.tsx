/**
 * DocumentList – paginated FlatList for a collection, driven by the Payload REST API.
 * Replaces the web admin's data table with a mobile-optimised list.
 *
 * Supports:
 *  - Native search bar (iOS headerSearchBarOptions, text passed via `searchText` prop)
 *  - Structured field filters via FilterBottomSheet
 *  - Active filter chip indicators
 *  - Pull-to-refresh and infinite scroll
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import type { ClientField, PaginatedDocs, SerializedSchemaMap } from './types'
import { defaultTheme as t } from './theme'
import { extractRootFields, getDocumentTitle } from './schemaHelpers'
import { usePayloadNative } from './PayloadNativeProvider'
import { payloadApi } from './api'
import { useDocumentListFilters } from './useDocumentListFilters'
import { FilterChips } from './FilterChips'
import { FilterBottomSheet } from './FilterBottomSheet'

type Props = {
  /** Collection slug */
  collection: string
  /** Called when a row is tapped */
  onPress: (doc: Record<string, unknown>) => void
  /** Called when "Create" is tapped */
  onCreate?: () => void
  /** Number of docs per page */
  limit?: number
  /** Field name used as the display title for each row */
  titleField?: string
  /** Optional subtitle renderer */
  renderSubtitle?: (doc: Record<string, unknown>) => string | undefined
  /** Extra top padding (e.g. for transparent headers) */
  contentInsetTop?: number
  /** Schema map for this collection (enables field-based filters) */
  schemaMap?: SerializedSchemaMap<unknown>
  /** Externally controlled search text (from native header search bar) */
  searchText?: string
  /** Fields to search across for text search */
  searchFields?: string[]
  /**
   * Optional external data source (e.g. from local-db).
   * When provided, the component skips its own REST API calls
   * and uses this data directly. The parent is responsible for
   * filtering/pagination.
   */
  localData?: {
    docs: Record<string, unknown>[]
    totalDocs: number
    loading: boolean
    refetch: () => void
  }
}

export const DocumentList: React.FC<Props> = ({
  collection,
  onPress,
  onCreate,
  limit = 20,
  titleField,
  renderSubtitle,
  contentInsetTop = 0,
  schemaMap,
  searchText: externalSearchText,
  searchFields,
  localData,
}) => {
  const { baseURL, auth } = usePayloadNative()
  const [data, setData] = useState<PaginatedDocs | null>(null)
  const [loading, setLoading] = useState(!localData)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // When local data is provided, use it as the primary data source
  const effectiveDocs = localData?.docs ?? data?.docs ?? []
  const effectiveTotalDocs = localData?.totalDocs ?? data?.totalDocs ?? 0
  const effectiveLoading = localData ? localData.loading : loading

  const {
    searchText,
    setSearchText,
    filters,
    addFilter,
    removeFilter,
    clearAllFilters,
    whereQuery,
    hasActiveFilters,
  } = useDocumentListFilters({ searchFields })

  // Sync external search text from native header search bar
  useEffect(() => {
    if (externalSearchText != null) setSearchText(externalSearchText)
  }, [externalSearchText, setSearchText])

  // Schema-derived filterable fields
  const filterableFields: ClientField[] = schemaMap
    ? extractRootFields(schemaMap, collection)
    : []

  const tokenRef = useRef(auth.token)
  tokenRef.current = auth.token

  // Stable request counter to discard stale responses
  const requestIdRef = useRef(0)

  const load = useCallback(
    async (p: number, append = false, where?: Record<string, unknown>) => {
      const token = tokenRef.current
      if (!token) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      const reqId = ++requestIdRef.current
      try {
        setError(null)
        const result = await payloadApi.find({ baseURL, token }, collection, {
          page: p,
          limit,
          depth: 0,
          sort: '-updatedAt',
          where,
        })
        // Discard if a newer request was started
        if (reqId !== requestIdRef.current) return
        setData((prev) =>
          append && prev
            ? { ...result, docs: [...prev.docs, ...result.docs] }
            : result,
        )
      } catch (err) {
        if (reqId !== requestIdRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [baseURL, collection, limit],
  )

  // Initial load + re-load when filters/search change
  useEffect(() => {
    if (!auth.token) return
    setLoading(true)
    setPage(1)
    load(1, false, whereQuery as Record<string, unknown> | undefined)
  }, [auth.token, load, whereQuery])

  const handleRefresh = () => {
    if (localData) {
      localData.refetch()
      return
    }
    setRefreshing(true)
    setPage(1)
    load(1, false, whereQuery as Record<string, unknown> | undefined)
  }

  const handleEndReached = () => {
    if (!localData && data?.hasNextPage && !loading) {
      const next = page + 1
      setPage(next)
      load(next, true, whereQuery as Record<string, unknown> | undefined)
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  const renderItem = ({ item }: { item: Record<string, unknown> }) => {
    const title = getDocumentTitle(item, titleField)
    const subtitle = renderSubtitle?.(item) ?? (item.updatedAt ? `Updated ${formatDate(item.updatedAt as string)}` : undefined)

    return (
      <Pressable style={styles.row} onPress={() => onPress(item)}>
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
        <Text style={styles.rowChevron}>›</Text>
      </Pressable>
    )
  }

  // --- Header component rendered above the list ---
  const ListHeader = () => (
    <View>
      {onCreate && (
        <Pressable style={styles.createBtn} onPress={onCreate}>
          <Text style={styles.createText}>+ Create new</Text>
        </Pressable>
      )}

      {/* Filter chips / add filter */}
      <View style={styles.filterRow}>
        {hasActiveFilters ? (
          <FilterChips
            filters={filters}
            searchText={searchText}
            onRemove={removeFilter}
            onClearAll={clearAllFilters}
            onAddFilter={() => setFilterSheetOpen(true)}
          />
        ) : filterableFields.length > 0 ? (
          <Pressable style={styles.filterBtn} onPress={() => setFilterSheetOpen(true)}>
            <Text style={styles.filterBtnText}>Filters</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Result count when filters active */}
      {hasActiveFilters && effectiveTotalDocs > 0 && (
        <Text style={styles.resultCount}>
          {effectiveTotalDocs} result{effectiveTotalDocs !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
  )

  if (effectiveLoading && effectiveDocs.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); load(1, false, whereQuery as Record<string, unknown> | undefined) }}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={effectiveDocs}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={[
          styles.listContent,
          contentInsetTop > 0 && { paddingTop: contentInsetTop },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyCenter}>
            <Text style={styles.emptyText}>
              {hasActiveFilters ? 'No documents match your filters' : 'No documents yet'}
            </Text>
            {hasActiveFilters && (
              <Pressable style={styles.clearFiltersBtn} onPress={clearAllFilters}>
                <Text style={styles.clearFiltersText}>Clear filters</Text>
              </Pressable>
            )}
          </View>
        }
        ListFooterComponent={
          !localData && data?.hasNextPage ? <ActivityIndicator style={{ paddingVertical: 16 }} /> : null
        }
      />

      {/* Filter bottom sheet */}
      <FilterBottomSheet
        visible={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        fields={filterableFields}
        onApply={(f) => { addFilter(f); setFilterSheetOpen(false) }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.background },
  listContent: { paddingHorizontal: t.spacing.lg, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl },

  // Create button
  createBtn: {
    marginTop: t.spacing.md,
    marginBottom: t.spacing.sm,
    paddingVertical: t.spacing.md,
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.sm,
    alignItems: 'center',
  },
  createText: { color: t.colors.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },

  // Filter row
  filterRow: { marginVertical: t.spacing.xs },
  filterBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 20,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
  },
  filterBtnText: { fontSize: t.fontSize.sm, color: t.colors.text, fontWeight: '500' },

  resultCount: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    marginBottom: t.spacing.sm,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.lg,
    marginBottom: t.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: t.fontSize.md, fontWeight: '600', color: t.colors.text },
  rowSubtitle: { fontSize: t.fontSize.sm, color: t.colors.textMuted, marginTop: 2 },
  rowChevron: { fontSize: 20, color: t.colors.textMuted, marginLeft: t.spacing.sm },

  // States
  errorText: { color: t.colors.error, fontSize: t.fontSize.md, textAlign: 'center', marginBottom: t.spacing.md },
  retryBtn: { paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.sm, backgroundColor: t.colors.primary, borderRadius: t.borderRadius.sm },
  retryText: { color: t.colors.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },
  emptyCenter: { alignItems: 'center', paddingVertical: t.spacing.xxl },
  emptyText: { color: t.colors.textMuted, fontSize: t.fontSize.md },
  clearFiltersBtn: { marginTop: t.spacing.md },
  clearFiltersText: { color: t.colors.primary, fontSize: t.fontSize.sm, fontWeight: '600' },
})
