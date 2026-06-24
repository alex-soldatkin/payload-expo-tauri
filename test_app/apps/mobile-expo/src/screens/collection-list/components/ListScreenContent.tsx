/**
 * Presentational shell for the collection-list screen — composes the header,
 * the optional selection action bar, the view-mode body, the overlay sheets and
 * the preview/scanner sheets. The route file does all the data wiring (hooks)
 * and hands the resolved view-model bundles here.
 *
 * Extracted verbatim from the route file's `return (…)`; behaviour is unchanged.
 */
import React from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { ScanLookupSheet } from '@/src/components/ScanLookupSheet'
import { ListScreenHeader } from './ListScreenHeader'
import { SelectionActionBar } from './SelectionActionBar'
import { ListBody } from './ListBody'
import { ListOverlaySheets } from './ListOverlaySheets'
import { BoardPreviewSheet, ScanMatchesSheet } from './PreviewSheets'
import type { BoardFilterChipsProps } from './BoardFilterChips'
import type { useBoardViews } from '../hooks/useBoardViews'
import type { useListFilters } from '../hooks/useListFilters'
import type { useListActions } from '../hooks/useListActions'
import type { useListPersistence } from '../hooks/useListPersistence'
import type { useScanner } from '../hooks/useScanner'
import type { useListRowRenderers } from '../hooks/useListRowRenderers'

type Views = ReturnType<typeof useBoardViews>
type Filters = ReturnType<typeof useListFilters>
type Actions = ReturnType<typeof useListActions>
type Persistence = ReturnType<typeof useListPersistence>
type Scanner = ReturnType<typeof useScanner>
type Renderers = ReturnType<typeof useListRowRenderers>
type LocalData = React.ComponentProps<typeof ListBody>['localData']
type SchemaMap = React.ComponentProps<typeof ListBody>['schemaMap']

export type ListScreenContentProps = {
  slug: string
  label: string
  isPreview: boolean
  backgroundColor: string
  headerHeight: number
  showSidebar: boolean
  searchText: string
  setSearchText: (text: string) => void
  useAsTitle?: string
  hasDrafts: boolean
  schemaMap: SchemaMap
  rootFields: React.ComponentProps<typeof ListOverlaySheets>['rootFields']
  localData: LocalData
  localDocs: Record<string, unknown>[]
  scrollHandler: React.ComponentProps<typeof ListBody>['onScroll']
  noopSubmit: () => Promise<void>
  // view-model bundles
  views: Views
  filters: Filters
  actions: Actions
  persistence: Persistence
  scanner: Scanner
  // renderers + derived
  navigateToDoc: Renderers['navigateToDoc']
  renderRow: Renderers['renderRow']
  renderDocWithPeek: Renderers['renderDocWithPeek']
  boardFilterChips: BoardFilterChipsProps
  resolvedListActions: React.ComponentProps<typeof ListScreenHeader>['resolvedListActions']
  movingDocIds: string[]
  onMoveCard: React.ComponentProps<typeof ListBody>['onMoveCard']
  onGanttUpdateDates: React.ComponentProps<typeof ListBody>['onGanttUpdateDates']
  onDelete: React.ComponentProps<typeof ListBody>['onDelete']
  // screen-owned UI state
  summaryPickerOpen: boolean
  setSummaryPickerOpen: (open: boolean) => void
  filterSheetOpen: boolean
  setFilterSheetOpen: (open: boolean) => void
  boardPreviewDoc: Record<string, unknown> | null
  setBoardPreviewDoc: (doc: Record<string, unknown> | null) => void
  openSettingsSheet: () => void
}

