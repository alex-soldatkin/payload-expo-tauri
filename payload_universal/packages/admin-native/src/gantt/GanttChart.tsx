/**
 * GanttChart — infinitely scrollable, user-editable gantt over Payload docs.
 *
 * Injection-friendly core component (no expo-router, no data fetching): the
 * screen supplies already-filtered docs, the configured ScheduleSources and
 * the press/preview/update callbacks; bars derive PURELY from docs, so
 * optimistic UI (and failure spring-back) comes from the screen's
 * local-first write + re-render.
 *
 * STRUCTURE — one outer HORIZONTAL Animated.ScrollView hosting a
 * timeline-wide content column: [sticky TimeAxis header] above a [VERTICAL
 * FlatList of row tracks] sized to the full timeline width. The frozen
 * TITLE COLUMN (≈150pt, doc titles + chevron) is an absolute overlay on the
 * LEFT whose content translateY is driven by the FlatList's onScroll via
 * Animated.event (classic frozen-column sync — ONE list, no second
 * scrollable to keep in step). The horizontal offset is ALSO mapped into a
 * native Animated value (scrollX) that drives the TimeAxis's sticky month
 * labels.
 *
 * GLASS IS BACKGROUND-ONLY (the DocumentListTable rule): the header band
 * and the title column render a GlassView as an absolute-fill layer with
 * the text/Pressable content as plain RN SIBLINGS above it — NEVER as
 * GlassView children. GlassView re-parents children into its
 * UIVisualEffectView.contentView on iOS 26 (see expo-glass-effect
 * GlassView.swift mountChildComponentView); RN text inside that re-parented
 * subtree failed to draw on device (the G1 invisible-titles bug: chevron
 * SVGs survived, every <Text> vanished), so content stays in the normal RN
 * hierarchy and only the material is glass.
 *
 * INFINITE BOTH AXES:
 *  - vertical: the FlatList windows rows natively (getItemLayout from the
 *    precomputed row heights — lane counts are pure data).
 *  - horizontal: a WINDOWED TIME RANGE [windowStart, windowEnd], initialised
 *    to min(event starts, today)−14d … max(event ends, today)+30d (clamped
 *    to ±366d around today against corrupt far-out dates). When the scroll
 *    offset nears either edge the window EXTENDS by 60 days on that side.
 *    JUMP-FREE LEFT EXTENSION: prepending days grows the content and shifts
 *    every existing x by addedDays*pxPerDay, so the compensation
 *    (offset += addedDays*pxPerDay) is applied in onContentSizeChange — the
 *    first callback where the native content size already includes the new
 *    days; scrollTo({animated:false}) there updates contentOffset in the
 *    same frame as the wider content commits, so the viewport-relative
 *    content never visibly moves. The pending shift lives in a ref and
 *    extension re-entry is gated until the size change lands. Right
 *    extension appends — no compensation needed.
 *
 * BARS: lane-packed per row (first-fit, MonthGridFallback's packing style —
 * see packRowLanes in ./types). All drag editing (PanResponder-only handle
 * resize / hold-then-move body shift / static-hold peek) is owned by
 * GanttBar; while any drag is active the chart sets scrollEnabled=false on
 * BOTH the horizontal ScrollView and the FlatList (kanban scroll-locking)
 * so the timeline cannot drift under the gesture.
 *
 * Day-grid math comes from the shared ../scheduling GanttScale — nothing is
 * duplicated here.
 */
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native'

import { defaultTheme as t } from '../theme'
import { useListColors } from '../hooks/useListColors'
import type { ListColorPalette } from '../hooks/useListColors'
import {
  addDaysToKey,
  createGanttScale,
  dateKeyFromDayIndex,
  dayIndexFromKey,
  parseDateKey,
  todayDateKey,
} from '../scheduling'
import type {
  DateKeyRange,
  GanttScale,
  ScheduleDoc,
  ScheduleSource,
} from '../scheduling'
import { GanttBar } from './GanttBar'
import { TimeAxis } from './TimeAxis'
import {
  buildGanttRows,
  GANTT_AXIS_HEIGHT,
  GANTT_AXIS_TOP_PAD,
  GANTT_BAR_HEIGHT,
  GANTT_CHART_DEFAULT_PX_PER_DAY,
  GANTT_EXTEND_DAYS,
  GANTT_EXTEND_THRESHOLD_DAYS,
  GANTT_LANE_GAP,
  GANTT_MAX_PX_PER_DAY,
  GANTT_MIN_PX_PER_DAY,
  GANTT_MIN_ROW_HEIGHT,
  GANTT_POINT_SIZE,
  GANTT_REGULAR_WIDTH,
  GANTT_ROW_VERTICAL_PADDING,
  GANTT_TITLE_COLUMN_WIDTH,
  initialGanttWindow,
} from './types'
import type { GanttChartHandle, GanttChartProps, GanttRowModel } from './types'

