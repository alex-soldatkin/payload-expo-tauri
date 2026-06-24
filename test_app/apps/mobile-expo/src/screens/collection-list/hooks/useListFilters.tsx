/**
 * Filter + view-preset pipeline for the collection-list screen's overlay views.
 *
 * Hosts the screen-side instance of the same filter pipeline DocumentList runs
 * internally in table mode (chips + sheet + where), the table-mode filter
 * lifting/application bridge (epoch-bumped applied filters), the preset
 * snapshots + apply flow, and the client-side filtered/sorted `boardDocs` that
 * feed the kanban / calendar / gantt views.
 *
 * Extracted verbatim from the route file; every memo/callback and its deps are
 * unchanged. The route owns the view flags, configs and data and passes them in.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  applyWhereToDocs,
  filtersToWhere,
  getByPath,
  useDocumentListFilters,
  useToast,
  whereToFilterGroups,
  type ActiveFilter,
  type ClientField,
  type DocumentListSort,
  type FilterCondition,
} from '@payload-universal/admin-native'
import {
  presetToCalendarConfig,
  presetToGanttConfig,
  presetToKanbanConfig,
  type ViewPresetDoc,
} from '@/src/hooks/useViewPresets'
import type { CalendarConfig } from '@/src/hooks/useCalendarConfig'
import type { GanttConfig } from '@/src/hooks/useGanttConfig'
import type { KanbanConfig, ListViewMode } from '@/src/hooks/useKanbanConfig'
import { compareSortValues, EMPTY_DOCS } from '../utils'

export type UseListFiltersArgs = {
  useAsTitle?: string
  searchText: string
  setFilterSheetOpen: (open: boolean) => void
  rootFields: ClientField[]
  // view flags + availability + switching
  isKanban: boolean
  isCalendar: boolean
  isGantt: boolean
  kanbanAvailable: boolean
  calendarAvailable: boolean
  ganttAvailable: boolean
  handleViewModeChange: (mode: ListViewMode) => void
  // config setters used by preset apply
  setKanbanConfig: (config: KanbanConfig) => void
  setCalendarConfig: (config: CalendarConfig) => void
  setGanttConfig: (config: GanttConfig) => void
  setCalendarModeOverride: (mode: null) => void
  // preset snapshot inputs
  calendarSources: CalendarConfig['sources']
  calendarMode: CalendarConfig['defaultMode']
  ganttSources: GanttConfig['sources']
  ganttConfig: GanttConfig
  // board docs inputs
  localDocs: Record<string, unknown>[]
  effectiveSort: DocumentListSort
}

export function useListFilters({
  useAsTitle,
  searchText,
  setFilterSheetOpen,
  rootFields,
  isKanban,
  isCalendar,
  isGantt,
  kanbanAvailable,
  calendarAvailable,
  ganttAvailable,
  handleViewModeChange,
  setKanbanConfig,
  setCalendarConfig,
  setGanttConfig,
  setCalendarModeOverride,
  calendarSources,
  calendarMode,
  ganttSources,
  ganttConfig,
  localDocs,
  effectiveSort,
}: UseListFiltersArgs) {
  const toast = useToast()

  // ── Kanban/calendar/gantt search/filters — screen-hosted instance of the
  // same pipeline DocumentList runs internally in table mode (chips + sheet +
  // where). All overlay views share this one instance ──
  const {
    searchText: kanbanSearchText,
    setSearchText: setKanbanSearchText,
    filters: kanbanFilters,
    addFilter: addKanbanFilter,
    updateFilter: updateKanbanFilter,
    removeFilter: removeKanbanFilter,
    setFilterGroups: setKanbanFilterGroups,
    clearAllFilters: clearKanbanFilters,
    whereQuery: kanbanWhereQuery,
    hasActiveFilters: kanbanHasActiveFilters,
  } = useDocumentListFilters({ searchFields: useAsTitle ? [useAsTitle] : undefined })

  // Native header search bar feeds both modes
  useEffect(() => {
    setKanbanSearchText(searchText)
  }, [searchText, setKanbanSearchText])

  const [kanbanEditingFilter, setKanbanEditingFilter] = useState<ActiveFilter | null>(null)
  const [kanbanFilterInternalOpen, setKanbanFilterInternalOpen] = useState(false)
  const closeKanbanFilterSheet = useCallback(() => {
    setKanbanFilterInternalOpen(false)
    setKanbanEditingFilter(null)
    setFilterSheetOpen(false)
  }, [setFilterSheetOpen])

  // ── View presets — save/share/apply the whole view (mode + board config +
  // filters). Table-mode filters live inside DocumentList; it reports them
  // up via onFiltersChange and accepts preset filters via appliedFilters. ──
  const [presetsSheetOpen, setPresetsSheetOpen] = useState(false)
  const [tableFilters, setTableFilters] = useState<ActiveFilter[]>([])
  const [appliedTableFilters, setAppliedTableFilters] = useState<{
    epoch: number
    groups: FilterCondition[][]
  }>({ epoch: 0, groups: [] })

  // Structured filters of the ACTIVE mode as a Payload where (search excluded)
  const presetWhere = useMemo(
    () =>
      (filtersToWhere(isKanban || isCalendar || isGantt ? kanbanFilters : tableFilters) as
        | Record<string, unknown>
        | undefined) ?? null,
    [isKanban, isCalendar, isGantt, kanbanFilters, tableFilters],
  )

  // Calendar state lifted into new/updated presets (RESOLVED sources +
  // the mode currently shown, so "save current" captures what you see)
  const currentCalendarSnapshot = useMemo<CalendarConfig>(
    () => ({ sources: calendarSources, defaultMode: calendarMode }),
    [calendarSources, calendarMode],
  )

  // Gantt state lifted into new/updated presets (RESOLVED sources; pxPerDay/
  // rowSort stay null unless customised — null lifts as "client default")
  const currentGanttSnapshot = useMemo<GanttConfig>(
    () => ({ sources: ganttSources, pxPerDay: ganttConfig.pxPerDay, rowSort: ganttConfig.rowSort }),
    [ganttSources, ganttConfig.pxPerDay, ganttConfig.rowSort],
  )

  const handleApplyPreset = useCallback(
    (preset: ViewPresetDoc) => {
      const targetMode: ListViewMode =
        preset.viewType === 'kanban' && kanbanAvailable
          ? 'kanban'
          : preset.viewType === 'calendar' && calendarAvailable
            ? 'calendar'
            : preset.viewType === 'gantt' && ganttAvailable
              ? 'gantt'
              : 'table'
      handleViewModeChange(targetMode)
      setKanbanConfig(presetToKanbanConfig(preset))
      setCalendarConfig(presetToCalendarConfig(preset))
      setGanttConfig(presetToGanttConfig(preset))
      // Let the preset's calendarDefaultMode take effect immediately
      setCalendarModeOverride(null)
      // Apply the preset's where to BOTH filter pipelines (kanban/calendar
      // hook here, DocumentList's internal hook via the epoch-bumped prop)
      const { groups, unsupported } = whereToFilterGroups(preset.where ?? undefined, rootFields)
      setKanbanFilterGroups(groups)
      setAppliedTableFilters((prev) => ({ epoch: prev.epoch + 1, groups }))
      setPresetsSheetOpen(false)
      if (unsupported.length > 0) {
        toast.showToast(
          `Applied "${preset.title}" — some filters can't run on-device (${unsupported.join(', ')})`,
          { type: 'info', duration: 4000 },
        )
      } else {
        toast.showToast(`Applied "${preset.title}"`, { type: 'success', duration: 2000 })
      }
    },
    [kanbanAvailable, calendarAvailable, ganttAvailable, handleViewModeChange, setKanbanConfig, setCalendarConfig, setGanttConfig, setCalendarModeOverride, rootFields, setKanbanFilterGroups, toast],
  )

  // Same local-first source the table uses, filtered + sorted client-side
  // (feeds the kanban board, the calendar AND the gantt). In gantt mode a
  // configured ganttOptions.rowSort (dot-path, ascending) overrides the
  // list sort — that's the server preset convention for row ordering.
  const boardDocs = useMemo(() => {
    if (!isKanban && !isCalendar && !isGantt) return EMPTY_DOCS
    const filtered = applyWhereToDocs(
      localDocs,
      kanbanWhereQuery as Record<string, unknown> | undefined,
    )
    const ganttRowSort = isGantt ? ganttConfig.rowSort : null
    const sortField = ganttRowSort ?? effectiveSort.field
    const dir = ganttRowSort ? 1 : effectiveSort.direction === 'desc' ? -1 : 1
    return [...filtered].sort(
      (a, b) =>
        dir * compareSortValues(getByPath(a, sortField), getByPath(b, sortField)),
    )
  }, [isKanban, isCalendar, isGantt, ganttConfig.rowSort, localDocs, kanbanWhereQuery, effectiveSort])

  return {
    // filter pipeline
    kanbanSearchText,
    kanbanFilters,
    addKanbanFilter,
    updateKanbanFilter,
    removeKanbanFilter,
    setKanbanFilterGroups,
    clearKanbanFilters,
    kanbanHasActiveFilters,
    // filter sheet state
    kanbanEditingFilter,
    setKanbanEditingFilter,
    kanbanFilterInternalOpen,
    setKanbanFilterInternalOpen,
    closeKanbanFilterSheet,
    // presets
    presetsSheetOpen,
    setPresetsSheetOpen,
    setTableFilters,
    appliedTableFilters,
    presetWhere,
    currentCalendarSnapshot,
    currentGanttSnapshot,
    handleApplyPreset,
    // derived docs
    boardDocs,
  }
}
