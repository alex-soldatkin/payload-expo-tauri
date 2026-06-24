/**
 * Document list for a collection — always local-first.
 *
 * Phone:
 *   - Card-style rows with summary fields
 *   - Header icons: ⚙ Settings, ▽ Filter, + Create
 *   - Swipe left to delete (with confirmation)
 *   - Shake to undo the last delete
 *   - Link.Preview (long-press peek) rendered inside Expo Router tree
 *
 * Tablet:
 *   - Table-style rows (title, summary fields, status, date) matching
 *     Payload web admin dashboard
 *   - Same header actions and long-press preview
 *
 * This route file is intentionally thin: route params + the data pipeline
 * wiring + composing extracted pieces. Sub-components, the row/peek renderers,
 * pure helpers and styles live under src/screens/collection-list/.
 */
import React, { useCallback, useMemo, useState } from 'react'
import { Animated as RNAnimated, useWindowDimensions } from 'react-native'
import { useLocalSearchParams, useIsPreview } from 'expo-router'
import { useHeaderHeight } from "expo-router/react-navigation"
import {
  extractRootFields,
  getCollectionLabel,
  useAdminSchema,
  useCustomComponentRegistry,
  useListColors,
  useMenuModel,
  type ActiveFilter,
} from '@payload-universal/admin-native'
import { useLocalDB, useLocalCollection, useLocalDBStatus, useLocalMutations } from '@payload-universal/local-db'
import { useHeaderScrollY } from '@/components/HeaderScrollContext'
import { useResponsive } from '@/hooks/useResponsive'
import {
  ListScreenContent,
  useBoardMutations,
  useBoardViews,
  useListActions,
  useListFilters,
  useListPersistence,
  useListRowRenderers,
  useScanner,
} from '@/src/screens/collection-list'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CollectionDocumentsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const headerScrollY = useHeaderScrollY()
  const scrollHandler = useMemo(
    () =>
      RNAnimated.event(
        [{ nativeEvent: { contentOffset: { y: headerScrollY } } }],
        { useNativeDriver: true },
      ),
    [headerScrollY],
  )
  const menuModel = useMenuModel()
  const schema = useAdminSchema()
  const headerHeight = useHeaderHeight()
  const isPreview = useIsPreview()
  const [searchText, setSearchText] = useState('')
  const { showSidebar } = useResponsive()
  // Dark-mode aware palette for the screen chrome / table rows
  const { colors: tc } = useListColors()

  const label = menuModel ? getCollectionLabel(menuModel, slug, true) : slug
  const schemaMap = schema?.collections[slug]
  const collectionMeta = menuModel?.collections.find((c) => c.slug === slug)
  const useAsTitle = collectionMeta?.useAsTitle
  const hasDrafts = collectionMeta?.drafts ?? false

  // Custom list actions from the admin schema + action handler registry.
  // Merge action metadata with labels from transpiled components (component
  // label wins — single source of truth: the Payload custom component).
  const listActions = collectionMeta?.listActions ?? []
  const componentRegistry = useCustomComponentRegistry()
  const listActionEntries = componentRegistry?.listActions?.[slug] ?? []
  const resolvedListActions = useMemo(
    () =>
      listActions.map((action, i) => ({
        ...action,
        label: listActionEntries[i]?.label ?? action.label,
      })),
    [listActions, listActionEntries],
  )

  // Always use local data — reactive, instant updates
  const localDB = useLocalDB()
  const { isReady } = useLocalDBStatus()
  const localResult = useLocalCollection(localDB, slug)
  const { remove } = useLocalMutations(localDB, slug)

  // Stable reference for localData — prevents DocumentList from re-rendering
  // on every parent render. Only changes when the actual data changes.
  const localData = useMemo(() => ({
    docs: localResult.docs as Record<string, unknown>[],
    totalDocs: localResult.totalDocs,
    loading: localResult.loading || !isReady,
    refetch: localResult.refetch,
  }), [localResult.docs, localResult.totalDocs, localResult.loading, isReady, localResult.refetch])

  // Stable docs snapshot for list-action handlers + bulk edit
  const allDocs = (localResult.docs ?? []) as Record<string, unknown>[]

  // ── Multi-select + bulk actions + custom list-action dispatch ──────────
  const actions = useListActions(slug, localDB, allDocs)

  // Schema fields for this collection — feeds sort, filters, board configs,
  // bulk edit and the validated mutation pipeline.
  const rootFields = useMemo(
    () => (schemaMap ? extractRootFields(schemaMap, slug) : []),
    [schemaMap, slug],
  )

  // UI sheet state owned by the screen (the persistence hook owns the values).
  const [summaryPickerOpen, setSummaryPickerOpen] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // ── Persisted per-collection list preferences — summary fields, sort
  // (shared key with DocumentList's internal sort) and table pins ──────────
  const persistence = useListPersistence(slug, rootFields)

  // ── Kanban / calendar / gantt view wiring — configs, availability gates,
  // resolved sources, gantt header controls and view-mode switching ────────
  const views = useBoardViews(slug, rootFields, actions.exitSelectionMode)

  // ── Kanban/calendar/gantt filter pipeline + view presets + the client-side
  // filtered/sorted boardDocs that feed the overlay views ──────────────────
  const filters = useListFilters({
    useAsTitle,
    searchText,
    setFilterSheetOpen,
    rootFields,
    isKanban: views.isKanban,
    isCalendar: views.isCalendar,
    isGantt: views.isGantt,
    kanbanAvailable: views.kanbanAvailable,
    calendarAvailable: views.calendarAvailable,
    ganttAvailable: views.ganttAvailable,
    handleViewModeChange: views.handleViewModeChange,
    setKanbanConfig: views.setKanbanConfig,
    setCalendarConfig: views.setCalendarConfig,
    setGanttConfig: views.setGanttConfig,
    setCalendarModeOverride: views.setCalendarModeOverride,
    calendarSources: views.calendarSources,
    calendarMode: views.calendarMode,
    ganttSources: views.ganttSources,
    ganttConfig: views.ganttConfig,
    localDocs: localData.docs,
    effectiveSort: persistence.effectiveSort,
  })

  // ── Local-first mutations — kanban card moves, gantt date edits,
  // swipe-to-delete + shake-to-undo (all optimistic, validated pipeline) ──
  const { movingDocIds, handleMoveCard, handleGanttUpdateDates, handleDelete } = useBoardMutations({
    localDB,
    slug,
    rootFields,
    kanbanStatusField: views.kanbanStatusField,
    remove,
    isPreview,
  })

  // Preview dimensions
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const PREVIEW_W = Math.round(windowWidth * 0.92)
  const PREVIEW_H = Math.round(windowHeight * 0.65)
  const noopSubmit = useCallback(async () => {}, [])

  // ── Row + peek renderers (table rows + calendar day-list rows). Owns the
  // single-preview tracking (one DocumentForm mounted at a time) and the
  // double-nav guard used by every navigation entry point. ─────────────────
  const renderers = useListRowRenderers({
    slug,
    schemaMap,
    isPreview,
    showSidebar,
    selectionMode: actions.selectionMode,
    selectedIds: actions.selectedIds,
    toggleSelection: actions.toggleSelection,
    handleDelete,
    previewWidth: PREVIEW_W,
    previewHeight: PREVIEW_H,
    noopSubmit,
  })
  const { navigateToDoc } = renderers

  // Board preview (kanban cards AND gantt bars) — opened by a STATIC
  // long-press (hold, release without moving; the PanResponder drag and the
  // preview share the long-press, disambiguated by finger travel) or from
  // the kanban card's ellipsis menu ("Preview"). Cards/bars are NOT wrapped
  // in ScrollablePreview.Trigger: the module's raw
  // UILongPressGestureRecognizer (0.35s) claims long-press at the UIKit
  // layer before the Pressable that drives drag-or-peek, so preview is a
  // pure-JS BottomSheet + read-only DocumentForm (same inline pattern as the
  // relationship picker, memory-bank 013).
  const [boardPreviewDoc, setBoardPreviewDoc] = useState<Record<string, unknown> | null>(null)

  // ── Scan-to-lookup — toolbar scanner popup resolving barcode/QR payloads
  // to documents (local-first with REST fallback, see useScanLookup). ──────
  const scanner = useScanner(slug, navigateToDoc)

  // Filter-chips strip shared by the kanban/calendar/gantt overlay views.
  const boardFilterChips = {
    hasActiveFilters: filters.kanbanHasActiveFilters,
    filters: filters.kanbanFilters,
    searchText: filters.kanbanSearchText,
    onRemove: filters.removeKanbanFilter,
    onClearAll: filters.clearKanbanFilters,
    onAddFilter: () => filters.setKanbanFilterInternalOpen(true),
    onEdit: (f: ActiveFilter) => {
      filters.setKanbanEditingFilter(f)
      filters.setKanbanFilterInternalOpen(true)
    },
  }

  // Settings sheet opener — mode-aware (kanban/calendar/gantt customize or the
  // table summary-field picker).
  const openSettingsSheet = useCallback(() => {
    if (views.isKanban) views.setKanbanCustomizeOpen(true)
    else if (views.isCalendar) views.setCalendarCustomizeOpen(true)
    else if (views.isGantt) views.setGanttCustomizeOpen(true)
    else setSummaryPickerOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views.isKanban, views.isCalendar, views.isGantt])

  return (
    <ListScreenContent
      slug={slug}
      label={label}
      isPreview={isPreview}
      backgroundColor={tc.background}
      headerHeight={headerHeight}
      showSidebar={showSidebar}
      searchText={searchText}
      setSearchText={setSearchText}
      useAsTitle={useAsTitle}
      hasDrafts={hasDrafts}
      schemaMap={schemaMap}
      rootFields={rootFields}
      localData={localData}
      localDocs={allDocs}
      scrollHandler={scrollHandler}
      noopSubmit={noopSubmit}
      views={views}
      filters={filters}
      actions={actions}
      persistence={persistence}
      scanner={scanner}
      navigateToDoc={navigateToDoc}
      renderRow={renderers.renderRow}
      renderDocWithPeek={renderers.renderDocWithPeek}
      boardFilterChips={boardFilterChips}
      resolvedListActions={resolvedListActions}
      movingDocIds={movingDocIds}
      onMoveCard={handleMoveCard}
      onGanttUpdateDates={handleGanttUpdateDates}
      onDelete={handleDelete}
      summaryPickerOpen={summaryPickerOpen}
      setSummaryPickerOpen={setSummaryPickerOpen}
      filterSheetOpen={filterSheetOpen}
      setFilterSheetOpen={setFilterSheetOpen}
      boardPreviewDoc={boardPreviewDoc}
      setBoardPreviewDoc={setBoardPreviewDoc}
      openSettingsSheet={openSettingsSheet}
    />
  );
}