// Optional: GlassView for the header band + title column on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed */
}

// Optional: lucide chevron for title rows (pure RN SVG) with a glyph fallback
let ChevronRightIcon: React.ComponentType<{ size: number; color: string }> | null = null
try {
  const lucide = require('lucide-react-native')
  ChevronRightIcon = lucide.ChevronRight ?? null
} catch {
  /* lucide-react-native not available */
}

// Animated wrapper keeps the native-driver Animated.event scroll mapping;
// the cast preserves FlatList's generic prop typing for TSX.
const AnimatedFlatList = Animated.FlatList as unknown as typeof FlatList

// ---------------------------------------------------------------------------
// Row track — bars positioned by the shared GanttScale (memoized per row)
// ---------------------------------------------------------------------------

type GanttRowProps = {
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
const GanttRow = React.memo(GanttRowInner)
GanttRow.displayName = 'GanttRow'

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------

export const GanttChart = React.forwardRef<GanttChartHandle, GanttChartProps>((
  {
    docs,
    sources,
    useAsTitle,
    onPressBar,
    onPreviewDoc,
    onUpdateDates,
    readOnlyDocIds,
    pxPerDay,
    onPxPerDayChange,
  },
  handleRef,
) => {
  const { dark, colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const px =
    pxPerDay !== undefined && Number.isFinite(pxPerDay) && pxPerDay > 0
      ? pxPerDay
      : GANTT_CHART_DEFAULT_PX_PER_DAY
  const pxRef = useRef(px)
  pxRef.current = px

  const todayKey = todayDateKey()

  // ── Rows (pure data — heights drive both the FlatList and the titles) ──
  const rows = useMemo(
    () => buildGanttRows(docs, sources, useAsTitle),
    [docs, sources, useAsTitle],
  )
  const rowOffsets = useMemo(() => {
    const offsets: number[] = []
    let acc = 0
    for (const row of rows) {
      offsets.push(acc)
      acc += row.height
    }
    return offsets
  }, [rows])

  const readOnlySet = useMemo(() => new Set(readOnlyDocIds ?? []), [readOnlyDocIds])

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
  const timelineWidthRef = useRef(timelineWidth)
  timelineWidthRef.current = timelineWidth

  // Pending LEFT-extension compensation (px) — consumed in
  // onContentSizeChange (see the jump-free technique in the header comment).
  const pendingLeftShiftPxRef = useRef(0)
  // One extension at a time: re-armed when the content size change lands.
  const extendInFlightRef = useRef(false)
  const scrollXRef = useRef(0)
  const hScrollRef = useRef<ScrollView>(null)

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

  // ── Viewport ─────────────────────────────────────────────────────────
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const showGrips = viewport.w >= GANTT_REGULAR_WIDTH

  const handleRootLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setViewport((v) => (v.w === width && v.h === height ? v : { w: width, h: height }))
  }, [])

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
    [scale, px, todayKey],
  )

  useImperativeHandle(handleRef, () => ({ scrollToToday }), [scrollToToday])

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
    [px],
  )

  /**
   * The jump-free moment: the native content size now includes the prepended
   * days, so adding addedDays*pxPerDay to the offset here re-anchors the
   * viewport onto the exact same dates within the same frame as the wider
   * content — no visible jump, no clamping (the content is already wide
   * enough for the larger offset).
   */
  const handleContentSizeChange = useCallback((w: number) => {
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
  }, [])

  // ── Frozen-column vertical sync (Animated.event — no second list) ────
  const scrollY = useRef(new Animated.Value(0)).current
  const titleTranslateY = useMemo(() => Animated.multiply(scrollY, -1), [scrollY])
  const onVerticalScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  )

  // ── Drag lock (kanban scroll-locking) + stable injection callbacks ───
  const [dragLock, setDragLock] = useState(false)
  const dragLockRef = useRef(dragLock)
  dragLockRef.current = dragLock
  const handleDragStateChange = useCallback((dragging: boolean) => {
    setDragLock(dragging)
  }, [])

  // ── Pinch-to-zoom (two-finger, focal-point anchored) ──────────────────
  // Two phases (Apple-Maps pattern): a CHEAP visual scaleX transform on the
  // timeline content at 60fps WITHOUT re-layout, then on release commit the
  // new pxPerDay through `onPxPerDayChange` and compensate scrollX so the
  // focal date stays under the fingers.
  //
  // FOCAL-ANCHOR MATH (RN scaleX is CENTER-anchored about the content view):
  //   A content point f renders, under center-anchored scaleX `s` plus an
  //   added translateX `tx`, at content-x  f*s + (W/2)*(1−s) + tx  (W = full
  //   timeline width). Subtract the (locked) scroll offset for its viewport-x.
  //   To keep f fixed in the viewport we need that to equal f, so
  //     tx = (1 − s) * (f − W/2).
  //   On release the committed ratio is sCommit = newPx / basePx (after the
  //   MIN/MAX clamp, which can differ from the raw finger ratio). The focal
  //   date sat at f in the OLD scale; at the new scale the same date is at
  //   f*sCommit, so to hold it under the fingers the new offset is
  //     scrollXnew = scrollX0 + f*(sCommit − 1)
  //   applied synchronously once the wider/narrower content size lands
  //   (handleContentSizeChange — the same jump-free moment the left-extension
  //   uses), with the visual transform reset to identity in the same commit.
  const [pinchActive, setPinchActive] = useState(false)
  const pinchActiveRef = useRef(false)
  const pinchScaleX = useRef(new Animated.Value(1)).current
  const pinchTranslateX = useRef(new Animated.Value(0)).current
  const pinchStartDistRef = useRef(0)
  const pinchFocalRef = useRef(0) // focal content-x (untransformed)
  const pinchScrollX0Ref = useRef(0) // scroll offset at gesture start
  const pinchBasePxRef = useRef(px) // px column width at gesture start
  const pinchRatioRef = useRef(1) // latest live ratio (post-clamp preview)
  // Absolute scrollX to restore once the committed content size lands
  // (NaN = no pending zoom compensation).
  const pendingZoomScrollXRef = useRef(Number.NaN)

  // Stable ref so the once-created pinch responder commits through the latest
  // screen callback without re-creating the responder.
  const onPxPerDayChangeRef = useRef(onPxPerDayChange)
  onPxPerDayChangeRef.current = onPxPerDayChange

  const twoTouchDistance = useCallback((e: GestureResponderEvent): number => {
    const ts = e.nativeEvent.touches
    if (ts.length < 2) return 0
    const dx = ts[0].pageX - ts[1].pageX
    const dy = ts[0].pageY - ts[1].pageY
    return Math.hypot(dx, dy)
  }, [])

  const twoTouchFocalContentX = useCallback((e: GestureResponderEvent): number => {
    // locationX is relative to the responder target (the timeline content
    // View), so it IS the untransformed content-x — the transform we apply
    // lives on a child wrapper inside this same View.
    const ts = e.nativeEvent.touches
    if (ts.length < 2) return scrollXRef.current
    return (ts[0].locationX + ts[1].locationX) / 2
  }, [])

  // Commit the pinch: clamp the new px, queue the focal-anchored scroll
  // compensation for the next content-size commit, reset the visual transform
  // and hand the new density to the screen. Idempotent (release + terminate
  // can race) via the pinchActiveRef gate.
  const commitPinch = useCallback(() => {
    if (!pinchActiveRef.current) return
    pinchActiveRef.current = false
    const base = pinchBasePxRef.current
    const sCommit = pinchRatioRef.current
    const newPx = Math.max(
      GANTT_MIN_PX_PER_DAY,
      Math.min(GANTT_MAX_PX_PER_DAY, base * sCommit),
    )
    const ratio = newPx / base
    const f = pinchFocalRef.current
    // Hold the focal date under the fingers at the new scale.
    const scrollXnew = Math.max(0, pinchScrollX0Ref.current + f * (ratio - 1))
    // Reset the visual transform now; the layout jump to newPx (and the
    // scroll compensation) lands in handleContentSizeChange.
    pinchScaleX.setValue(1)
    pinchTranslateX.setValue(0)
    setPinchActive(false)
    if (Math.abs(newPx - base) < 0.5) return // no meaningful change
    pendingZoomScrollXRef.current = scrollXnew
    onPxPerDayChangeRef.current?.(newPx)
  }, [pinchScaleX, pinchTranslateX])

  const pinchResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim ONLY a genuine two-finger gesture — single-touch scroll, bar
        // drags, handle drags and the static-hold peek all start with ONE
        // touch and are never intercepted. A bar drag in flight (dragLock)
        // hard-blocks the claim defensively.
        onStartShouldSetPanResponderCapture: (e) =>
          !dragLockRef.current && e.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponderCapture: (e) =>
          !dragLockRef.current &&
          !pinchActiveRef.current &&
          e.nativeEvent.touches.length >= 2,
        onPanResponderGrant: (e) => {
          const dist = twoTouchDistance(e)
          if (dist <= 0) return
          pinchActiveRef.current = true
          pinchStartDistRef.current = dist
          pinchFocalRef.current = twoTouchFocalContentX(e)
          pinchScrollX0Ref.current = scrollXRef.current
          pinchBasePxRef.current = pxRef.current
          pinchRatioRef.current = 1
          pinchScaleX.setValue(1)
          pinchTranslateX.setValue(0)
          setPinchActive(true)
        },
        onPanResponderMove: (e) => {
          if (!pinchActiveRef.current) return
          const dist = twoTouchDistance(e)
          if (dist <= 0 || pinchStartDistRef.current <= 0) return
          const base = pinchBasePxRef.current
          // Clamp the live ratio to the committable px range so the preview
          // never promises a zoom the commit can't keep.
          const rawRatio = dist / pinchStartDistRef.current
          const clampedPx = Math.max(
            GANTT_MIN_PX_PER_DAY,
            Math.min(GANTT_MAX_PX_PER_DAY, base * rawRatio),
          )
          const s = clampedPx / base
          pinchRatioRef.current = s
          const f = pinchFocalRef.current
          const w = timelineWidthRef.current
          pinchScaleX.setValue(s)
          pinchTranslateX.setValue((1 - s) * (f - w / 2))
        },
        onPanResponderRelease: () => commitPinch(),
        onPanResponderTerminate: () => commitPinch(),
        onPanResponderTerminationRequest: () => false,
      }),
    // commitPinch + the helpers are stable useCallbacks and the Animated
    // values / state setter are refs/stable, so the responder is created once.
    [commitPinch, twoTouchDistance, twoTouchFocalContentX, pinchScaleX, pinchTranslateX],
  )

  const onPressBarRef = useRef(onPressBar)
  onPressBarRef.current = onPressBar
  const stablePressDoc = useCallback((doc: ScheduleDoc) => {
    onPressBarRef.current(doc)
  }, [])

  const onPreviewDocRef = useRef(onPreviewDoc)
  onPreviewDocRef.current = onPreviewDoc
  const stablePreviewDoc = useCallback((doc: ScheduleDoc) => {
    onPreviewDocRef.current?.(doc)
  }, [])
  const hasPreview = Boolean(onPreviewDoc)

  const onUpdateDatesRef = useRef(onUpdateDates)
  onUpdateDatesRef.current = onUpdateDates
  const stableCommitDates = useCallback(
    (doc: ScheduleDoc, source: ScheduleSource, next: { start: string; end: string }) => {
      // The screen owns error surfacing (toast); never crash the chart.
      try {
        void Promise.resolve(onUpdateDatesRef.current(doc, source, next)).catch(() => {})
      } catch {
        /* sync onUpdateDates threw — swallow, screen state stays authoritative */
      }
    },
    [],
  )

  // ── Grid decorations ─────────────────────────────────────────────────
  // Weekend stripes span the body VIEWPORT height (they sit behind the
  // FlatList, so they read as continuous columns while rows scroll).
  // Consecutive weekend days merge into one stripe (~totalDays/7 views).
  const weekendStripes = useMemo(() => {
    const out: Array<{ left: number; width: number }> = []
    let runStart = -1
    for (let i = 0; i < totalDays; i += 1) {
      const d = parseDateKey(dateKeyFromDayIndex(i, window.startKey))
      const weekend = d ? d.getDay() === 0 || d.getDay() === 6 : false
      if (weekend && runStart === -1) runStart = i
      if (!weekend && runStart !== -1) {
        out.push({ left: runStart * px, width: (i - runStart) * px })
        runStart = -1
      }
    }
    if (runStart !== -1) out.push({ left: runStart * px, width: (totalDays - runStart) * px })
    return out
  }, [window.startKey, totalDays, px])

  const todayX = scale.xFromDateKey(todayKey)

  // ── FlatList plumbing ────────────────────────────────────────────────
  const keyExtractor = useCallback((row: GanttRowModel) => row.docId, [])
  const getItemLayout = useCallback(
    (_data: ArrayLike<GanttRowModel> | null | undefined, index: number) => ({
      length: rows[index]?.height ?? GANTT_MIN_ROW_HEIGHT,
      offset: rowOffsets[index] ?? 0,
      index,
    }),
    [rows, rowOffsets],
  )

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<GanttRowModel>) => (
      <GanttRow
        row={item}
        scale={scale}
        pxPerDay={px}
        timelineWidth={timelineWidth}
        gated={dragLock}
        readOnly={readOnlySet.has(item.docId)}
        showGrips={showGrips}
        onPressDoc={stablePressDoc}
        onPreviewDoc={hasPreview ? stablePreviewDoc : undefined}
        onCommitDates={stableCommitDates}
        onDragStateChange={handleDragStateChange}
      />
    ),
    [
      scale,
      px,
      timelineWidth,
      dragLock,
      readOnlySet,
      showGrips,
      stablePressDoc,
      hasPreview,
      stablePreviewDoc,
      stableCommitDates,
      handleDragStateChange,
    ],
  )

  const listEmpty = useMemo(
    () => (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No documents to schedule</Text>
      </View>
    ),
    [styles],
  )

  // ── Frozen title column (absolute overlay, translateY-synced) ────────
  const titleInner = (
    <>
      <View style={styles.titleCorner}>
        <Text style={styles.titleCornerText} numberOfLines={1}>
          {`${rows.length} ${rows.length === 1 ? 'doc' : 'docs'}`}
        </Text>
      </View>
      <View style={styles.titleRowsClip}>
        <Animated.View style={{ transform: [{ translateY: titleTranslateY }] }}>
          {rows.map((row) => (
            <Pressable
              key={row.docId}
              style={({ pressed }) => [
                styles.titleRow,
                { height: row.height },
                pressed && styles.titleRowPressed,
              ]}
              onPress={dragLock ? undefined : () => stablePressDoc(row.doc)}
              accessibilityRole="button"
              accessibilityLabel={row.title}
            >
              <Text style={styles.titleText} numberOfLines={2}>
                {row.title}
              </Text>
              {ChevronRightIcon ? (
                <ChevronRightIcon size={14} color={colors.tertiary} />
              ) : (
                <Text style={styles.titleChevron}>{'›'}</Text>
              )}
            </Pressable>
          ))}
        </Animated.View>
      </View>
    </>
  )

  return (
    <View style={styles.root} onLayout={handleRootLayout}>
      {/* Viewport-fixed glass band behind the (transparent) axis ticks —
          glass must not scroll with the content, and one viewport-wide
          GlassView beats a timeline-wide one. */}
      {liquidGlassAvailable && GlassView ? (
        <GlassView style={styles.axisBand} glassEffectStyle="regular" />
      ) : (
        <View style={[styles.axisBand, styles.axisBandFallback, dark && styles.axisBandDark]} />
      )}
      {viewport.h > 0 ? (
        <ScrollView
          ref={hScrollRef}
          horizontal
          bounces={false}
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          // Lock while a bar drag OR a pinch is active so the timeline can't
          // drift under the gesture (kanban scroll-locking + pinch lock).
          scrollEnabled={!dragLock && !pinchActive}
          scrollEventThrottle={16}
          onScroll={handleHScroll}
          onContentSizeChange={handleContentSizeChange}
          style={styles.hScroll}
        >
          {/* Pinch responder on the timeline content (an ANCESTOR of the bars,
              a DESCENDANT of the ScrollView): claims ONLY two-finger gestures
              in the capture phase, so single-touch scroll / bar-drag / handle
              / peek paths win untouched. The Animated wrapper applies the
              cheap focal-anchored scaleX preview (no re-layout). */}
          <View
            {...pinchResponder.panHandlers}
            style={{ width: timelineWidth, height: viewport.h }}
          >
            <Animated.View
              style={{
                width: timelineWidth,
                height: viewport.h,
                transform: [
                  { translateX: pinchTranslateX },
                  { scaleX: pinchScaleX },
                ],
              }}
            >
              <TimeAxis
                windowStartKey={window.startKey}
                totalDays={totalDays}
                pxPerDay={px}
                todayKey={todayKey}
              />
              <View style={styles.bodyWrap}>
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                  {weekendStripes.map((stripe) => (
                    <View
                      key={stripe.left}
                      style={[styles.weekendStripe, { left: stripe.left, width: stripe.width }]}
                    />
                  ))}
                </View>
                <AnimatedFlatList<GanttRowModel>
                  data={rows}
                  keyExtractor={keyExtractor}
                  renderItem={renderItem}
                  getItemLayout={getItemLayout}
                  extraData={renderItem}
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={!dragLock && !pinchActive}
                  onScroll={onVerticalScroll}
                  scrollEventThrottle={16}
                  nestedScrollEnabled
                  // Drag tooltips overflow their row — never clip cells.
                  removeClippedSubviews={false}
                  ListEmptyComponent={listEmpty}
                />
                {/* Today line in the primary tint, through the full grid. */}
                {todayX !== null ? (
                  <View
                    pointerEvents="none"
                    style={[styles.todayLine, { left: todayX }]}
                  />
                ) : null}
              </View>
            </Animated.View>
          </View>
        </ScrollView>
      ) : null}
      {/* Frozen title column — absolute glass overlay; its rows translate
          with the FlatList scroll (Animated.event above). */}
      {viewport.h > 0 ? (
        liquidGlassAvailable && GlassView ? (
          <GlassView style={styles.titleOverlay} glassEffectStyle="regular">
            {titleInner}
          </GlassView>
        ) : (
          <View style={[styles.titleOverlay, styles.titleOverlayFallback]}>
            {titleInner}
          </View>
        )
      ) : null}
    </View>
  )
})

