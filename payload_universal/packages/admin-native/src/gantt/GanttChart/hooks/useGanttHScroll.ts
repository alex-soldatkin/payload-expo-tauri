// ---------------------------------------------------------------------------
// Horizontal time-window machinery (the infinite X axis)
// ---------------------------------------------------------------------------
//
// Owns the WINDOWED TIME RANGE [windowStart, windowEnd] and the jump-free
// edge extension. Initialised to min(event starts, today)−14d … max(event
// ends, today)+30d (clamped to ±366d around today). When the scroll offset
// nears either edge the window EXTENDS by 60 days on that side. Left
// extension prepends days (growing content, shifting every x); the
// compensation (offset += addedDays*pxPerDay) lands in onContentSizeChange —
// the first callback where the native content size already includes the new
// days — so the viewport-relative content never visibly moves. Right
// extension appends (no compensation). The pinch-commit scroll compensation
// (pendingZoomScrollXRef, owned by usePinchZoom) is consumed in the SAME
// jump-free moment.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ScrollView } from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import {
  addDaysToKey,
  createGanttScale,
  dayIndexFromKey,
} from '../../../scheduling'
import type { DateKeyRange, GanttScale } from '../../../scheduling'
import {
  GANTT_EXTEND_DAYS,
  GANTT_EXTEND_THRESHOLD_DAYS,
  GANTT_TITLE_COLUMN_WIDTH,
  initialGanttWindow,
} from '../../types'
import type { GanttRowModel } from '../../types'

export type UseGanttHScrollArgs = {
  rows: GanttRowModel[]
  todayKey: string
  px: number
  viewport: { w: number; h: number }
  scrollXRef: React.MutableRefObject<number>
  hScrollRef: React.RefObject<ScrollView | null>
  timelineWidthRef: React.MutableRefObject<number>
  viewportRef: React.MutableRefObject<{ w: number; h: number }>
  pendingZoomScrollXRef: React.MutableRefObject<number>
}

export type UseGanttHScroll = {
  window: DateKeyRange
  scale: GanttScale
  totalDays: number
  timelineWidth: number
  handleHScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleContentSizeChange: (w: number) => void
  scrollToToday: (animated?: boolean) => void
}

