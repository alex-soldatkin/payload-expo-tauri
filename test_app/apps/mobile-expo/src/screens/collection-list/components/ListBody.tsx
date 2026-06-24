/**
 * The collection-list screen's main body — the view-mode ternary that renders
 * the kanban board, the calendar, the gantt chart, or the default DocumentList
 * (table / phone cards). Each overlay view is its own component taking the
 * shared filtered/sorted boardDocs + callbacks; the table path is the package's
 * DocumentList with the screen's controlled props.
 *
 * Extracted verbatim from the route file. Behaviour — all four view modes,
 * controlled sort on iOS, table-pin customisation — is unchanged.
 */
import React from 'react'
import { Platform } from 'react-native'
import {
  DocumentList,
  type CalendarMode,
  type CalendarSource,
  type DocumentListSort,
  type GanttChartHandle,
  type KanbanStatusField,
} from '@payload-universal/admin-native'
import { CalendarModeView } from './CalendarModeView'
import { GanttModeView } from './GanttModeView'
import { KanbanModeView } from './KanbanModeView'
import type { BoardFilterChipsProps } from './BoardFilterChips'
import type { CalendarConfig } from '@/src/hooks/useCalendarConfig'
import type { GanttConfig } from '@/src/hooks/useGanttConfig'
import type { KanbanConfig } from '@/src/hooks/useKanbanConfig'

// DocumentList's schemaMap is optional; the screen's value may be undefined.
type SchemaMap = React.ComponentProps<typeof DocumentList>['schemaMap'] | undefined
type LocalData = React.ComponentProps<typeof DocumentList>['localData']
type RenderRow = React.ComponentProps<typeof DocumentList>['renderRow']
type OnScroll = React.ComponentProps<typeof DocumentList>['onScroll']
type AppliedFilters = React.ComponentProps<typeof DocumentList>['appliedFilters']
type OnFiltersChange = React.ComponentProps<typeof DocumentList>['onFiltersChange']
type TablePins = { header: boolean; firstColumn: boolean }

export type ListBodyProps = {
  // shared
  slug: string
  headerHeight: number
  filterChips: BoardFilterChipsProps
  boardDocs: Record<string, unknown>[]
  useAsTitle?: string
  isPreview: boolean
  onNavigate: (id: string) => void
  onPreviewDoc: (doc: Record<string, unknown>) => void
  movingDocIds: string[]
  // mode flags
  isKanban: boolean
  isCalendar: boolean
  isGantt: boolean
  // kanban
  kanbanStatusField: KanbanStatusField | null
  kanbanConfig: KanbanConfig
  kanbanFieldLabels: Record<string, string>
  onMoveCard: (doc: Record<string, unknown>, toValue: string | null) => void | Promise<void>
  // calendar
  calendarSources: CalendarSource[]
  calendarMode: CalendarMode
  setCalendarModeOverride: (mode: CalendarMode) => void
  calendarDate: string
  setCalendarDate: (date: string) => void
  renderDocWithPeek: (doc: Record<string, unknown>, defaultCard: React.ReactElement) => React.ReactElement
  // gantt
  ganttRef: React.Ref<GanttChartHandle>
  ganttSources: CalendarSource[]
  ganttConfig: GanttConfig
  ganttEffectivePx: number
  onGanttZoom: (px: number) => void
  onGanttToday: () => void
  onGanttToggleSource: (id: string) => void
  onGanttUpdateDates: (
    doc: Record<string, unknown>,
    source: CalendarSource,
    next: { start: string; end: string },
  ) => void | Promise<void>
  onGanttPxPerDayChange: (px: number) => void
  // table (DocumentList)
  searchText: string
  schemaMap: SchemaMap
  onTablePress: (doc: Record<string, unknown>) => void
  onDelete: (doc: Record<string, unknown>) => void | Promise<void>
  renderRow: RenderRow
  summaryFields: string[]
  onSummaryFieldsChange: (fields: string[]) => void
  summaryPickerOpen: boolean
  onSummaryPickerClose: () => void
  filterSheetOpen: boolean
  onFilterSheetClose: () => void
  localData: LocalData
  onScroll: OnScroll
  showSidebar: boolean
  tablePins: TablePins
  onTablePinsChange: (pins: TablePins) => void
  appliedTableFilters: AppliedFilters
  onTableFiltersChange: OnFiltersChange
  effectiveSort: DocumentListSort
  onSortChange: (s: DocumentListSort) => void
}

