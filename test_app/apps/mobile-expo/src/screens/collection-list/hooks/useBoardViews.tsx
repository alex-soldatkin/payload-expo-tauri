/**
 * Overlay-view wiring for the collection-list screen — the per-collection
 * kanban / calendar / gantt configs, their availability gates, resolved
 * sources, gantt header controls, and view-mode switching.
 *
 * Extracted verbatim from the route file; every memo/callback and its deps are
 * unchanged. The route owns `slug`, `rootFields` and `exitSelectionMode` and
 * passes them in; everything the header, the mode renderers and the customize
 * sheets need comes back out.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  collectionHasCalendarDateFields,
  GANTT_CHART_DEFAULT_PX_PER_DAY,
  getFieldLabel,
  normalizeOption,
  pickDefaultSources,
  todayDateKey,
  type CalendarMode,
  type ClientField,
  type ClientSelectField,
  type GanttChartHandle,
  type KanbanStatusField,
} from '@payload-universal/admin-native'
import { useCalendarConfig, type CalendarConfig } from '@/src/hooks/useCalendarConfig'
import { useGanttConfig } from '@/src/hooks/useGanttConfig'
import { useKanbanConfig, useListViewMode, type ListViewMode } from '@/src/hooks/useKanbanConfig'
import { collectDateFieldOptions, isEligibleStatusField, KANBAN_CARD_FIELD_TYPES } from '../utils'

export function useBoardViews(
  slug: string,
  rootFields: ClientField[],
  exitSelectionMode: () => void,
) {
  // ── Kanban view — per-collection view mode + board config ──────────────
  const [viewMode, setViewMode] = useListViewMode(slug)
  const { config: kanbanConfig, setConfig: setKanbanConfig } = useKanbanConfig(slug)
  const [kanbanCustomizeOpen, setKanbanCustomizeOpen] = useState(false)

  const statusFieldCandidates = useMemo(
    () => rootFields.filter(isEligibleStatusField),
    [rootFields],
  )
  const kanbanAvailable = statusFieldCandidates.length > 0

  // Configured status field, falling back to the first eligible one when the
  // stored name no longer exists in the schema.
  const activeStatusFieldDef = useMemo(() => {
    if (statusFieldCandidates.length === 0) return null
    const configured = kanbanConfig.statusField
      ? statusFieldCandidates.find((f) => f.name === kanbanConfig.statusField)
      : undefined
    return configured ?? statusFieldCandidates[0]
  }, [statusFieldCandidates, kanbanConfig.statusField])

  const kanbanStatusField = useMemo<KanbanStatusField | null>(() => {
    if (!activeStatusFieldDef?.name) return null
    const rawOptions = (activeStatusFieldDef as ClientSelectField).options ?? []
    return {
      name: activeStatusFieldDef.name,
      label: getFieldLabel(activeStatusFieldDef),
      options: rawOptions.map(normalizeOption),
    }
  }, [activeStatusFieldDef])

  const isKanban = viewMode === 'kanban' && kanbanAvailable && kanbanStatusField != null

  // ── Calendar view — per-collection config + date-field candidates ──────
  const { config: calendarConfig, setConfig: setCalendarConfig } = useCalendarConfig(slug)
  const [calendarCustomizeOpen, setCalendarCustomizeOpen] = useState(false)

  const dateFieldOptions = useMemo(() => collectDateFieldOptions(rootFields), [rootFields])
  // Eligible only with >=1 REAL date field — Payload bookkeeping dates
  // (createdAt/updatedAt, auth resetPasswordExpiration/lockUntil) don't
  // count, so e.g. Users offers no Calendar at all.
  const calendarAvailable = collectionHasCalendarDateFields(dateFieldOptions)
  const isCalendar = viewMode === 'calendar' && calendarAvailable

  // Effective sources: explicit config, else heuristic defaults over the
  // collection's date fields (range pairs + point sources, palette colours)
  const calendarSources = useMemo(
    () => calendarConfig.sources ?? pickDefaultSources(dateFieldOptions),
    [calendarConfig.sources, dateFieldOptions],
  )

  // Mode shown by the calendar: a session override on top of the persisted
  // defaultMode (reset when a new config/preset arrives so its default wins)
  const [calendarModeOverride, setCalendarModeOverride] = useState<CalendarMode | null>(null)
  const calendarMode: CalendarMode = calendarModeOverride ?? calendarConfig.defaultMode
  const [calendarDate, setCalendarDate] = useState<string>(() => todayDateKey())

  const handleSaveCalendarConfig = useCallback(
    (next: CalendarConfig) => {
      setCalendarConfig(next)
      setCalendarModeOverride(null)
    },
    [setCalendarConfig],
  )

  // ── Gantt view — per-collection config; SAME eligibility gate as the
  // calendar (>=1 real date field — range pairs preferred, single-date
  // point sources allowed) ────────────────────────────────────────────────
  const {
    config: ganttConfig,
    setConfig: setGanttConfig,
    updateConfig: updateGanttConfig,
  } = useGanttConfig(slug)
  const [ganttCustomizeOpen, setGanttCustomizeOpen] = useState(false)
  const ganttAvailable = calendarAvailable
  const isGantt = viewMode === 'gantt' && ganttAvailable
  // Imperative handle for the header "Today" recenter (scrollToToday).
  const ganttRef = useRef<GanttChartHandle>(null)

  // Effective sources: explicit config, else the same heuristic defaults the
  // calendar uses (range pairs + point sources, palette colours)
  const ganttSources = useMemo(
    () => ganttConfig.sources ?? pickDefaultSources(dateFieldOptions),
    [ganttConfig.sources, dateFieldOptions],
  )

  // ── Gantt header controls (mirrors the calendar's glass header row) ────
  // Zoom: S/M/L map the SAME 16/28/44 px widths as GanttCustomizeSheet; the
  // effective px reads the config (null → component default). Persisted via
  // useGanttConfig so the toolbar, the customize sheet and pinch-to-zoom all
  // round-trip through one source of truth.
  const ganttEffectivePx = ganttConfig.pxPerDay ?? GANTT_CHART_DEFAULT_PX_PER_DAY
  const handleGanttZoom = useCallback(
    (px: number) => updateGanttConfig({ pxPerDay: px }),
    [updateGanttConfig],
  )
  // Pinch-to-zoom commits a CONTINUOUS px (8…80); persist it as-is — the S/M/L
  // segment simply highlights none until the next preset tap.
  const handleGanttPxPerDayChange = useCallback(
    (px: number) => updateGanttConfig({ pxPerDay: px }),
    [updateGanttConfig],
  )
  // Legend visibility toggles the source's `hidden` flag (buildGanttRows skips
  // hidden sources). Toggling writes an EXPLICIT source list (resolving the
  // pickDefaultSources fallback), exactly like the customize sheet's save —
  // so a legend tap pins the source set the same way the calendar legend does.
  const handleGanttToggleSource = useCallback(
    (id: string) => {
      const next = ganttSources.map((s) => {
        if (s.id !== id) return s
        if (s.hidden) {
          const { hidden: _omit, ...rest } = s
          return rest
        }
        return { ...s, hidden: true }
      })
      updateGanttConfig({ sources: next })
    },
    [ganttSources, updateGanttConfig],
  )

  const handleViewModeChange = useCallback(
    (mode: ListViewMode) => {
      // Selection mode + swipe-delete are table-only surfaces
      if (mode !== 'table') exitSelectionMode()
      setViewMode(mode)
    },
    [exitSelectionMode, setViewMode],
  )

  // Android header cycles through the available view modes; iOS uses the
  // native toolbar menu instead.
  const normalizedViewMode: ListViewMode = isKanban
    ? 'kanban'
    : isCalendar
      ? 'calendar'
      : isGantt
        ? 'gantt'
        : 'table'
  const availableViewModes = useMemo<ListViewMode[]>(
    () => [
      'table',
      ...(kanbanAvailable ? (['kanban'] as ListViewMode[]) : []),
      ...(calendarAvailable ? (['calendar'] as ListViewMode[]) : []),
      ...(ganttAvailable ? (['gantt'] as ListViewMode[]) : []),
    ],
    [kanbanAvailable, calendarAvailable, ganttAvailable],
  )
  const nextViewMode: ListViewMode =
    availableViewModes[
      (availableViewModes.indexOf(normalizedViewMode) + 1) % availableViewModes.length
    ]

  // Display labels for card field rows
  const kanbanFieldLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    for (const f of rootFields) {
      if (f.name) labels[f.name] = getFieldLabel(f)
    }
    return labels
  }, [rootFields])

  // Fields offered in the customize sheet's card-fields multi-select
  const cardFieldCandidates = useMemo(
    () =>
      rootFields.filter(
        (f) =>
          f.name &&
          !['id', 'createdAt', 'updatedAt'].includes(f.name) &&
          KANBAN_CARD_FIELD_TYPES.has(f.type),
      ),
    [rootFields],
  )

  return {
    // view mode
    viewMode,
    isKanban,
    isCalendar,
    isGantt,
    normalizedViewMode,
    availableViewModes,
    nextViewMode,
    handleViewModeChange,
    // availability
    kanbanAvailable,
    calendarAvailable,
    ganttAvailable,
    // kanban
    kanbanConfig,
    setKanbanConfig,
    kanbanCustomizeOpen,
    setKanbanCustomizeOpen,
    statusFieldCandidates,
    kanbanStatusField,
    kanbanFieldLabels,
    cardFieldCandidates,
    // calendar
    calendarConfig,
    setCalendarConfig,
    calendarCustomizeOpen,
    setCalendarCustomizeOpen,
    calendarSources,
    calendarMode,
    setCalendarModeOverride,
    calendarDate,
    setCalendarDate,
    handleSaveCalendarConfig,
    // gantt
    ganttConfig,
    setGanttConfig,
    ganttCustomizeOpen,
    setGanttCustomizeOpen,
    ganttRef,
    ganttSources,
    ganttEffectivePx,
    handleGanttZoom,
    handleGanttPxPerDayChange,
    handleGanttToggleSource,
    // shared
    dateFieldOptions,
  }
}