export function useGanttHScroll({
  rows,
  todayKey,
  px,
  viewport,
  scrollXRef,
  hScrollRef,
  timelineWidthRef,
  viewportRef,
  pendingZoomScrollXRef,
}: UseGanttHScrollArgs): UseGanttHScroll {
  // ── Windowed time range ──────────────────────────────────────────────
  const [window, setWindow] = useState<DateKeyRange>(() =>
    initialGanttWindow(rows, todayKey),
  )
  const windowRef = useRef(window)
  windowRef.current = window

  const scale = useMemo(() => createGanttScale(window.startKey, px), [window.startKey, px])
  const totalDays = useMemo(
    () => (dayIndexFromKey(window.endKey, window.startKey) ?? 0) + 1,
    [window],
  )
  const timelineWidth = totalDays * px
  timelineWidthRef.current = timelineWidth

  // Pending LEFT-extension compensation (px) — consumed in
  // onContentSizeChange (see the jump-free technique in the module comment).
  const pendingLeftShiftPxRef = useRef(0)
  // One extension at a time: re-armed when the content size change lands.
  const extendInFlightRef = useRef(false)

  // Docs changed (sync / pagination): GROW the window to keep every event
  // inside it (never shrink — that would shift the offset under the user).
  // Left growth funds the same pending-shift compensation as edge scrolling.
  useEffect(() => {
    const desired = initialGanttWindow(rows, todayKey)
    const current = windowRef.current
    let nextStart = current.startKey
    let nextEnd = current.endKey
    if (desired.startKey < current.startKey) {
      const added = dayIndexFromKey(current.startKey, desired.startKey)
      if (added !== null && added > 0) {
        pendingLeftShiftPxRef.current += added * px
        nextStart = desired.startKey
      }
    }
    if (desired.endKey > current.endKey) nextEnd = desired.endKey
    if (nextStart !== current.startKey || nextEnd !== current.endKey) {
      setWindow({ startKey: nextStart, endKey: nextEnd })
    }
  }, [rows, px, todayKey])

  // The timeline must overhang the viewport on the right so edge-extension
  // has scroll room to trigger (first layout on wide screens).
  useEffect(() => {
    if (viewport.w <= 0) return
    const needed = viewport.w + GANTT_EXTEND_THRESHOLD_DAYS * px * 2
    if (timelineWidth < needed) {
      const addDays = Math.max(Math.ceil((needed - timelineWidth) / px), GANTT_EXTEND_DAYS)
      const current = windowRef.current
      setWindow({ startKey: current.startKey, endKey: addDaysToKey(current.endKey, addDays) })
    }
  }, [viewport.w, timelineWidth, px])

  // Initial position: today lands just right of the frozen title column.
  // Recenter so today sits just past the frozen title column. Shared by the
  // first-layout effect and the imperative `scrollToToday` (Today button).
  const scrollToToday = useCallback(
    (animated = true) => {
      const todayX = scale.xFromDateKey(todayKey)
      const target = Math.max(0, (todayX ?? 0) - GANTT_TITLE_COLUMN_WIDTH - px)
      hScrollRef.current?.scrollTo({ x: target, animated })
      scrollXRef.current = target
    },
    [scale, px, todayKey, hScrollRef, scrollXRef],
  )

  const initialScrollDoneRef = useRef(false)
  useEffect(() => {
    if (viewport.h <= 0 || initialScrollDoneRef.current) return
    initialScrollDoneRef.current = true
    requestAnimationFrame(() => scrollToToday(false))
  }, [viewport.h, scrollToToday])

  // ── Horizontal edge extension ────────────────────────────────────────
  const handleHScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x
      scrollXRef.current = x
      if (extendInFlightRef.current || pendingLeftShiftPxRef.current > 0) return
      const threshold = GANTT_EXTEND_THRESHOLD_DAYS * px
      const current = windowRef.current
      if (x < threshold) {
        extendInFlightRef.current = true
        pendingLeftShiftPxRef.current += GANTT_EXTEND_DAYS * px
        setWindow({
          startKey: addDaysToKey(current.startKey, -GANTT_EXTEND_DAYS),
          endKey: current.endKey,
        })
      } else if (x + viewportRef.current.w > timelineWidthRef.current - threshold) {
        extendInFlightRef.current = true
        setWindow({
          startKey: current.startKey,
          endKey: addDaysToKey(current.endKey, GANTT_EXTEND_DAYS),
        })
      }
    },
    [px, scrollXRef, viewportRef, timelineWidthRef],
  )

  /**
   * The jump-free moment: the native content size now includes the prepended
   * days, so adding addedDays*pxPerDay to the offset here re-anchors the
   * viewport onto the exact same dates within the same frame as the wider
   * content — no visible jump, no clamping (the content is already wide
   * enough for the larger offset).
   */
  const handleContentSizeChange = useCallback(
    (w: number) => {
      timelineWidthRef.current = w
      extendInFlightRef.current = false
      // Pinch-commit compensation: the content just re-laid-out at the new
      // pxPerDay, so re-anchoring the focal date here keeps it under the fingers
      // within the same frame as the resize (the jump-free moment). Absolute
      // target — takes precedence over an edge-extension shift (they never
      // overlap: scroll is locked during a pinch).
      const zoomTarget = pendingZoomScrollXRef.current
      if (!Number.isNaN(zoomTarget)) {
        pendingZoomScrollXRef.current = Number.NaN
        pendingLeftShiftPxRef.current = 0
        const clamped = Math.max(0, Math.min(zoomTarget, Math.max(0, w - viewportRef.current.w)))
        hScrollRef.current?.scrollTo({ x: clamped, animated: false })
        scrollXRef.current = clamped
        return
      }
      const shift = pendingLeftShiftPxRef.current
      if (shift > 0) {
        pendingLeftShiftPxRef.current = 0
        const target = scrollXRef.current + shift
        hScrollRef.current?.scrollTo({ x: target, animated: false })
        scrollXRef.current = target
      }
    },
    [pendingZoomScrollXRef, timelineWidthRef, viewportRef, hScrollRef, scrollXRef],
  )

  return {
    window,
    scale,
    totalDays,
    timelineWidth,
    handleHScroll,
    handleContentSizeChange,
    scrollToToday,
  }
}
