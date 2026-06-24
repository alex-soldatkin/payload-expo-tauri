/**
 * DocumentList – paginated list for a collection, driven by the Payload REST
 * API or a local-first RxDB data source (`localData` prop).
 * Replaces the web admin's data table with a mobile-optimised card list.
 *
 * Supports:
 *  - Native search bar (iOS headerSearchBarOptions, text passed via `searchText` prop)
 *  - Structured field filters via FilterBottomSheet — multiple AND-combined
 *    filters with editable chips (tap a chip to re-open the editor pre-filled)
 *  - Sorting — native menu picker on iOS (bottom-sheet fallback elsewhere)
 *    with asc/desc toggle, persisted per collection; controllable via
 *    `sort`/`onSortChange` so screens can host a toolbar menu instead
 *  - Pagination — honours the collection's `admin.pagination.defaultLimit`,
 *    per-page selector in the settings sheet, infinite scroll with
 *    "X–Y of Z" meta
 *  - Empty states — native ContentUnavailableView (iOS 17+) with three
 *    variants (no docs / no search results / filtered out), JS fallback
 *  - Liquid-glass row cards on iOS 26+ with themed fallbacks; dark mode
 *  - Pull-to-refresh and infinite scroll
 *  - Tablet table mode (`tableMode`) — web-admin-parity rows: frozen title
 *    column (+ status pill with drafts), horizontally scrollable type-aware
 *    fixed-width field columns and a sticky tap-to-sort header band that
 *    drives the shared horizontal scroll (see DocumentListTable for the
 *    structure decision)
 *
 * The REST / local-first data pipeline (pagination, sort, find loader,
 * refresh / infinite scroll) lives in ./hooks/useDocumentListData; the card
 * and table rows in ./components.
 */
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native'
// Tablet table mode — frozen title column + shared-translate column track
import { buildTableColumns } from '../DocumentListTable'

import type { ClientField } from '../types'
import { extractRootFields, getFieldLabel } from '../utils/schemaHelpers'
import { usePayloadNative } from '../PayloadNativeProvider'
import { useDocumentListFilters } from '../hooks/useDocumentListFilters'
import type { ActiveFilter } from '../hooks/useDocumentListFilters'
import { useListColors } from '../hooks/useListColors'
import { FilterBottomSheet } from '../FilterBottomSheet'
import { EmptyState } from './components/EmptyState'
import { SummaryFieldsPicker } from './components/SummaryFieldsPicker'
import { DocumentListCard } from './components/DocumentListCard'
import { DocumentListTableRowItem } from './components/DocumentListTableRowItem'
import { DocumentListHeader } from './components/DocumentListHeader'
import { useDocumentListData } from './hooks/useDocumentListData'
import { getSortableFields } from './utils/sort'
import { formatDate, formatFieldValue } from './utils/formatValue'
import { createStyles } from './styles'
import type { DocumentListProps, EmptyVariant } from './types'

// Re-exports — public import path (`./DocumentList`) is unchanged.
export type { DocumentListSort } from './types'
export { getSortableFields, sortToQueryString } from './utils/sort'

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList)