export function ListBody(props: ListBodyProps) {
  const {
    slug,
    headerHeight,
    filterChips,
    boardDocs,
    useAsTitle,
    isPreview,
    onNavigate,
    onPreviewDoc,
    movingDocIds,
    isKanban,
    isCalendar,
    isGantt,
    kanbanStatusField,
    kanbanConfig,
    kanbanFieldLabels,
    onMoveCard,
    calendarSources,
    calendarMode,
    setCalendarModeOverride,
    calendarDate,
    setCalendarDate,
    renderDocWithPeek,
    ganttRef,
    ganttSources,
    ganttConfig,
    ganttEffectivePx,
    onGanttZoom,
    onGanttToday,
    onGanttToggleSource,
    onGanttUpdateDates,
    onGanttPxPerDayChange,
    searchText,
    schemaMap,
    onTablePress,
    onDelete,
    renderRow,
    summaryFields,
    onSummaryFieldsChange,
    summaryPickerOpen,
    onSummaryPickerClose,
    filterSheetOpen,
    onFilterSheetClose,
    localData,
    onScroll,
    showSidebar,
    tablePins,
    onTablePinsChange,
    appliedTableFilters,
    onTableFiltersChange,
    effectiveSort,
    onSortChange,
  } = props

  if (isKanban && kanbanStatusField) {
    // ── Kanban board — same local-first docs, filtered + sorted like the
    // table; the toolbar search/sort/filter controls stay live above it ──
    return (
      <KanbanModeView
        headerHeight={headerHeight}
        filterChips={filterChips}
        docs={boardDocs}
        statusField={kanbanStatusField}
        config={kanbanConfig}
        fieldLabels={kanbanFieldLabels}
        useAsTitle={useAsTitle}
        onPressCard={(doc) => onNavigate(String(doc.id))}
        onMoveCard={onMoveCard}
        onPreviewCard={onPreviewDoc}
        loadingDocIds={movingDocIds}
      />
    )
  }

  if (isCalendar) {
    // ── Calendar — same local-first docs through the same screen-hosted
    // filter pipeline; sources from useCalendarConfig (defaults via
    // pickDefaultSources); native month/day views injected from the app's
    // calendar-view module with JS fallbacks inside CalendarView ──
    return (
      <CalendarModeView
        headerHeight={headerHeight}
        filterChips={filterChips}
        docs={boardDocs}
        sources={calendarSources}
        useAsTitle={useAsTitle}
        mode={calendarMode}
        onChangeMode={setCalendarModeOverride}
        selectedDate={calendarDate}
        onChangeSelectedDate={setCalendarDate}
        onPressDoc={(doc) => onNavigate(String(doc.id))}
        renderDocRow={renderDocWithPeek}
      />
    )
  }

  if (isGantt) {
    // ── Gantt — same local-first docs through the same screen-hosted
    // filter pipeline; sources from useGanttConfig (defaults via
    // pickDefaultSources). Drag editing lives inside GanttChart
    // (PanResponder-only); completed drags land in handleGanttUpdateDates
    // and bars spring back on failure via the docs re-render. ──
    return (
      <GanttModeView
        headerHeight={headerHeight}
        filterChips={filterChips}
        ganttRef={ganttRef}
        docs={boardDocs}
        sources={ganttSources}
        useAsTitle={useAsTitle}
        effectivePx={ganttEffectivePx}
        pxPerDay={ganttConfig.pxPerDay ?? undefined}
        onZoom={onGanttZoom}
        onToday={onGanttToday}
        onToggleSource={onGanttToggleSource}
        onPressBar={(doc) => onNavigate(String(doc.id))}
        onPreviewDoc={onPreviewDoc}
        onUpdateDates={onGanttUpdateDates}
        onPxPerDayChange={onGanttPxPerDayChange}
        readOnlyDocIds={movingDocIds}
      />
    )
  }

  return (
    <DocumentList
      collection={slug}
      searchText={searchText}
      schemaMap={schemaMap}
      titleField={useAsTitle}
      searchFields={useAsTitle ? [useAsTitle] : undefined}
      onPress={(doc) => {
        if (!isPreview) onTablePress(doc)
      }}
      onDelete={onDelete}
      renderRow={renderRow}
      summaryFields={summaryFields}
      onSummaryFieldsChange={onSummaryFieldsChange}
      summaryPickerOpen={summaryPickerOpen}
      onSummaryPickerClose={onSummaryPickerClose}
      filterSheetOpen={filterSheetOpen}
      onFilterSheetClose={onFilterSheetClose}
      localData={localData}
      onScroll={onScroll}
      scrollEventThrottle={16}
      // Tablet table mode — web-admin-parity rows rendered by
      // DocumentList itself (frozen title + shared horizontal track)
      tableMode={showSidebar}
      // Pin customisation — sticky header band / frozen title column,
      // both default ON, toggled in the list settings sheet
      stickyHeader={tablePins.header}
      pinFirstColumn={tablePins.firstColumn}
      onTablePinsChange={onTablePinsChange}
      // Native Payload query presets (payload-query-presets, REST-only)
      // in the filter sheet + view-preset filter application/lifting
      queryPresetsCollection={slug}
      appliedFilters={appliedTableFilters}
      onFiltersChange={onTableFiltersChange}
      // iOS: sort is controlled by the native toolbar menu above.
      // Android: leave uncontrolled so DocumentList's internal sort UI
      // (persisted under the same key) keeps working.
      {...(Platform.OS === 'ios'
        ? { sort: effectiveSort, onSortChange }
        : {})}
    />
  )
}
