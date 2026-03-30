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
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native'
// ReanimatedSwipeable deferred — legacy Swipeable causes PanGestureHandler
// crash on iOS 26, and ReanimatedSwipeable has module interop issues.
// Swipe-to-delete uses a long-press alert fallback instead.

import type { ClientField, PaginatedDocs, SerializedSchemaMap } from './types'
import { defaultTheme as t } from './theme'
import { extractRootFields, getDocumentTitle, getFieldLabel } from './schemaHelpers'
import { usePayloadNative } from './PayloadNativeProvider'
import { payloadApi } from './api'
import { useDocumentListFilters } from './useDocumentListFilters'
import { FilterChips } from './FilterChips'
import { FilterBottomSheet } from './FilterBottomSheet'
import { BottomSheet } from './BottomSheet'

type Props = {
  /** Collection slug */
  collection: string
  /** Called when a row is tapped */
  onPress: (doc: Record<string, unknown>) => void
  /** Called when "Create" is tapped */
  onCreate?: () => void
  /** Called when a document is swiped to delete. If provided, enables swipe-to-delete. */
  onDelete?: (doc: Record<string, unknown>) => void
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
   * Build an href for a document row (informational — used by renderRow if provided).
   */
  docHref?: (doc: Record<string, unknown>) => string
  /**
   * Custom row renderer — allows the parent to wrap rows with Link.Preview etc.
   * Receives the default row content, the doc, and onPress handler.
   */
  renderRow?: (props: {
    item: Record<string, unknown>
    rowContent: React.ReactElement
    onPress: () => void
  }) => React.ReactElement
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
  /**
   * Field names to display as summary on each card (below the title).
   * Controlled externally — use with onSummaryFieldsChange for persistence.
   */
  summaryFields?: string[]
  /** Called when the user changes the summary field selection via the gear icon. */
  onSummaryFieldsChange?: (fields: string[]) => void
  /** Externally controlled: whether the summary picker bottom sheet is open. */
  summaryPickerOpen?: boolean
  /** Called when the summary picker should close. */
  onSummaryPickerClose?: () => void
  /** Externally controlled: whether the filter bottom sheet is open. */
  filterSheetOpen?: boolean
  /** Called when the filter sheet should close. */
  onFilterSheetClose?: () => void
}


