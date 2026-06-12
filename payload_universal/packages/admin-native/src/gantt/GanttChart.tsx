/**
 * GanttChart — infinitely scrollable, user-editable gantt over Payload docs.
 *
 * Injection-friendly core component (no expo-router, no data fetching): the
 * screen supplies already-filtered docs, the configured ScheduleSources and
 * the press/preview/update callbacks; bars derive PURELY from docs, so
 * optimistic UI (and failure spring-back) comes from the screen's
 * local-first write + re-render.
 *
 * STRUCTURE — one outer HORIZONTAL ScrollView hosting a timeline-wide
 * content column: [sticky TimeAxis header] above a [VERTICAL FlatList of
 * row tracks] sized to the full timeline width. The frozen TITLE COLUMN
 * (≈150pt, doc titles + chevron) is an absolute overlay on the LEFT whose
 * content translateY is driven by the FlatList's onScroll via
 * Animated.event (classic frozen-column sync — ONE list, no second
 * scrollable to keep in step). Liquid-glass band behind the header and
 * glass title column (guarded, bordered fallbacks); hairline row separators.
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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type {
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
  GANTT_BAR_HEIGHT,
  GANTT_CHART_DEFAULT_PX_PER_DAY,
  GANTT_EXTEND_DAYS,
  GANTT_EXTEND_THRESHOLD_DAYS,
  GANTT_LANE_GAP,
  GANTT_MIN_ROW_HEIGHT,
  GANTT_REGULAR_WIDTH,
  GANTT_ROW_VERTICAL_PADDING,
  GANTT_TITLE_COLUMN_WIDTH,
  initialGanttWindow,
} from './types'
import type { GanttChartProps, GanttRowModel } from './types'

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
            y={GANTT_ROW_VERTICAL_PADDING + bar.lane * (GANTT_BAR_HEIGHT + GANTT_LANE_GAP)}
            width={bar.spanDays * pxPerDay}
            pxPerDay={pxPerDay}
            readOnly={readOnly}
            gated={gated}
            showGrips={showGrips}
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

export const GanttChart: React.FC<GanttChartProps> = ({
  docs,
  sources,
  useAsTitle,
  onPressBar,
  onPreviewDoc,
  onUpdateDates,
  readOnlyDocIds,
  pxPerDay,
}) => {
  const { dark, colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const px =
    pxPerDay !== undefined && Number.isFinite(pxPerDay) && pxPerDay > 0
      ? pxPerDay
      : GANTT_CHART_DEFAULT_PX_PER_DAY

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
  const initialScrollDoneRef = useRef(false)
  useEffect(() => {
    if (viewport.h <= 0 || initialScrollDoneRef.current) return
    initialScrollDoneRef.current = true
    const todayX = scale.xFromDateKey(todayKey)
    const target = Math.max(0, (todayX ?? 0) - GANTT_TITLE_COLUMN_WIDTH - px)
    requestAnimationFrame(() => {
      hScrollRef.current?.scrollTo({ x: target, animated: false })
      scrollXRef.current = target
    })
  }, [viewport.h, scale, px, todayKey])

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
  const handleDragStateChange = useCallback((dragging: boolean) => {
    setDragLock(dragging)
  }, [])

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
          // Lock while a bar drag is active so the timeline can't drift
          // under the gesture (kanban scroll-locking).
          scrollEnabled={!dragLock}
          scrollEventThrottle={16}
          onScroll={handleHScroll}
          onContentSizeChange={handleContentSizeChange}
          style={styles.hScroll}
        >
          <View style={{ width: timelineWidth, height: viewport.h }}>
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
                scrollEnabled={!dragLock}
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
}

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
