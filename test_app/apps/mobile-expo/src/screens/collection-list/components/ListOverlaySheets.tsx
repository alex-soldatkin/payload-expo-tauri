/**
 * The collection-list screen's overlay sheets — the filter editor (for the
 * kanban/calendar/gantt overlay views), view presets, the three board
 * customize sheets and bulk edit. Grouped here so the route file composes one
 * element instead of hosting six sheets inline. Behaviour is unchanged; the
 * screen owns all the state and passes it down.
 */
import React from 'react'
import {
  FilterBottomSheet,
  type ActiveFilter,
  type ClientField,
  type CalendarSource,
} from '@payload-universal/admin-native'
import { BulkEditSheet } from '@/src/components/BulkEditSheet'
import { CalendarCustomizeSheet } from '@/src/components/CalendarCustomizeSheet'
import { GanttCustomizeSheet } from '@/src/components/GanttCustomizeSheet'
import { KanbanCustomizeSheet } from '@/src/components/KanbanCustomizeSheet'
import { PresetsSheet } from '@/src/components/PresetsSheet'
import type { CalendarConfig } from '@/src/hooks/useCalendarConfig'
import type { GanttConfig } from '@/src/hooks/useGanttConfig'
import type { KanbanConfig, ListViewMode } from '@/src/hooks/useKanbanConfig'
import type { ViewPresetDoc } from '@/src/hooks/useViewPresets'
import type { DateFieldOption } from '../types'

export type ListOverlaySheetsProps = {
  slug: string
  rootFields: ClientField[]
  // ── Filter editor (overlay-view modes) ──
  showFilterSheet: boolean
  filterSheetVisible: boolean
  closeFilterSheet: () => void
  kanbanEditingFilter: ActiveFilter | null
  kanbanFilters: ActiveFilter[]
  removeKanbanFilter: (id: string) => void
  summaryFields: string[]
  setKanbanFilterGroups: React.ComponentProps<typeof FilterBottomSheet>['onApplyFilterGroups']
  onApplyFilter: React.ComponentProps<typeof FilterBottomSheet>['onApply']
  // ── Presets ──
  presetsSheetOpen: boolean
  setPresetsSheetOpen: (open: boolean) => void
  normalizedViewMode: ListViewMode
  kanbanConfig: KanbanConfig
  currentCalendarSnapshot: CalendarConfig
  currentGanttSnapshot: GanttConfig
  presetWhere: Record<string, unknown> | null
  onApplyPreset: (preset: ViewPresetDoc) => void
  // ── Kanban customise ──
  kanbanAvailable: boolean
  kanbanCustomizeOpen: boolean
  setKanbanCustomizeOpen: (open: boolean) => void
  statusFieldCandidates: ClientField[]
  cardFieldCandidates: ClientField[]
  setKanbanConfig: (config: KanbanConfig) => void
  // ── Calendar customise ──
  calendarAvailable: boolean
  calendarCustomizeOpen: boolean
  setCalendarCustomizeOpen: (open: boolean) => void
  dateFieldOptions: DateFieldOption[]
  calendarConfig: CalendarConfig
  calendarSources: CalendarSource[]
  handleSaveCalendarConfig: (config: CalendarConfig) => void
  // ── Gantt customise ──
  ganttAvailable: boolean
  ganttCustomizeOpen: boolean
  setGanttCustomizeOpen: (open: boolean) => void
  ganttConfig: GanttConfig
  ganttSources: CalendarSource[]
  setGanttConfig: (config: GanttConfig) => void
  // ── Bulk edit ──
  bulkEditOpen: boolean
  setBulkEditOpen: (open: boolean) => void
  selectedIds: string[]
  bulkDocs: Record<string, unknown>[]
  hasDrafts: boolean
  onBulkEditComplete: () => void
}

