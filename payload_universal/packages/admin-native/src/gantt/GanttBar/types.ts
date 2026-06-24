import type { GanttBarSpec, GanttDragMode } from '../types'

export type GanttBarProps = {
  bar: GanttBarSpec
  /** Bar left edge in timeline (row-relative) coordinates. */
  x: number
  /** Bar top within the row (lane offset). */
  y: number
  /** Bar width in px (spanDays * pxPerDay). */
  width: number
  pxPerDay: number
  /** Patch in flight — dimmed, taps still open the doc, editing disabled. */
  readOnly?: boolean
  /** Another bar on the chart is mid-drag — suppress new presses/claims. */
  gated?: boolean
  /** Regular width (iPad-class): render visible grips inside the handles. */
  showGrips?: boolean
  /**
   * Free horizontal run (px) between this bar's right edge and the next
   * event in the SAME lane (or the timeline end) — computed by the row via
   * a simple x-extent collision check. Bars that can't fit their title
   * inside (point diamonds, sub-48pt slivers) render it to the RIGHT in
   * this run when it is at least GANTT_TRAILING_LABEL_MIN_SPACE wide,
   * ellipsized to the available width. Hidden mid-drag (it would lie).
   */
  trailingSpace?: number
  onPress: () => void
  onPreview?: () => void
  /** Fired ONCE per completed drag with the day-snapped next ISO range. */
  onCommit: (next: { start: string; end: string }) => void
  /**
   * Drag lifecycle for the chart's scroll locks. MUST be referentially
   * stable (the chart passes a memoized callback) — the bar invokes it from
   * once-created responder closures.
   */
  onDragStateChange: (dragging: boolean) => void
}

export type SnapState = { mode: GanttDragMode; delta: number } | null
