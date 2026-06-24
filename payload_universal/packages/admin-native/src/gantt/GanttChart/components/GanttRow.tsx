// ---------------------------------------------------------------------------
// Row track — bars positioned by the shared GanttScale (memoized per row)
// ---------------------------------------------------------------------------
import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { useListColors } from '../../../hooks/useListColors'
import type {
  GanttScale,
  ScheduleDoc,
  ScheduleSource,
} from '../../../scheduling'
import { GanttBar } from '../../GanttBar'
import {
  GANTT_BAR_HEIGHT,
  GANTT_LANE_GAP,
  GANTT_POINT_SIZE,
  GANTT_ROW_VERTICAL_PADDING,
} from '../../types'
import type { GanttRowModel } from '../../types'

export type GanttRowProps = {
  row: GanttRowModel
  scale: GanttScale
  pxPerDay: number
  timelineWidth: number
  gated: boolean
  readOnly: boolean
  showGrips: boolean
  onPressDoc: (doc: ScheduleDoc) => void
  onPreviewDoc?: (doc: ScheduleDoc) => void
  onCommitDates: (
    doc: ScheduleDoc,
    source: ScheduleSource,
    next: { start: string; end: string },
  ) => void
  onDragStateChange: (dragging: boolean) => void
}

const GanttRowInner: React.FC<GanttRowProps> = ({
  row,
  scale,
  pxPerDay,
  timelineWidth,
  gated,
  readOnly,
  showGrips,
  onPressDoc,
  onPreviewDoc,
  onCommitDates,
  onDragStateChange,
}) => {
  const { colors } = useListColors()
  // Rows with an active drag elevate so the snapped-dates tooltip (which
  // overflows upward into the PREVIOUS row's space — always below this row
  // in the cell stacking order) renders above neighbouring bars.
  const [rowDragging, setRowDragging] = useState(false)
  const handleDragStateChange = useCallback(
    (dragging: boolean) => {
      setRowDragging(dragging)
      onDragStateChange(dragging)
    },
    [onDragStateChange],
  )

  // Trailing-title collision check (G5): per lane, the free run between a
  // bar's right edge and the NEXT bar's left edge (or the timeline end).
  // Pure x-extent math over the already lane-packed bars.
  const trailingSpaceById = useMemo(() => {
    const byLane = new Map<number, Array<{ id: string; startX: number; endX: number }>>()
    for (const bar of row.bars) {
      const x = scale.xFromDateKey(bar.startKey)
      if (x === null) continue
      // Rendered extent: point diamonds occupy at least GANTT_POINT_SIZE.
      const endX = x + Math.max(bar.spanDays * pxPerDay, GANTT_POINT_SIZE)
      const list = byLane.get(bar.lane)
      const entry = { id: bar.event.id, startX: x, endX }
      if (list) list.push(entry)
      else byLane.set(bar.lane, [entry])
    }
    const out = new Map<string, number>()
    for (const list of byLane.values()) {
      list.sort((a, b) => a.startX - b.startX)
      for (let i = 0; i < list.length; i += 1) {
        const next = list[i + 1]
        out.set(list[i].id, (next ? next.startX : timelineWidth) - list[i].endX)
      }
    }
    return out
  }, [row.bars, scale, pxPerDay, timelineWidth])

  // Bars centre on their lane: lane unit comes from the row (tightened for
  // point-only rows), while the bar root stays GANTT_BAR_HEIGHT tall — the
  // (laneHeight − barHeight)/2 term keeps diamonds optically centred.
  const laneUnit = row.laneHeight
  const laneCenterOffset = (laneUnit - GANTT_BAR_HEIGHT) / 2

  return (
    <View
      style={{
        width: timelineWidth,
        height: row.height,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.hairline,
        zIndex: rowDragging ? 40 : 0,
      }}
    >
      {row.bars.map((bar) => {
        const x = scale.xFromDateKey(bar.startKey)
        if (x === null) return null
        return (
          <GanttBar
            key={bar.event.id}
            bar={bar}
            x={x}
            y={
              GANTT_ROW_VERTICAL_PADDING +
              bar.lane * (laneUnit + GANTT_LANE_GAP) +
              laneCenterOffset
            }
            width={bar.spanDays * pxPerDay}
            pxPerDay={pxPerDay}
            readOnly={readOnly}
            gated={gated}
            showGrips={showGrips}
            trailingSpace={trailingSpaceById.get(bar.event.id)}
            onPress={() => onPressDoc(bar.doc)}
            onPreview={onPreviewDoc ? () => onPreviewDoc(bar.doc) : undefined}
            onCommit={(next) => onCommitDates(bar.doc, bar.source, next)}
            onDragStateChange={handleDragStateChange}
          />
        )
      })}
    </View>
  )
}
export const GanttRow = React.memo(GanttRowInner)
GanttRow.displayName = 'GanttRow'
