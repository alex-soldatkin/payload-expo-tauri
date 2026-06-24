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
 *  - horizontal: a WINDOWED TIME RANGE owned by useGanttHScroll — extends
 *    jump-free at either edge (see that hook). Right extension appends; left
 *    extension prepends with the onContentSizeChange offset compensation.
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
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Animated,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type {
  LayoutChangeEvent,
  ListRenderItemInfo,
} from 'react-native'

import { useListColors } from '../../hooks/useListColors'
import { todayDateKey } from '../../scheduling'
import type { ScheduleDoc, ScheduleSource } from '../../scheduling'
import { TimeAxis } from '../TimeAxis'
import {
  buildGanttRows,
  GANTT_CHART_DEFAULT_PX_PER_DAY,
  GANTT_MIN_ROW_HEIGHT,
  GANTT_REGULAR_WIDTH,
} from '../types'
import type { GanttChartHandle, GanttChartProps, GanttRowModel } from '../types'
import { FrozenTitleColumn } from './components/FrozenTitleColumn'
import { GanttRow } from './components/GanttRow'
import { useGanttHScroll } from './hooks/useGanttHScroll'
import { usePinchZoom } from './hooks/usePinchZoom'
import { GlassView, liquidGlassAvailable } from './optionalDeps'
import { createStyles } from './styles'
import { computeWeekendStripes } from './utils'

// Animated wrapper keeps the native-driver Animated.event scroll mapping;
// the cast preserves FlatList's generic prop typing for TSX.
const AnimatedFlatList = Animated.FlatList as unknown as typeof FlatList

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

  // ── Shared scroll refs (read by the hScroll + pinch machinery) ────────
  const scrollXRef = useRef(0)
  const hScrollRef = useRef<ScrollView>(null)
  const timelineWidthRef = useRef(0)

  // ── Viewport ─────────────────────────────────────────────────────────
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport
  const showGrips = viewport.w >= GANTT_REGULAR_WIDTH

  const handleRootLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setViewport((v) => (v.w === width && v.h === height ? v : { w: width, h: height }))
  }, [])

  // ── Drag lock (kanban scroll-locking) + stable injection callbacks ───
  const [dragLock, setDragLock] = useState(false)
  const dragLockRef = useRef(dragLock)
  dragLockRef.current = dragLock
  const handleDragStateChange = useCallback((dragging: boolean) => {
    setDragLock(dragging)
  }, [])

  // ── Pinch-to-zoom (two-finger, focal-point anchored) ──────────────────
  const {
    pinchActive,
    pinchScaleX,
    pinchTranslateX,
    pinchResponder,
    pendingZoomScrollXRef,
  } = usePinchZoom({
    px,
    pxRef,
    scrollXRef,
    timelineWidthRef,
    dragLockRef,
    onPxPerDayChange,
  })

  // ── Horizontal time-window machinery (infinite X axis + scroll handlers)
  const {
    window,
    scale,
    totalDays,
    timelineWidth,
    handleHScroll,
    handleContentSizeChange,
    scrollToToday,
  } = useGanttHScroll({
    rows,
    todayKey,
    px,
    viewport,
    scrollXRef,
    hScrollRef,
    timelineWidthRef,
    viewportRef,
    pendingZoomScrollXRef,
  })

  useImperativeHandle(handleRef, () => ({ scrollToToday }), [scrollToToday])

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
  const weekendStripes = useMemo(
    () => computeWeekendStripes(window.startKey, totalDays, px),
    [window.startKey, totalDays, px],
  )

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
        <FrozenTitleColumn
          rows={rows}
          styles={styles}
          colors={colors}
          dragLock={dragLock}
          titleTranslateY={titleTranslateY}
          onPressDoc={stablePressDoc}
        />
      ) : null}
    </View>
  )
})

GanttChart.displayName = 'GanttChart'