export const DocumentList: React.FC<DocumentListProps> = ({
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
  sort: sortProp,
  onSortChange,
  onScroll,
  scrollEventThrottle = 16,
  queryPresetsCollection,
  appliedFilters,
  onFiltersChange,
  tableMode = false,
  pinFirstColumn = true,
  stickyHeader = true,
  onTablePinsChange,
}) => {
  const { baseURL, auth, schema } = usePayloadNative()
  const { dark, colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  // baseURL is also used below for resolving upload image thumbnail URLs

  // Filter sheet visibility — internal opens (chip tap / "+ Filter") are
  // OR-ed with the externally controlled prop so chips can re-open the
  // editor even when the screen owns the toolbar button.
  const [internalFilterOpen, setInternalFilterOpen] = useState(false)
  const [editingFilter, setEditingFilter] = useState<ActiveFilter | null>(null)
  const filterSheetVisible = Boolean(externalFilterOpen) || internalFilterOpen
  const closeFilterSheet = useCallback(() => {
    setInternalFilterOpen(false)
    setEditingFilter(null)
    onFilterSheetClose?.()
  }, [onFilterSheetClose])
  const openFilterEditor = useCallback((filter: ActiveFilter | null) => {
    setEditingFilter(filter)
    setInternalFilterOpen(true)
  }, [])

  const [internalPickerOpen, setInternalPickerOpen] = useState(false)
  const summaryPickerOpen = externalPickerOpen ?? internalPickerOpen
  const closeSummaryPicker = onSummaryPickerClose ?? (() => setInternalPickerOpen(false))

  const {
    searchText,
    setSearchText,
    filters,
    addFilter,
    updateFilter,
    removeFilter,
    setFilterGroups,
    clearAllFilters,
    whereQuery,
    hasActiveFilters,
  } = useDocumentListFilters({ searchFields })

  // Sync external search text from native header search bar
  useEffect(() => {
    if (externalSearchText != null) setSearchText(externalSearchText)
  }, [externalSearchText, setSearchText])

  // ── Preset application / lifting ──
  // Replace the active filters whenever the screen bumps appliedFilters.epoch
  // (epoch 0 = never applied — skipped so mounts don't clobber state).
  const appliedEpochRef = useRef(0)
  useEffect(() => {
    if (!appliedFilters || appliedFilters.epoch === appliedEpochRef.current) return
    appliedEpochRef.current = appliedFilters.epoch
    setFilterGroups(appliedFilters.groups)
  }, [appliedFilters, setFilterGroups])

  // Report filter changes upward so the screen can save them into a preset
  useEffect(() => {
    onFiltersChange?.(filters)
  }, [filters, onFiltersChange])

  // Schema-derived filterable/sortable fields
  const filterableFields: ClientField[] = useMemo(
    () => (schemaMap ? extractRootFields(schemaMap, collection) : []),
    [schemaMap, collection],
  )
  const sortableFields = useMemo(() => getSortableFields(filterableFields), [filterableFields])

  /** Resolve field labels and types from the schema. */
  const { fieldLabelMap, fieldTypeMap } = useMemo(() => {
    const labels = new Map<string, string>()
    const types = new Map<string, string>()
    for (const f of filterableFields) {
      if (f.name) {
        labels.set(f.name, getFieldLabel(f))
        types.set(f.name, f.type)
      }
    }
    return { fieldLabelMap: labels, fieldTypeMap: types }
  }, [filterableFields])

  // ── Tablet table mode — column model + shared horizontal scroll ──────
  // The title field / drafts flag come from props with a menu-model fallback,
  // so screens only need to pass `tableMode` to opt in.
  const menuCollection = useMemo(
    () => schema?.menuModel?.collections.find((c) => c.slug === collection),
    [schema, collection],
  )
  const tableTitleField = titleField ?? menuCollection?.useAsTitle
  const tableHasDrafts = Boolean(menuCollection?.drafts)

  const sortableFieldNames = useMemo(
    () => new Set(sortableFields.map((f) => f.name).filter((n): n is string => Boolean(n))),
    [sortableFields],
  )

  const tableColumns = useMemo(
    () =>
      tableMode
        ? buildTableColumns({
            summaryFields,
            titleField: tableTitleField,
            hasDrafts: tableHasDrafts,
            fieldLabelMap,
            fieldTypeMap,
            sortableFieldNames,
          })
        : [],
    [tableMode, summaryFields, tableTitleField, tableHasDrafts, fieldLabelMap, fieldTypeMap, sortableFieldNames],
  )
  const tableTrackWidth = useMemo(
    () => tableColumns.reduce((sum, c) => sum + c.width, 0),
    [tableColumns],
  )

  // ONE shared horizontal scroll position: the sticky header band's
  // ScrollView writes scrollX (native-driver Animated.event); every row's
  // column track consumes its negation as translateX. The header component
  // resets the offset whenever the column set changes.
  const tableScrollX = useRef(new Animated.Value(0)).current
  const tableTranslateX = useMemo(
    () => Animated.multiply<number>(tableScrollX, -1),
    [tableScrollX],
  )

  // ── REST / local-first data pipeline (pagination, sort, loader) ──────
  const {
    data,
    error,
    pageSize,
    pageSizeOptions,
    handlePageSizeChange,
    effectiveSort,
    handleSortChange,
    handleHeaderSortPress,
    effectiveDocs,
    effectiveTotalDocs,
    effectiveLoading,
    refreshing,
    rangeLabel,
    handleRefresh,
    handleEndReached,
    retry,
    hasNextPage,
    isLocal,
  } = useDocumentListData({
    collection,
    baseURL,
    authToken: auth.token,
    schema,
    limit,
    localData,
    whereQuery,
    sortProp,
    onSortChange,
    sortableFields,
  })

  const renderItem = ({ item, index }: { item: unknown; index: number }) => {
    const doc = item as Record<string, unknown>

    // ── Tablet table mode — frozen title + shared-translate column track.
    // The row stays ONE viewport-width unit so screen-level wrapping
    // (swipe-to-delete, long-press peek, selection checkbox) keeps working
    // verbatim around `rowContent`.
    if (tableMode) {
      return (
        <DocumentListTableRowItem
          doc={doc}
          index={index}
          tableTitleField={tableTitleField}
          columns={tableColumns}
          trackWidth={tableTrackWidth}
          hasDrafts={tableHasDrafts}
          translateX={tableTranslateX}
          formatValue={formatFieldValue}
          colors={colors}
          pinFirstColumn={pinFirstColumn}
          styles={styles}
          onPress={onPress}
          onDelete={onDelete}
          renderRow={renderRow}
        />
      )
    }

    // ── Phone card mode ───────────────────────────────────────────
    return (
      <DocumentListCard
        doc={doc}
        index={index}
        titleField={titleField}
        summaryFields={summaryFields}
        fieldTypeMap={fieldTypeMap}
        fieldLabelMap={fieldLabelMap}
        baseURL={baseURL}
        styles={styles}
        formatDate={formatDate}
        formatFieldValue={formatFieldValue}
        onPress={onPress}
        onDelete={onDelete}
        renderRow={renderRow}
      />
    )
  }

  // --- Header rendered above the list (element, not component — avoids
  // remounting the native sort picker on every render) ---
  const listHeader = (
    <DocumentListHeader
      tableMode={tableMode}
      styles={styles}
      colors={colors}
      hasActiveFilters={hasActiveFilters}
      filters={filters}
      searchText={searchText}
      onRemoveFilter={removeFilter}
      onClearAllFilters={clearAllFilters}
      onOpenFilterEditor={openFilterEditor}
      rangeLabel={rangeLabel}
      effectiveSort={effectiveSort}
      sortableFields={sortableFields}
      onSortChange={handleSortChange}
      tableColumns={tableColumns}
      tableTitleField={tableTitleField}
      fieldLabelMap={fieldLabelMap}
      fieldTypeMap={fieldTypeMap}
      sortableFieldNames={sortableFieldNames}
      onHeaderSortPress={handleHeaderSortPress}
      tableScrollX={tableScrollX}
      pinFirstColumn={pinFirstColumn}
    />
  )

  const extraData = useMemo(
    () => ({ summaryFields, dark, tableMode, pinFirstColumn }),
    [summaryFields, dark, tableMode, pinFirstColumn],
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
        <Pressable style={styles.retryBtn} onPress={retry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  const emptyVariant: EmptyVariant =
    searchText.trim().length > 0 ? 'search' : filters.length > 0 ? 'filtered' : 'none'

  return (
    <View style={styles.container}>
      <AnimatedFlatList
        data={effectiveDocs}
        keyExtractor={(item) => String((item as Record<string, unknown>).id)}
        renderItem={renderItem}
        extraData={extraData}
        ListHeaderComponent={listHeader}
        // Table mode pins the column header band (and any filter chips) at
        // the adjusted top — index 0 is the ListHeaderComponent, the only
        // sticky index that survives virtualization. stickyHeader=false
        // drops the pin so the band scrolls away with the content.
        stickyHeaderIndices={tableMode && stickyHeader ? [0] : undefined}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        contentInsetAdjustmentBehavior="automatic"
        onScroll={onScroll}
        scrollEventThrottle={onScroll ? scrollEventThrottle : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={tableMode ? styles.tableListContent : styles.listContent}
        ListEmptyComponent={
          <EmptyState
            variant={emptyVariant}
            searchText={searchText.trim()}
            onClearFilters={emptyVariant === 'none' ? undefined : clearAllFilters}
            colors={colors}
            styles={styles}
          />
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {!isLocal && hasNextPage ? (
              <ActivityIndicator style={styles.footerSpinner} />
            ) : null}
            {rangeLabel != null && effectiveDocs.length > 0 ? (
              <Text style={styles.footerMeta}>{rangeLabel}</Text>
            ) : null}
          </View>
        }
      />

      {/* Filter bottom sheet — adds new filters or edits an existing chip.
          With queryPresetsCollection set it gains the OR-group overview +
          a Presets section (payload-query-presets, REST-only). */}
      <FilterBottomSheet
        visible={filterSheetVisible}
        onClose={closeFilterSheet}
        fields={filterableFields}
        initialFilter={editingFilter}
        onApply={(payload) => {
          const { id, ...rest } = payload
          if (id) updateFilter(id, rest)
          else addFilter(rest)
          closeFilterSheet()
        }}
        {...(queryPresetsCollection
          ? {
              activeFilters: filters,
              onRemoveFilter: removeFilter,
              presetsCollection: queryPresetsCollection,
              presetsColumns: summaryFields,
              onApplyFilterGroups: setFilterGroups,
            }
          : {})}
      />

      {/* Summary fields picker + list settings bottom sheet */}
      {onSummaryFieldsChange && (
        <SummaryFieldsPicker
          visible={summaryPickerOpen}
          onClose={closeSummaryPicker}
          fields={filterableFields}
          summaryFields={summaryFields}
          onSummaryFieldsChange={onSummaryFieldsChange}
          collection={collection}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={handlePageSizeChange}
          // Table pin toggles — only meaningful (and only shown) in table
          // mode, when the screen wires up persistence.
          tablePins={
            tableMode && onTablePinsChange
              ? { header: stickyHeader, firstColumn: pinFirstColumn }
              : undefined
          }
          onTablePinsChange={onTablePinsChange}
        />
      )}
    </View>
  )
}
