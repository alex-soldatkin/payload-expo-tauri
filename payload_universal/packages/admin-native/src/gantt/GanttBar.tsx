/**
 * GanttBar — one event bar (or point diamond) on a gantt row track, owning
 * its own editing gestures end-to-end.
 *
 * Gesture design (Phase 29 memory-bank conventions — PanResponder ONLY; the
 * bar lives inside a vertical FlatList inside a horizontal ScrollView where
 * RNGH/reanimated-dnd pan never activates on device):
 *
 *  - HANDLE RESIZE: the left/right ends carry ≈20pt dedicated drag zones
 *    (children of the body Pressable, so taps on them still bubble to the
 *    press). Their PanResponders claim clearly HORIZONTAL moves only
 *    (|dx| > 1.4·|dy|) so vertical list scrolling over a handle keeps
 *    working, then refuse termination — once claimed, nothing pulls the
 *    touch back. No long-press is required: handles are dedicated zones.
 *  - BODY SHIFT: requires a ~200ms hold-then-move (the kanban activation
 *    pattern) to avoid scroll conflicts. The Pressable's onLongPress ARMS
 *    the drag (armedRef) and the bar ROOT's permanent PanResponder claims
 *    the very next move in the CAPTURE phase — the finger is already down
 *    and owned by the Pressable, so a responder mounted later could never
 *    receive it; capture-phase stealing from an ancestor is the proven
 *    hand-off (kanban board). Grant marks the hand-off BEFORE the
 *    Pressable's termination-driven onPressOut runs.
 *  - PEEK: an armed hold released with < 8pt of travel is a STATIC press →
 *    onPreview (a fully static release never produces a captured move, so it
 *    arrives via onPressOut; a sub-threshold wiggle arrives via the
 *    responder release — both funnel into finishDrag, which is IDEMPOTENT
 *    via an early-return active flag because the two release paths can race).
 *  - Tap → onPress (Pressability suppresses onPress after a fired
 *    long-press, so the paths are mutually exclusive).
 *
 * While any drag is active the bar reports onDragStateChange(true) and the
 * chart locks BOTH ancestors' scrolling (horizontal ScrollView + FlatList),
 * exactly like the kanban board — frames cannot drift under the gesture.
 *
 * Live feedback: the bar re-renders DAY-SNAPPED (at most one re-render per
 * crossed day column — Math.round(dx / pxPerDay)), a dashed ghost marks the
 * original extent and a tooltip above shows the snapped target dates. On
 * release the bar fires onCommit ONCE with the next ISO range; spring-back
 * on failure is the screen's job (bars derive purely from docs).
 *
 * Colours via useListColors only; the bar surface is a source-colour tint
 * (glass per-bar would re-composite dozens of GlassViews every frame — the
 * chart reserves real glass for the header band and the title column).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import type { PanResponderGestureState } from 'react-native'

import { useListColors } from '../hooks/useListColors'
import type { ListColorPalette } from '../hooks/useListColors'
import { hexToRgba } from '../kanban/types'
import { addDaysToKey, parseDateKey } from '../scheduling'
import {
  computeNextRange,
  GANTT_BAR_HEIGHT,
  GANTT_BAR_MIN_TITLE_WIDTH,
  GANTT_BODY_HOLD_MS,
  GANTT_HANDLE_WIDTH,
  GANTT_POINT_SIZE,
  GANTT_STATIC_PRESS_MAX_DIST,
  GANTT_TRAILING_LABEL_MAX_WIDTH,
  GANTT_TRAILING_LABEL_MIN_SPACE,
} from './types'
import type { GanttBarSpec, GanttDragMode } from './types'

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

/** Tooltip pill width (centered over the live bar). */
const TOOLTIP_WIDTH = 156

/** 'Jun 12' per device locale, from a 'YYYY-MM-DD' key. */
const fmtDayKey = (key: string): string => {
  const d = parseDateKey(key)
  if (!d) return key
  try {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return key
  }
}

type SnapState = { mode: GanttDragMode; delta: number } | null