export function ListOverlaySheets({
  slug,
  rootFields,
  showFilterSheet,
  filterSheetVisible,
  closeFilterSheet,
  kanbanEditingFilter,
  kanbanFilters,
  removeKanbanFilter,
  summaryFields,
  setKanbanFilterGroups,
  onApplyFilter,
  presetsSheetOpen,
  setPresetsSheetOpen,
  normalizedViewMode,
  kanbanConfig,
  currentCalendarSnapshot,
  currentGanttSnapshot,
  presetWhere,
  onApplyPreset,
  kanbanAvailable,
  kanbanCustomizeOpen,
  setKanbanCustomizeOpen,
  statusFieldCandidates,
  cardFieldCandidates,
  setKanbanConfig,
  calendarAvailable,
  calendarCustomizeOpen,
  setCalendarCustomizeOpen,
  dateFieldOptions,
  calendarConfig,
  calendarSources,
  handleSaveCalendarConfig,
  ganttAvailable,
  ganttCustomizeOpen,
  setGanttCustomizeOpen,
  ganttConfig,
  ganttSources,
  setGanttConfig,
  bulkEditOpen,
  setBulkEditOpen,
  selectedIds,
  bulkDocs,
  hasDrafts,
  onBulkEditComplete,
}: ListOverlaySheetsProps) {
  return (
    <>
      {/* Kanban/calendar/gantt filter editor — the screen hosts the same
          FilterBottomSheet DocumentList opens internally in table mode */}
      {showFilterSheet && (
        <FilterBottomSheet
          visible={filterSheetVisible}
          onClose={closeFilterSheet}
          fields={rootFields}
          initialFilter={kanbanEditingFilter}
          activeFilters={kanbanFilters}
          onRemoveFilter={removeKanbanFilter}
          // Native Payload query presets (payload-query-presets, REST-only)
          presetsCollection={slug}
          presetsColumns={summaryFields}
          onApplyFilterGroups={setKanbanFilterGroups}
          onApply={onApplyFilter}
        />
      )}
      {/* View presets — save/share/apply table, kanban, calendar & gantt
          views (server 'view-presets' collection, local-first) */}
      <PresetsSheet
        visible={presetsSheetOpen}
        onClose={() => setPresetsSheetOpen(false)}
        slug={slug}
        currentViewType={normalizedViewMode}
        currentConfig={kanbanConfig}
        currentCalendarConfig={currentCalendarSnapshot}
        currentGanttConfig={currentGanttSnapshot}
        currentWhere={presetWhere}
        onApply={onApplyPreset}
      />
      {/* Board customisation — status field, columns, colors, card fields */}
      {kanbanAvailable && (
        <KanbanCustomizeSheet
          visible={kanbanCustomizeOpen}
          onClose={() => setKanbanCustomizeOpen(false)}
          statusFieldCandidates={statusFieldCandidates}
          cardFieldCandidates={cardFieldCandidates}
          config={kanbanConfig}
          onSave={setKanbanConfig}
        />
      )}
      {/* Calendar customisation — date sources (start/end/label/colour) and
          the default month/week/day mode */}
      {calendarAvailable && (
        <CalendarCustomizeSheet
          visible={calendarCustomizeOpen}
          onClose={() => setCalendarCustomizeOpen(false)}
          dateFieldOptions={dateFieldOptions}
          config={calendarConfig}
          resolvedSources={calendarSources}
          onSave={handleSaveCalendarConfig}
        />
      )}
      {/* Gantt customisation — date sources (start/end/label/colour),
          visibility toggles and the S/M/L timeline zoom */}
      {ganttAvailable && (
        <GanttCustomizeSheet
          visible={ganttCustomizeOpen}
          onClose={() => setGanttCustomizeOpen(false)}
          dateFieldOptions={dateFieldOptions}
          config={ganttConfig}
          resolvedSources={ganttSources}
          onSave={setGanttConfig}
        />
      )}
      {/* Bulk edit flow — field picker → FieldRenderer input → apply to all
          selected docs via the local-first validated mutation pipeline */}
      <BulkEditSheet
        visible={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        slug={slug}
        fields={rootFields}
        selectedIds={selectedIds}
        docs={bulkDocs}
        hasDrafts={hasDrafts}
        onComplete={onBulkEditComplete}
      />
    </>
  )
}