GanttChart.displayName = 'GanttChart'

// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },

    axisBand: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: GANTT_AXIS_HEIGHT,
    },
    axisBandFallback: { backgroundColor: c.surface },
    axisBandDark: {},

    hScroll: { flex: 1 },
    bodyWrap: { flex: 1 },
    list: { flex: 1 },
    listContent: { paddingBottom: 24 },

    weekendStripe: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      backgroundColor: c.pressed,
    },
    todayLine: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: c.primary,
      opacity: 0.85,
    },

    titleOverlay: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: GANTT_TITLE_COLUMN_WIDTH,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: c.hairline,
      overflow: 'hidden',
    },
    titleOverlayFallback: { backgroundColor: c.card },
    titleCorner: {
      height: GANTT_AXIS_HEIGHT,
      justifyContent: 'flex-end',
      paddingHorizontal: 10,
      paddingBottom: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    titleCornerText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: c.textMuted,
    },
    titleRowsClip: { flex: 1, overflow: 'hidden' },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    titleRowPressed: { backgroundColor: c.pressed },
    titleText: { flex: 1, fontSize: 12, fontWeight: '600', color: c.text },
    titleChevron: { fontSize: 14, fontWeight: '600', color: c.tertiary },

    empty: { paddingTop: 48, paddingLeft: GANTT_TITLE_COLUMN_WIDTH + 24 },
    emptyText: { fontSize: t.fontSize.md, color: c.textMuted },
  })