export function ListScreenContent({
  slug,
  label,
  isPreview,
  backgroundColor,
  headerHeight,
  showSidebar,
  searchText,
  setSearchText,
  useAsTitle,
  hasDrafts,
  schemaMap,
  rootFields,
  localData,
  localDocs,
  scrollHandler,
  noopSubmit,
  views,
  filters,
  actions,
  persistence,
  scanner,
  navigateToDoc,
  renderRow,
  renderDocWithPeek,
  boardFilterChips,
  resolvedListActions,
  movingDocIds,
  onMoveCard,
  onGanttUpdateDates,
  onDelete,
  summaryPickerOpen,
  setSummaryPickerOpen,
  filterSheetOpen,
  setFilterSheetOpen,
  boardPreviewDoc,
  setBoardPreviewDoc,
  openSettingsSheet,
}: ListScreenContentProps) {
  const router = useRouter()
  const { isKanban, isCalendar, isGantt } = views

  return (
    <View style={{ flex: 1, backgroundColor, width: '100%' }}>
      {!isPreview && (
        <ListScreenHeader
          slug={slug}
          label={label}
          isKanban={isKanban}
          isCalendar={isCalendar}
          isGantt={isGantt}
          kanbanAvailable={views.kanbanAvailable}
          calendarAvailable={views.calendarAvailable}
          ganttAvailable={views.ganttAvailable}
          availableViewModes={views.availableViewModes}
          nextViewMode={views.nextViewMode}
          onViewModeChange={views.handleViewModeChange}
          selectionMode={actions.selectionMode}
          setSelectionMode={actions.setSelectionMode}
          exitSelectionMode={actions.exitSelectionMode}
          openBulkEdit={actions.openBulkEdit}
          selectedIds={actions.selectedIds}
          resolvedListActions={resolvedListActions}
          onRunListAction={actions.runListAction}
          sortableFields={persistence.sortableFields}
          effectiveSort={persistence.effectiveSort}
          onSortFieldPress={persistence.handleSortFieldPress}
          onOpenScan={() => scanner.setScanOpen(true)}
          onOpenPresets={() => filters.setPresetsSheetOpen(true)}
          onOpenSettings={openSettingsSheet}
          onOpenFilter={() => setFilterSheetOpen(true)}
          onSearchChange={setSearchText}
        />
      )}
      {/* Selection mode action bar — generic Edit Selected + custom actions
          (table-mode-only, like swipe-delete) */}
      {actions.selectionMode && !isKanban && !isCalendar && !isGantt && (
        <SelectionActionBar
          selectedCount={actions.selectedIds.length}
          actions={[
            { key: '__bulkEdit', label: 'Edit Selected', icon: 'square.and.pencil' },
            ...resolvedListActions,
          ]}
          onAction={(actionKey) => {
            if (actionKey === '__bulkEdit') {
              actions.openBulkEdit()
              return
            }
            actions.runListAction(actionKey)
          }}
          onDone={actions.exitSelectionMode}
        />
      )}
      {/* Main body — view-mode ternary (kanban / calendar / gantt / table) */}
      <ListBody
        slug={slug}
        headerHeight={headerHeight}
        filterChips={boardFilterChips}
        boardDocs={filters.boardDocs}
        useAsTitle={useAsTitle}
        isPreview={isPreview}
        onNavigate={navigateToDoc}
        onPreviewDoc={setBoardPreviewDoc}
        movingDocIds={movingDocIds}
        isKanban={isKanban}
        isCalendar={isCalendar}
        isGantt={isGantt}
        kanbanStatusField={views.kanbanStatusField}
        kanbanConfig={views.kanbanConfig}
        kanbanFieldLabels={views.kanbanFieldLabels}
        onMoveCard={onMoveCard}
        calendarSources={views.calendarSources}
        calendarMode={views.calendarMode}
        setCalendarModeOverride={views.setCalendarModeOverride}
        calendarDate={views.calendarDate}
        setCalendarDate={views.setCalendarDate}
        renderDocWithPeek={renderDocWithPeek}
        ganttRef={views.ganttRef}
        ganttSources={views.ganttSources}
        ganttConfig={views.ganttConfig}
        ganttEffectivePx={views.ganttEffectivePx}
        onGanttZoom={views.handleGanttZoom}
        onGanttToday={() => views.ganttRef.current?.scrollToToday(true)}
        onGanttToggleSource={views.handleGanttToggleSource}
        onGanttUpdateDates={onGanttUpdateDates}
        onGanttPxPerDayChange={views.handleGanttPxPerDayChange}
        searchText={searchText}
        schemaMap={schemaMap}
        onTablePress={(doc) => router.push(`/(admin)/collections/${slug}/${doc.id as string}`)}
        onDelete={onDelete}
        renderRow={renderRow}
        summaryFields={persistence.summaryFields}
        onSummaryFieldsChange={persistence.handleSummaryFieldsChange}
        summaryPickerOpen={summaryPickerOpen}
        onSummaryPickerClose={() => setSummaryPickerOpen(false)}
        filterSheetOpen={filterSheetOpen}
        onFilterSheetClose={() => setFilterSheetOpen(false)}
        localData={localData}
        onScroll={scrollHandler}
        showSidebar={showSidebar}
        tablePins={persistence.tablePins}
        onTablePinsChange={persistence.handleTablePinsChange}
        appliedTableFilters={filters.appliedTableFilters}
        onTableFiltersChange={filters.setTableFilters}
        effectiveSort={persistence.effectiveSort}
        onSortChange={persistence.handleSortChange}
      />
      {/* Overlay sheets — filter editor (overlay views), view presets, the
          three board customize sheets and bulk edit */}
      <ListOverlaySheets
        slug={slug}
        rootFields={rootFields}
        showFilterSheet={isKanban || isCalendar || isGantt}
        filterSheetVisible={filterSheetOpen || filters.kanbanFilterInternalOpen}
        closeFilterSheet={filters.closeKanbanFilterSheet}
        kanbanEditingFilter={filters.kanbanEditingFilter}
        kanbanFilters={filters.kanbanFilters}
        removeKanbanFilter={filters.removeKanbanFilter}
        summaryFields={persistence.summaryFields}
        setKanbanFilterGroups={filters.setKanbanFilterGroups}
        onApplyFilter={(payload) => {
          const { id, ...rest } = payload
          if (id) filters.updateKanbanFilter(id, rest)
          else filters.addKanbanFilter(rest)
          filters.closeKanbanFilterSheet()
        }}
        presetsSheetOpen={filters.presetsSheetOpen}
        setPresetsSheetOpen={filters.setPresetsSheetOpen}
        normalizedViewMode={views.normalizedViewMode}
        kanbanConfig={views.kanbanConfig}
        currentCalendarSnapshot={filters.currentCalendarSnapshot}
        currentGanttSnapshot={filters.currentGanttSnapshot}
        presetWhere={filters.presetWhere}
        onApplyPreset={filters.handleApplyPreset}
        kanbanAvailable={views.kanbanAvailable}
        kanbanCustomizeOpen={views.kanbanCustomizeOpen}
        setKanbanCustomizeOpen={views.setKanbanCustomizeOpen}
        statusFieldCandidates={views.statusFieldCandidates}
        cardFieldCandidates={views.cardFieldCandidates}
        setKanbanConfig={views.setKanbanConfig}
        calendarAvailable={views.calendarAvailable}
        calendarCustomizeOpen={views.calendarCustomizeOpen}
        setCalendarCustomizeOpen={views.setCalendarCustomizeOpen}
        dateFieldOptions={views.dateFieldOptions}
        calendarConfig={views.calendarConfig}
        calendarSources={views.calendarSources}
        handleSaveCalendarConfig={views.handleSaveCalendarConfig}
        ganttAvailable={views.ganttAvailable}
        ganttCustomizeOpen={views.ganttCustomizeOpen}
        setGanttCustomizeOpen={views.setGanttCustomizeOpen}
        ganttConfig={views.ganttConfig}
        ganttSources={views.ganttSources}
        setGanttConfig={views.setGanttConfig}
        bulkEditOpen={actions.bulkEditOpen}
        setBulkEditOpen={actions.setBulkEditOpen}
        selectedIds={actions.selectedIds}
        bulkDocs={localDocs}
        hasDrafts={hasDrafts}
        onBulkEditComplete={() => {
          actions.setBulkEditOpen(false)
          actions.exitSelectionMode()
        }}
      />
      {/* Board preview (kanban cards + gantt bars) — pure-JS inline preview
          (BottomSheet + read-only DocumentForm), opened by a static
          long-press or the kanban card's ellipsis menu. Long-press belongs
          to the drag gesture on both surfaces, so the native
          ScrollablePreview peek is never mounted on cards or bars. */}
      <BoardPreviewSheet
        doc={boardPreviewDoc}
        schemaMap={schemaMap}
        slug={slug}
        useAsTitle={useAsTitle}
        noopSubmit={noopSubmit}
        onClose={() => setBoardPreviewDoc(null)}
        onOpenDoc={navigateToDoc}
      />
      {/* Scan-to-lookup popup — camera scanner (phone: centered peek-style,
          tablet: floating top-right popup). Resolution lives in handleScanned;
          'none' keeps the popup open so the user can retry immediately. */}
      <ScanLookupSheet
        visible={scanner.scanOpen}
        onClose={() => scanner.setScanOpen(false)}
        onScanned={scanner.handleScanned}
      />
      {/* Multiple scan matches — picker sheet (same inline list pattern as
          the board preview sheet); tapping a row navigates through the
          shared double-nav guard. */}
      <ScanMatchesSheet
        matches={scanner.scanMatches}
        useAsTitle={useAsTitle}
        onClose={() => scanner.setScanMatches(null)}
        onPick={navigateToDoc}
      />
    </View>
  )
}
