/**
 * Gantt mode renderer — same local-first docs through the same screen-hosted
 * filter pipeline; sources from useGanttConfig (defaults via
 * pickDefaultSources). Drag editing lives inside GanttChart (PanResponder-only);
 * completed drags land in onUpdateDates and bars spring back on failure via the
 * docs re-render. The glass header row mirrors the calendar's (S/M/L zoom +
 * Today + source legend chips; Today drives the imperative ganttRef).
 */
import React from 'react'
import { View } from 'react-native'
import {
  GanttChart,
  type CalendarSource,
  type GanttChartHandle,
} from '@payload-universal/admin-native'
import { BoardFilterChips, type BoardFilterChipsProps } from './BoardFilterChips'
import { GanttHeaderRow } from './GanttHeaderRow'

export type GanttModeViewProps = {
  headerHeight: number
  filterChips: BoardFilterChipsProps
  ganttRef: React.Ref<GanttChartHandle>
  docs: Record<string, unknown>[]
  sources: CalendarSource[]
  useAsTitle?: string
  effectivePx: number
  pxPerDay?: number
  onZoom: (px: number) => void
  onToday: () => void
  onToggleSource: (id: string) => void
  onPressBar: (doc: Record<string, unknown>) => void
  onPreviewDoc: (doc: Record<string, unknown>) => void
  onUpdateDates: (
    doc: Record<string, unknown>,
    source: CalendarSource,
    next: { start: string; end: string },
  ) => void | Promise<void>
  onPxPerDayChange: (px: number) => void
  readOnlyDocIds: string[]
}

export function GanttModeView({
  headerHeight,
  filterChips,
  ganttRef,
  docs,
  sources,
  useAsTitle,
  effectivePx,
  pxPerDay,
  onZoom,
  onToday,
  onToggleSource,
  onPressBar,
  onPreviewDoc,
  onUpdateDates,
  onPxPerDayChange,
  readOnlyDocIds,
}: GanttModeViewProps) {
  return (
    <View style={{ flex: 1, paddingTop: headerHeight }}>
      <BoardFilterChips {...filterChips} />
      {/* Glass header row mirroring the calendar's: S/M/L zoom + Today +
          source legend chips. Today drives the imperative ganttRef. */}
      <GanttHeaderRow
        effectivePx={effectivePx}
        sources={sources}
        onZoom={onZoom}
        onToday={onToday}
        onToggleSource={onToggleSource}
      />
      <GanttChart
        ref={ganttRef}
        docs={docs}
        sources={sources}
        useAsTitle={useAsTitle}
        onPressBar={onPressBar}
        // No ScrollablePreview.Trigger wrap here — its native long-press
        // recognizer would pre-empt the bar's drag-or-peek hold. Preview
        // = static long-press (hold + release without moving) → the same
        // JS BottomSheet the kanban cards use.
        onPreviewDoc={onPreviewDoc}
        onUpdateDates={onUpdateDates}
        readOnlyDocIds={readOnlyDocIds}
        // Preset/config zoom; undefined → component default (28)
        pxPerDay={pxPerDay}
        // Pinch-to-zoom commits a continuous px back into the same config.
        onPxPerDayChange={onPxPerDayChange}
      />
    </View>
  )
}