export const GanttBar: React.FC<GanttBarProps> = ({
  bar,
  x,
  y,
  width,
  pxPerDay,
  readOnly,
  gated,
  showGrips,
  trailingSpace,
  onPress,
  onPreview,
  onCommit,
  onDragStateChange,
}) => {
  const { dark, colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  // Day-snapped drag state — drives the live bar geometry, the ghost and the
  // tooltip. Updated at most once per crossed day column.
  const [snap, setSnap] = useState<SnapState>(null)

  // Refs mirror everything the once-created PanResponders read so their
  // closures never go stale (the kanban/SwipeToDeleteRow pattern).
  const activeRef = useRef(false) // a drag session is live (idempotency gate)
  const modeRef = useRef<GanttDragMode | null>(null)
  const snapDeltaRef = useRef(0)
  const maxTravelRef = useRef(0)
  const armedRef = useRef(false) // body hold fired, waiting for capture/release
  const handedOffRef = useRef(false) // root responder was granted the touch

  // Latest props for the stable drag closures.
  const propsRef = useRef({
    bar,
    pxPerDay,
    readOnly: Boolean(readOnly),
    gated: Boolean(gated),
    onPress,
    onPreview,
    onCommit,
    onDragStateChange,
  })
  propsRef.current = {
    bar,
    pxPerDay,
    readOnly: Boolean(readOnly),
    gated: Boolean(gated),
    onPress,
    onPreview,
    onCommit,
    onDragStateChange,
  }

  // ── Drag lifecycle ───────────────────────────────────────────────────

  const beginDrag = useCallback((mode: GanttDragMode) => {
    if (activeRef.current) return
    activeRef.current = true
    modeRef.current = mode
    snapDeltaRef.current = 0
    maxTravelRef.current = 0
    setSnap({ mode, delta: 0 })
    // Locks the horizontal ScrollView + the rows FlatList via the chart.
    propsRef.current.onDragStateChange(true)
  }, [])

  const moveDrag = useCallback((gs: PanResponderGestureState) => {
    const mode = modeRef.current
    if (!activeRef.current || !mode) return
    const travel = Math.max(Math.abs(gs.dx), Math.abs(gs.dy))
    if (travel > maxTravelRef.current) maxTravelRef.current = travel
    const { pxPerDay: px, bar: spec } = propsRef.current
    // Day snapping: whole columns from the grant point.
    let delta = Math.round(gs.dx / px)
    // Resizes may never invert the range — keep >= 1 day.
    if (mode === 'left') delta = Math.min(delta, spec.spanDays - 1)
    if (mode === 'right') delta = Math.max(delta, -(spec.spanDays - 1))
    if (delta !== snapDeltaRef.current) {
      snapDeltaRef.current = delta
      setSnap({ mode, delta })
    }
  }, [])

  /**
   * End the active drag. IDEMPOTENT by design (early-return flag): the
   * responder release, the responder terminate and the Pressable's
   * static-release onPressOut can race — only the first caller acts.
   * `allowAction` is false when the OS terminated the responder.
   */
  const finishDrag = useCallback((allowAction: boolean) => {
    if (!activeRef.current) return
    activeRef.current = false
    const mode = modeRef.current
    modeRef.current = null
    armedRef.current = false
    handedOffRef.current = false
    const delta = snapDeltaRef.current
    snapDeltaRef.current = 0
    setSnap(null)
    const p = propsRef.current
    p.onDragStateChange(false)
    if (!allowAction || !mode) return
    // Static hold (kanban disambiguation): armed body press released with
    // < 8pt of travel → peek, never a shift.
    if (mode === 'body' && maxTravelRef.current < GANTT_STATIC_PRESS_MAX_DIST) {
      p.onPreview?.()
      return
    }
    if (delta === 0) return // snapped back to the origin — no patch
    const next = computeNextRange(p.bar.event, mode, delta)
    if (next) p.onCommit(next)
  }, [])

  /** Body long-press: arm the hold-then-move shift (and the static peek). */
  const armBodyDrag = useCallback(() => {
    const p = propsRef.current
    if (p.readOnly || p.gated || activeRef.current) return
    armedRef.current = true
    handedOffRef.current = false
    beginDrag('body')
  }, [beginDrag])

  /** Static-release path: the press lifted before any move was captured. */
  const handlePressOut = useCallback(() => {
    if (armedRef.current && !handedOffRef.current) finishDrag(true)
  }, [finishDrag])

  const handlePress = useCallback(() => {
    const p = propsRef.current
    if (activeRef.current || p.gated) return
    p.onPress()
  }, [])

  // ── Responders (created once; armed/gated via refs) ─────────────────

  // Bar-root responder: claims the FIRST move after a body long-press in the
  // CAPTURE phase (the hand-off from the already-responding Pressable). With
  // no armed hold every hook returns false — taps, handle drags and ancestor
  // scrolling are untouched.
  const bodyResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => armedRef.current,
        onMoveShouldSetPanResponderCapture: () => armedRef.current,
        onPanResponderGrant: () => {
          // Runs BEFORE the Pressable's termination-driven onPressOut, so the
          // static-release path no-ops once the drag owns the touch.
          handedOffRef.current = true
        },
        onPanResponderMove: (_evt, gs) => moveDrag(gs),
        onPanResponderRelease: () => finishDrag(true),
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => finishDrag(false),
      }),
    [moveDrag, finishDrag],
  )

  const makeEdgeResponder = useCallback(
    (mode: 'left' | 'right') =>
      PanResponder.create({
        // Taps on a handle bubble up to the body Pressable (handles are its
        // children) — only clearly horizontal MOVES claim the touch.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gs) => {
          const p = propsRef.current
          if (p.readOnly || p.gated || p.bar.point || activeRef.current) return false
          return Math.abs(gs.dx) > 2 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.4
        },
        onPanResponderGrant: () => beginDrag(mode),
        onPanResponderMove: (_evt, gs) => moveDrag(gs),
        onPanResponderRelease: () => finishDrag(true),
        // Keep the gesture once claimed — the ancestor ScrollView/FlatList
        // must not pull the touch back mid-resize.
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => finishDrag(false),
      }),
    [beginDrag, moveDrag, finishDrag],
  )
  const leftResponder = useMemo(() => makeEdgeResponder('left'), [makeEdgeResponder])
  const rightResponder = useMemo(() => makeEdgeResponder('right'), [makeEdgeResponder])

  // ── Live geometry (day-snapped) ──────────────────────────────────────

  const mode = snap?.mode ?? null
  const delta = snap?.delta ?? 0
  let liveX = x
  let liveWidth = width
  if (mode === 'body') {
    liveX = x + delta * pxPerDay
  } else if (mode === 'left') {
    liveX = x + delta * pxPerDay
    liveWidth = width - delta * pxPerDay
  } else if (mode === 'right') {
    liveWidth = width + delta * pxPerDay
  }

  const tooltipLabel = useMemo(() => {
    if (!snap) return ''
    const startKey = addDaysToKey(bar.startKey, snap.mode === 'right' ? 0 : snap.delta)
    const endKey = addDaysToKey(bar.endKey, snap.mode === 'left' ? 0 : snap.delta)
    return startKey === endKey
      ? fmtDayKey(startKey)
      : `${fmtDayKey(startKey)} – ${fmtDayKey(endKey)}`
  }, [snap, bar.startKey, bar.endKey])

  const color = bar.source.color
  // Narrow bars shrink their handles so a sliver of body stays tappable.
  const handleWidth = Math.max(8, Math.min(GANTT_HANDLE_WIDTH, liveWidth / 3))

  // Trailing title (G5): bars without an internal title (diamonds, slivers)
  // echo the doc title to the right when the lane run is free. Static only —
  // hidden while a drag is live (the live tooltip owns that feedback).
  const rootWidth = Math.max(liveWidth, GANTT_POINT_SIZE)
  const showsInnerTitle = !bar.point && width >= GANTT_BAR_MIN_TITLE_WIDTH
  const trailingRun = trailingSpace ?? 0
  const showTrailingTitle =
    !snap && !showsInnerTitle && trailingRun >= GANTT_TRAILING_LABEL_MIN_SPACE
  const trailingWidth = Math.min(trailingRun - 12, GANTT_TRAILING_LABEL_MAX_WIDTH)

  return (
    <View
      {...bodyResponder.panHandlers}
      style={[
        styles.barRoot,
        {
          left: liveX,
          top: y,
          width: Math.max(liveWidth, GANTT_POINT_SIZE),
          zIndex: snap ? 60 : 0,
        },
      ]}
    >
      {/* Ghost: dashed outline at the ORIGINAL extent while dragging
          (row-relative offset — the root has moved to the live position). */}
      {snap ? (
        <View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              left: x - liveX,
              width,
              borderColor: hexToRgba(color, 0.6),
              backgroundColor: hexToRgba(color, 0.1),
            },
          ]}
        />
      ) : null}
      <Pressable
        style={styles.pressable}
        onPress={handlePress}
        delayLongPress={GANTT_BODY_HOLD_MS}
        onLongPress={readOnly ? undefined : armBodyDrag}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`${bar.event.title}, ${bar.source.label}`}
      >
        {bar.point ? (
          <View style={styles.pointWrap} pointerEvents="none">
            <View
              style={[
                styles.point,
                { backgroundColor: color },
                readOnly && styles.dimmed,
              ]}
            />
          </View>
        ) : (
          <View
            style={[
              styles.rect,
              {
                backgroundColor: hexToRgba(color, dark ? 0.34 : 0.18),
                borderColor: hexToRgba(color, 0.55),
              },
              snap != null && styles.rectLifted,
              readOnly && styles.dimmed,
            ]}
          >
            <View style={[styles.rectAccent, { backgroundColor: color }]} />
            {liveWidth >= GANTT_BAR_MIN_TITLE_WIDTH ? (
              <Text style={styles.rectTitle} numberOfLines={1}>
                {bar.event.title}
              </Text>
            ) : null}
          </View>
        )}
        {/* Dedicated resize zones — children of the Pressable so taps on
            them still open the doc; horizontal moves claim the responder. */}
        {!bar.point && !readOnly ? (
          <>
            <View
              {...leftResponder.panHandlers}
              style={[styles.handle, { width: handleWidth, left: -2 }]}
            >
              {showGrips ? (
                <View style={[styles.grip, { backgroundColor: hexToRgba(color, 0.9) }]} />
              ) : null}
            </View>
            <View
              {...rightResponder.panHandlers}
              style={[styles.handle, { width: handleWidth, right: -2 }]}
            >
              {showGrips ? (
                <View style={[styles.grip, { backgroundColor: hexToRgba(color, 0.9) }]} />
              ) : null}
            </View>
          </>
        ) : null}
      </Pressable>
      {/* Trailing doc title in the free run right of the diamond/bar end. */}
      {showTrailingTitle ? (
        <View
          pointerEvents="none"
          style={[styles.trailingLabelWrap, { left: rootWidth + 6, width: trailingWidth }]}
        >
          <Text style={styles.trailingLabel} numberOfLines={1}>
            {bar.event.title}
          </Text>
        </View>
      ) : null}
      {/* Snapped-dates tooltip above the live bar. */}
      {snap ? (
        <View
          pointerEvents="none"
          style={[styles.tooltip, { left: liveWidth / 2 - TOOLTIP_WIDTH / 2 }]}
        >
          <Text style={styles.tooltipText} numberOfLines={1}>
            {tooltipLabel}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    barRoot: {
      position: 'absolute',
      height: GANTT_BAR_HEIGHT,
    },
    // RN 0.85 removed StyleSheet.absoluteFillObject — inline the equivalent.
    pressable: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

    rect: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 7,
      borderWidth: StyleSheet.hairlineWidth,
      marginHorizontal: 1,
      overflow: 'hidden',
    },
    rectAccent: { width: 3, alignSelf: 'stretch' },
    rectTitle: {
      flexShrink: 1,
      paddingHorizontal: 6,
      fontSize: 11,
      fontWeight: '600',
      color: c.text,
    },
    rectLifted: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    },

    pointWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    point: {
      width: GANTT_POINT_SIZE,
      height: GANTT_POINT_SIZE,
      borderRadius: 3,
      transform: [{ rotate: '45deg' }],
    },

    handle: {
      position: 'absolute',
      top: -4,
      bottom: -4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grip: { width: 3, height: 12, borderRadius: 1.5 },

    ghost: {
      position: 'absolute',
      top: 0,
      height: GANTT_BAR_HEIGHT,
      borderRadius: 7,
      borderWidth: 1.5,
      borderStyle: 'dashed',
    },

    tooltip: {
      position: 'absolute',
      top: -(26 + 8),
      width: TOOLTIP_WIDTH,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 6,
    },
    tooltipText: { fontSize: 11, fontWeight: '600', color: c.text },

    trailingLabelWrap: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    trailingLabel: { fontSize: 12, fontWeight: '500', color: c.textMuted },

    dimmed: { opacity: 0.45 },
  })