export const DocumentList: React.FC<Props> = ({
  collection,
  onPress,
  onCreate,
  onDelete,
  limit = 20,
  titleField,
  renderSubtitle,
  contentInsetTop = 0,
  schemaMap,
  searchText: externalSearchText,
  searchFields,
  docHref,
  renderRow,
  localData,
  summaryFields = [],
  onSummaryFieldsChange,
  summaryPickerOpen: externalPickerOpen,
  onSummaryPickerClose,
  filterSheetOpen: externalFilterOpen,
  onFilterSheetClose,
}) => {
  const { baseURL, auth } = usePayloadNative()
  const [data, setData] = useState<PaginatedDocs | null>(null)
  const [loading, setLoading] = useState(!localData)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [internalFilterOpen, setInternalFilterOpen] = useState(false)
  const filterSheetOpen = externalFilterOpen ?? internalFilterOpen
  const closeFilterSheet = onFilterSheetClose ?? (() => setInternalFilterOpen(false))
  const [internalPickerOpen, setInternalPickerOpen] = useState(false)
  const summaryPickerOpen = externalPickerOpen ?? internalPickerOpen
  const closeSummaryPicker = onSummaryPickerClose ?? (() => setInternalPickerOpen(false))

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

  // Initial load + re-load when filters/search change (skip if using local data)
  useEffect(() => {
    if (localData) return
    if (!auth.token) return
    setLoading(true)
    setPage(1)
    load(1, false, whereQuery as Record<string, unknown> | undefined)
  }, [localData, auth.token, load, whereQuery])

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

  /** Format a field value for display on the card. */
  const formatFieldValue = (val: unknown): string => {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    if (typeof val === 'object') {
      // Relationship (populated object) — show title/name/email
      const obj = val as Record<string, unknown>
      return String(obj.title ?? obj.name ?? obj.email ?? obj.id ?? JSON.stringify(val))
    }
    const s = String(val)
    // Date-like strings — format nicely
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return formatDate(s)
    return s
  }

  /** Resolve a field's label from the schema. */
  const fieldLabelMap = new Map<string, string>()
  if (schemaMap) {
    for (const f of extractRootFields(schemaMap, collection)) {
      if (f.name) fieldLabelMap.set(f.name, getFieldLabel(f))
    }
  }

  const renderItem = ({ item }: { item: Record<string, unknown> }) => {
    const title = getDocumentTitle(item, titleField)
    const subtitle = renderSubtitle?.(item) ?? (item.updatedAt ? `Updated ${formatDate(item.updatedAt as string)}` : undefined)

    // Build summary lines from selected fields
    const summaryLines = summaryFields
      .filter((f) => f !== titleField) // don't duplicate the title
      .map((fieldName) => ({
        label: fieldLabelMap.get(fieldName) ?? fieldName,
        value: formatFieldValue(item[fieldName]),
      }))
      .filter((line) => line.value !== '—') // skip empty

    const rowContent = (
      <View style={styles.row}>
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>}
          {summaryLines.length > 0 && (
            <View style={styles.summaryContainer}>
              {summaryLines.map((line, i) => (
                <React.Fragment key={line.label}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel} numberOfLines={1}>{line.label}</Text>
                    <Text style={styles.summaryValue} numberOfLines={1}>{line.value}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
        <Text style={styles.rowChevron}>›</Text>
      </View>
    )

    // Determine the inner content (custom renderRow or default Pressable)
    let inner: React.ReactElement
    if (renderRow) {
      inner = renderRow({ item, rowContent, onPress: () => onPress(item) })
    } else {
      inner = (
        <Pressable style={styles.row} onPress={() => onPress(item)}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
            {subtitle && <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>}
          </View>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
      )
    }

    return inner
  }

  // --- Header component rendered above the list ---
  const ListHeader = () => (
    <View>
      {/* Active filter chips (only shown when filters are applied) */}
      {hasActiveFilters && (
        <View style={styles.filterRow}>
          <FilterChips
            filters={filters}
            searchText={searchText}
            onRemove={removeFilter}
            onClearAll={clearAllFilters}
            onAddFilter={closeFilterSheet}
          />
        </View>
      )}

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
        extraData={summaryFields}
        ListHeaderComponent={ListHeader}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContent}
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
        onClose={closeFilterSheet}
        fields={filterableFields}
        onApply={(f) => { addFilter(f); closeFilterSheet() }}
      />

      {/* Summary fields picker bottom sheet */}
      {onSummaryFieldsChange && (
        <BottomSheet visible={summaryPickerOpen} onClose={closeSummaryPicker} height={0.55}>
          <Text style={sfStyles.sheetTitle}>Card Display Fields</Text>
          <Text style={sfStyles.sheetHint}>Select fields to show on each card below the title.</Text>
          <FlatList
            data={filterableFields.filter((f) =>
              f.name && !['id', 'createdAt', 'updatedAt'].includes(f.name) &&
              ['text', 'email', 'number', 'date', 'select', 'radio', 'checkbox', 'relationship', 'upload', 'textarea', 'richText', 'point', 'json'].includes(f.type),
            )}
            keyExtractor={(item) => item.name!}
            renderItem={({ item: field }) => {
              const fieldName = field.name!
              const isSelected = summaryFields.includes(fieldName)
              return (
                <Pressable
                  style={sfStyles.fieldRow}
                  onPress={() => {
                    const next = isSelected
                      ? summaryFields.filter((f) => f !== fieldName)
                      : [...summaryFields, fieldName]
                    onSummaryFieldsChange(next)
                  }}
                >
                  <View style={[sfStyles.checkbox, isSelected && sfStyles.checkboxSelected]}>
                    {isSelected && <Text style={sfStyles.checkmark}>✓</Text>}
                  </View>
                  <View style={sfStyles.fieldInfo}>
                    <Text style={sfStyles.fieldLabel}>{getFieldLabel(field)}</Text>
                    <Text style={sfStyles.fieldType}>{field.type}</Text>
                  </View>
                </Pressable>
              )
            }}
            ListEmptyComponent={
              <Text style={sfStyles.emptyText}>No displayable fields</Text>
            }
          />
          {summaryFields.length > 0 && (
            <Pressable style={sfStyles.clearBtn} onPress={() => onSummaryFieldsChange([])}>
              <Text style={sfStyles.clearText}>Clear all</Text>
            </Pressable>
          )}
        </BottomSheet>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.background },
  listContent: { paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md, paddingBottom: 100, gap: t.spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl },

  // Create button
  createBtn: {
    paddingVertical: t.spacing.md,
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.sm,
    alignItems: 'center',
  },
  createText: { color: t.colors.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },

  // Filter row (only visible when filters are active)
  filterRow: { marginVertical: t.spacing.xs },

  resultCount: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    marginBottom: t.spacing.sm,
  },

  // Header top row (create + gear)
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginTop: t.spacing.md,
    marginBottom: t.spacing.sm,
  },

  // Gear icon
  gearBtn: {
    width: 44,
    height: 44,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: { fontSize: 20, color: t.colors.textMuted },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.lg,
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

  // Summary fields on cards
  summaryContainer: {
    marginTop: t.spacing.xs,
    gap: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  summaryLabel: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: t.fontSize.xs,
    color: t.colors.text,
    flex: 1,
  },

  // States
  errorText: { color: t.colors.error, fontSize: t.fontSize.md, textAlign: 'center', marginBottom: t.spacing.md },
  retryBtn: { paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.sm, backgroundColor: t.colors.primary, borderRadius: t.borderRadius.sm },
  retryText: { color: t.colors.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },
  emptyCenter: { alignItems: 'center', paddingVertical: t.spacing.xxl },
  emptyText: { color: t.colors.textMuted, fontSize: t.fontSize.md },
  clearFiltersBtn: { marginTop: t.spacing.md },
  clearFiltersText: { color: t.colors.primary, fontSize: t.fontSize.sm, fontWeight: '600' },
})


// Summary field picker styles
const sfStyles = StyleSheet.create({
  sheetTitle: { fontSize: t.fontSize.lg, fontWeight: '700', color: t.colors.text, marginBottom: 4 },
  sheetHint: { fontSize: t.fontSize.sm, color: t.colors.textMuted, marginBottom: t.spacing.md },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: t.spacing.md,
  },
  checkboxSelected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  checkmark: { fontSize: 13, color: '#fff', fontWeight: '700' },
  fieldInfo: { flex: 1 },
  fieldLabel: { fontSize: t.fontSize.md, color: t.colors.text, fontWeight: '500' },
  fieldType: { fontSize: t.fontSize.xs, color: t.colors.textMuted, marginTop: 1 },
  clearBtn: { paddingVertical: t.spacing.md, alignItems: 'center' },
  clearText: { fontSize: t.fontSize.sm, color: t.colors.destructive, fontWeight: '600' },
  emptyText: { textAlign: 'center', paddingVertical: t.spacing.xl, color: t.colors.textMuted, fontSize: t.fontSize.sm },
})
