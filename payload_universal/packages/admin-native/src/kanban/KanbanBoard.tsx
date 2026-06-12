/**
 * KanbanBoard — liquid-glass kanban board driven by a Payload select field.
 *
 * Injection-friendly core component (no expo-router, no data fetching): the
 * screen supplies already-filtered docs plus move/press callbacks and patches
 * the select via a local-first mutation in `onMoveCard`.
 *
 * Layout: horizontal ScrollView with column snapping (paging feel) over
 * KanbanColumn drop targets, each hosting a vertical FlatList of KanbanCards.
 *
 * Drag & drop — pure RN PanResponder, owned end-to-end by this board (the
 * codebase's proven gesture tier: BottomSheet, SwipeToDeleteRow, Toast).
 * RNGH/reanimated-dnd is deliberately NOT used here: its
 * Gesture.Pan().activateAfterLongPress() loses the native recognizer
 * arbitration to the column FlatLists nested inside the horizontal
 * ScrollView and never activates on device.
 *
 *  - ACTIVATION: long-press (~250ms) on a card's Pressable calls beginDrag —
 *    the board measures the card (measureInWindow), hides the in-tree card
 *    (layout space kept) and mounts the elevated overlay copy at its origin.
 *  - RESPONDER HANDOFF: the finger is already down and owned by the card's
 *    Pressable, so a responder mounted after the touch began would never
 *    receive it. The board root therefore carries a PERMANENT PanResponder
 *    whose onMoveShouldSetPanResponderCapture returns true ONLY while a drag
 *    is active: the first move after beginDrag is claimed in the capture
 *    phase (moves bubble through the board), the Pressable is terminated
 *    (grant runs before its onPressOut) and the board drives the overlay
 *    from grant-relative dx/dy. With no drag active every hook returns
 *    false — taps and scrolling are untouched.
 *  - PRESS DISAMBIGUATION (Telegram-style): tap → onPressCard; long-press
 *    released with < STATIC_PRESS_MAX_DIST of finger travel → onPreviewCard
 *    (a fully static release never produces a captured move, so it arrives
 *    via the Pressable's onPressOut; a sub-threshold wiggle arrives via the
 *    responder release — both funnel into finishDrag); long-press + move →
 *    drag.
 *  - HIT-TESTING: each KanbanColumn registers its container node; frames
 *    re-measure (measureInWindow) on drag start, board layout, board scroll
 *    settle and column scroll end. Release hit-tests the overlay card's
 *    CENTER against the frames → handleMove (same-column drops no-op); a
 *    miss springs the overlay home and restores the card.
 *  - AUTO-SCROLL: hovering near the board's left/right edge scrolls one
 *    column per cooldown tick; frames re-measure after the scroll settles.
 *  - SCROLL LOCKING: while a drag is active the horizontal ScrollView and
 *    every column FlatList set scrollEnabled=false so frames cannot drift
 *    under the gesture (programmatic auto-scroll still works).
 *  - The ellipsis "Move to <column>" menu remains the accessibility path for
 *    moves and hosts the explicit "Preview" entry. With no RNGH gesture tree
 *    on the board the SwiftUI Menu tier is allowed on cards again.
 *  - Screens must still NOT wrap cards in native long-press peek triggers
 *    (ScrollablePreview.Trigger): a raw UILongPressGestureRecognizer claims
 *    the press at the UIKit layer and the Pressable long-press that starts
 *    drag-or-peek never fires.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, ScrollView, StyleSheet, View } from 'react-native'

import { useListColors } from '../hooks/useListColors'
import { getDocumentTitle } from '../utils/schemaHelpers'
import { KanbanCard } from './KanbanCard'
import type { KanbanCardRow } from './KanbanCard'
import { KanbanColumn } from './KanbanColumn'
import {
  buildKanbanColumns,
  formatKanbanFieldValue,
  getKanbanColumnValue,
  humanizeFieldName,
  KANBAN_CARD_WIDTH,
  KANBAN_COLUMN_GAP,
  KANBAN_COLUMN_WIDTH,
} from './types'
import type { KanbanBoardProps, KanbanDoc, KanbanMoveTarget } from './types'

// Max finger travel (pt) for a long-press to count as STATIC (open preview)
// rather than a drag — Telegram-style press disambiguation.
const STATIC_PRESS_MAX_DIST = 8
/** Edge zone (pt) that triggers horizontal auto-scroll while dragging. */
const AUTO_SCROLL_EDGE = 56
/** Minimum gap (ms) between auto-scroll steps. */
const AUTO_SCROLL_COOLDOWN = 650
const SNAP_INTERVAL = KANBAN_COLUMN_WIDTH + KANBAN_COLUMN_GAP
/** Fallback card height (pt) until the pick-up measure resolves. */
const FALLBACK_CARD_HEIGHT = 80

/** A column container's window-space frame (drop target). */
type ColumnFrame = { x: number; y: number; width: number; height: number }

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  docs,
  statusField,
  columnOrder,
  columnColors,
  hiddenColumns,
  cardFields,
  fieldLabels,
  useAsTitle,
  onPressCard,
  onMoveCard,
  onPreviewCard,
  renderCard,
  loadingDocIds,
}) => {
  const { dark, colors } = useListColors()
  const styles = useMemo(() => createStyles(colors.background), [colors.background])

  // ── Columns + doc buckets ────────────────────────────────────────────
  const columns = useMemo(
    () => buildKanbanColumns(statusField, columnOrder, columnColors, hiddenColumns),
    [statusField, columnOrder, columnColors, hiddenColumns],
  )

  const optionValues = useMemo(
    () => new Set(statusField.options.map((o) => o.value)),
    [statusField.options],
  )

  const buckets = useMemo(() => {
    const map = new Map<string | null, KanbanDoc[]>()
    for (const col of columns) map.set(col.value, [])
    for (const doc of docs) {
      const value = getKanbanColumnValue(doc, statusField, optionValues)
      // Hidden columns have no bucket — their docs are dropped from the
      // board entirely (never shunted into the no-status column). Unknown/
      // empty values resolve to null and land in the trailing column when
      // it is visible.
      map.get(value)?.push(doc)
    }
    return map
  }, [docs, columns, statusField, optionValues])

  const colorByValue = useMemo(() => {
    const map = new Map<string | null, string>()
    for (const col of columns) map.set(col.value, col.color)
    return map
  }, [columns])

  const loadingSet = useMemo(() => new Set(loadingDocIds ?? []), [loadingDocIds])

  // ── Card content helpers ─────────────────────────────────────────────
  const buildRows = useCallback(
    (doc: KanbanDoc): KanbanCardRow[] =>
      (cardFields ?? [])
        .filter((name) => name !== statusField.name && name !== (useAsTitle ?? 'title'))
        .map((name) => ({
          key: name,
          label: fieldLabels?.[name] ?? humanizeFieldName(name),
          value: formatKanbanFieldValue(doc[name]),
        }))
        .filter((row) => row.value !== '—'),
    [cardFields, fieldLabels, statusField.name, useAsTitle],
  )

  const moveTargetsFor = useCallback(
    (currentValue: string | null): KanbanMoveTarget[] =>
      columns.map((col) => ({
        label: col.label,
        value: col.value,
        color: col.color,
        disabled: col.value === currentValue,
      })),
    [columns],
  )

  const handleMove = useCallback(
    (doc: KanbanDoc, toValue: string | null) => {
      const current = getKanbanColumnValue(doc, statusField, optionValues)
      if (current === toValue) return
      // The screen owns error surfacing (toast); never crash the board.
      try {
        void Promise.resolve(onMoveCard(doc, toValue)).catch(() => {})
      } catch {
        /* sync onMoveCard threw — swallow, screen state stays authoritative */
      }
    },
    [onMoveCard, statusField, optionValues],
  )

  // ── Drag state ───────────────────────────────────────────────────────
  // React state drives renders (scroll locks, gating, overlay, hover tint);
  // refs mirror everything the once-created PanResponder reads so its
  // closures never go stale (SwipeToDeleteRow/BottomSheet pattern).
  const [draggingDoc, setDraggingDoc] = useState<KanbanDoc | null>(null)
  const [overlayActive, setOverlayActive] = useState(false)
  // Hovered column while dragging: string | null = a column value (null is
  // the no-status column), undefined = hovering nothing.
  const [hoverValue, setHoverValue] = useState<string | null | undefined>(undefined)
  const hoverValueRef = useRef<string | null | undefined>(undefined)

  const dragActiveRef = useRef(false)
  /** True once the board PanResponder was granted the touch (a move was
   * captured) — gates the Pressable's termination-driven onPressOut. */
  const dragHandedOffRef = useRef(false)
  const dragDocRef = useRef<KanbanDoc | null>(null)
  /** Monotonic drag id — invalidates stale spring-back completions. */
  const dragSessionRef = useRef(0)
  const maxDragDistRef = useRef(0)
  /** Overlay pick-up origin in board coordinates (card's measured frame). */
  const overlayBaseRef = useRef({ x: 0, y: 0 })
  /** Latest overlay position in board coordinates (release hit-testing). */
  const overlayPosRef = useRef({ x: 0, y: 0 })
  const cardSizeRef = useRef({ width: KANBAN_CARD_WIDTH, height: FALLBACK_CARD_HEIGHT })
  const overlayXY = useRef(new Animated.ValueXY({ x: -10000, y: -10000 })).current

  const boardRef = useRef<View>(null)
  const boardOrigin = useRef({ x: 0, y: 0 })
  const boardWidthRef = useRef(0)
  const scrollRef = useRef<ScrollView>(null)
  const scrollXRef = useRef(0)
  const lastAutoScrollRef = useRef(0)

  // Latest screen callbacks for the stable drag closures.
  const callbacksRef = useRef({ onPreviewCard, handleMove })
  callbacksRef.current = { onPreviewCard, handleMove }

  // ── Column drop frames (board-owned hit-testing) ─────────────────────
  const columnNodesRef = useRef(new Map<string | null, View>())
  const columnFramesRef = useRef(new Map<string | null, ColumnFrame>())

  // Stable callback ref per column value: React detaches/reattaches a
  // callback ref whenever its IDENTITY changes, so an inline arrow would
  // fire ref(null) on every board re-render — including mid-drag — and wipe
  // the measured frames right before the release hit-test. One memoized
  // callback per value means refs only fire on real mount/unmount.
  const columnRefCallbacksRef = useRef(new Map<string | null, (node: View | null) => void>())
  const getColumnRefCallback = useCallback((value: string | null) => {
    let cb = columnRefCallbacksRef.current.get(value)
    if (!cb) {
      cb = (node: View | null) => {
        if (node) {
          columnNodesRef.current.set(value, node)
        } else {
          columnNodesRef.current.delete(value)
          columnFramesRef.current.delete(value)
        }
      }
      columnRefCallbacksRef.current.set(value, cb)
    }
    return cb
  }, [])

  const refreshColumnFrames = useCallback(() => {
    columnNodesRef.current.forEach((node, value) => {
      node.measureInWindow((x, y, width, height) => {
        columnFramesRef.current.set(value, { x, y, width, height })
      })
    })
  }, [])

  /** Hit-test the overlay card's CENTER (window coords) against the
   * registered column frames. */
  const hitTestCardCenter = useCallback((): { found: boolean; value: string | null } => {
    const pos = overlayPosRef.current
    const cx = boardOrigin.current.x + pos.x + cardSizeRef.current.width / 2
    const cy = boardOrigin.current.y + pos.y + cardSizeRef.current.height / 2
    let found = false
    let value: string | null = null
    columnFramesRef.current.forEach((frame, colValue) => {
      if (found) return
      if (
        cx >= frame.x &&
        cx <= frame.x + frame.width &&
        cy >= frame.y &&
        cy <= frame.y + frame.height
      ) {
        found = true
        value = colValue
      }
    })
    return { found, value }
  }, [])

  const updateHover = useCallback(() => {
    const hit = hitTestCardCenter()
    const next = hit.found ? hit.value : undefined
    if (hoverValueRef.current !== next) {
      hoverValueRef.current = next
      setHoverValue(next)
    }
  }, [hitTestCardCenter])

  // ── Drag lifecycle ───────────────────────────────────────────────────

  /** Long-press pick-up: measure the card, mount the overlay at its origin,
   * arm the board responder (capture flips on via dragActiveRef). */
  const beginDrag = useCallback(
    (doc: KanbanDoc, node: View) => {
      if (dragActiveRef.current) return
      dragSessionRef.current += 1
      dragActiveRef.current = true
      dragHandedOffRef.current = false
      maxDragDistRef.current = 0
      dragDocRef.current = doc
      overlayXY.stopAnimation()
      refreshColumnFrames()
      boardRef.current?.measureInWindow((bx, by, bw) => {
        boardOrigin.current = { x: bx, y: by }
        if (bw > 0) boardWidthRef.current = bw
        node.measureInWindow((cx, cy, cw, ch) => {
          // Drag may have ended (static release) before the measure resolved.
          if (!dragActiveRef.current || dragDocRef.current !== doc) return
          cardSizeRef.current = {
            width: cw > 0 ? cw : KANBAN_CARD_WIDTH,
            height: ch > 0 ? ch : FALLBACK_CARD_HEIGHT,
          }
          const base = { x: cx - boardOrigin.current.x, y: cy - boardOrigin.current.y }
          overlayBaseRef.current = base
          overlayPosRef.current = base
          overlayXY.setValue(base)
          // Overlay mounts at the card's origin; the in-tree card hides in
          // the same commit (hidden = overlayActive && dragging this card).
          setOverlayActive(true)
        })
      })
      // Locks the horizontal ScrollView + column FlatLists and gates presses.
      setDraggingDoc(doc)
    },
    [overlayXY, refreshColumnFrames],
  )

  /** End the active drag. `allowActions` is false when the OS terminated the
   * responder (alert, app switch) — restore visuals, fire nothing. */
  const finishDrag = useCallback(
    (allowActions: boolean) => {
      if (!dragActiveRef.current) return
      dragActiveRef.current = false
      dragHandedOffRef.current = false
      const doc = dragDocRef.current
      dragDocRef.current = null
      if (hoverValueRef.current !== undefined) {
        hoverValueRef.current = undefined
        setHoverValue(undefined)
      }

      const hideNow = () => {
        setOverlayActive(false)
        setDraggingDoc(null)
        overlayXY.setValue({ x: -10000, y: -10000 })
      }

      if (!doc || !allowActions) {
        hideNow()
        return
      }

      // Static long-press (released with < STATIC_PRESS_MAX_DIST of travel):
      // open the preview. The overlay still sits at the card's origin, so an
      // immediate swap back to the in-tree card is jump-free.
      if (maxDragDistRef.current < STATIC_PRESS_MAX_DIST) {
        hideNow()
        callbacksRef.current.onPreviewCard?.(doc)
        return
      }

      const hit = hitTestCardCenter()
      if (hit.found) {
        // Same-column drops no-op inside handleMove; the card simply
        // reappears in place.
        hideNow()
        callbacksRef.current.handleMove(doc, hit.value)
        return
      }

      // Released outside every column — spring the overlay home, then restore
      // the in-tree card. The session guard keeps a drag that starts during
      // the spring from being clobbered by this stale completion.
      const session = dragSessionRef.current
      Animated.spring(overlayXY, {
        toValue: overlayBaseRef.current,
        damping: 26,
        stiffness: 300,
        mass: 0.8,
        useNativeDriver: false, // JS-driven setValue tracking during the drag
      }).start(({ finished }) => {
        if (!finished || dragSessionRef.current !== session) return
        setOverlayActive(false)
        setDraggingDoc(null)
        overlayXY.setValue({ x: -10000, y: -10000 })
      })
    },
    [overlayXY, hitTestCardCenter],
  )

  /** Static-release path: the card Pressable's onPressOut fires while it is
   * still the responder (no move was ever captured — dragHandedOffRef stays
   * false), meaning the finger lifted without travel → preview. When the
   * board steals the responder, grant sets dragHandedOffRef BEFORE the
   * Pressable's termination-driven onPressOut, so this no-ops mid-drag. */
  const handleCardPressOut = useCallback(() => {
    if (!dragActiveRef.current || dragHandedOffRef.current) return
    finishDrag(true)
  }, [finishDrag])

  /** Edge-hover auto-scroll, one column per cooldown tick. The overlay is
   * positioned relative to the board root (not the ScrollView content), so
   * programmatic scrolls move columns under the stationary overlay — only
   * the column frames need re-measuring afterwards. */
  const maybeAutoScroll = useCallback(
    (overlayX: number) => {
      const boardWidth = boardWidthRef.current
      if (boardWidth <= 0) return
      const now = Date.now()
      if (now - lastAutoScrollRef.current < AUTO_SCROLL_COOLDOWN) return
      const cardCenterX = overlayX + cardSizeRef.current.width / 2
      let target: number | null = null
      if (cardCenterX > boardWidth - AUTO_SCROLL_EDGE) {
        target = scrollXRef.current + SNAP_INTERVAL
      } else if (cardCenterX < AUTO_SCROLL_EDGE && scrollXRef.current > 0) {
        target = Math.max(0, scrollXRef.current - SNAP_INTERVAL)
      }
      if (target != null) {
        lastAutoScrollRef.current = now
        scrollRef.current?.scrollTo({ x: target, animated: true })
        // onMomentumScrollEnd fires for animated scrollTo on iOS, but not on
        // all platforms — re-measure after the animation as a fallback, then
        // refresh the hover tint once the async measures land.
        setTimeout(() => {
          refreshColumnFrames()
          setTimeout(updateHover, 48)
        }, 420)
      }
    },
    [refreshColumnFrames, updateHover],
  )

  // ── Board-root PanResponder (permanent; armed by dragActiveRef) ──────
  // dx/dy reset to 0 at grant (PanResponder semantics), i.e. they measure
  // displacement from the hand-off point — overlay = pick-up base + (dx,dy).
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Never claim touch starts — taps, presses and scrolls stay native.
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        // Capture-phase move claim ONLY while a drag is active: the first
        // move after beginDrag transfers the touch from the card's Pressable
        // to the board (the FlatLists can't steal — they're scroll-locked
        // and we refuse termination below).
        onMoveShouldSetPanResponder: () => dragActiveRef.current,
        onMoveShouldSetPanResponderCapture: () => dragActiveRef.current,
        onPanResponderGrant: () => {
          dragHandedOffRef.current = true
        },
        onPanResponderMove: (_evt, gs) => {
          if (!dragActiveRef.current) return
          const travel = Math.max(Math.abs(gs.dx), Math.abs(gs.dy))
          if (travel > maxDragDistRef.current) maxDragDistRef.current = travel
          const x = overlayBaseRef.current.x + gs.dx
          const y = overlayBaseRef.current.y + gs.dy
          overlayPosRef.current = { x, y }
          overlayXY.setValue({ x, y })
          updateHover()
          maybeAutoScroll(x)
        },
        onPanResponderRelease: () => finishDrag(true),
        // Keep the gesture once claimed — nothing may pull the touch back
        // mid-drag.
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => finishDrag(false),
      }),
    [overlayXY, updateHover, maybeAutoScroll, finishDrag],
  )

  // ── Card renderer (board owns ALL card wiring) ───────────────────────
  const draggingId = draggingDoc ? String(draggingDoc.id) : null

  const renderCardForColumn = useCallback(
    (doc: KanbanDoc, columnValue: string | null) => {
      const id = String(doc.id)
      const defaultCard = (
        <KanbanCard
          doc={doc}
          title={getDocumentTitle(doc, useAsTitle)}
          rows={buildRows(doc)}
          accentColor={colorByValue.get(columnValue) ?? colors.textMuted}
          dimmed={loadingSet.has(id)}
          hidden={overlayActive && draggingId === id}
          gated={draggingId != null}
          onPress={() => {
            if (!dragActiveRef.current) onPressCard(doc)
          }}
          // Long-press owns drag-or-peek (Apple boards convention). Mid-move
          // cards can't pick up again.
          onDragStart={loadingSet.has(id) ? undefined : (node) => beginDrag(doc, node)}
          onDragPressOut={handleCardPressOut}
          moveTargets={moveTargetsFor(columnValue)}
          onMove={(toValue) => handleMove(doc, toValue)}
          onPreview={onPreviewCard ? () => onPreviewCard(doc) : undefined}
        />
      )
      return renderCard ? renderCard(doc, defaultCard) : defaultCard
    },
    [
      useAsTitle,
      buildRows,
      colorByValue,
      colors.textMuted,
      loadingSet,
      overlayActive,
      draggingId,
      onPressCard,
      onPreviewCard,
      moveTargetsFor,
      handleMove,
      beginDrag,
      handleCardPressOut,
      renderCard,
    ],
  )

  // FlatList re-render trigger for per-card state that lives outside items.
  const columnExtraData = useMemo(
    () => ({ draggingId, overlayActive, loadingSet, dark, cardFields }),
    [draggingId, overlayActive, loadingSet, dark, cardFields],
  )

  // ── Drag overlay copy ────────────────────────────────────────────────
  const overlay =
    draggingDoc && overlayActive ? (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.overlay,
          { width: KANBAN_CARD_WIDTH, transform: overlayXY.getTranslateTransform() },
        ]}
      >
        <KanbanCard
          overlay
          doc={draggingDoc}
          title={getDocumentTitle(draggingDoc, useAsTitle)}
          rows={buildRows(draggingDoc)}
          accentColor={
            colorByValue.get(getKanbanColumnValue(draggingDoc, statusField, optionValues)) ??
            colors.textMuted
          }
        />
      </Animated.View>
    ) : null

  return (
    <View
      ref={boardRef}
      style={styles.board}
      onLayout={(e) => {
        boardWidthRef.current = e.nativeEvent.layout.width
        refreshColumnFrames()
      }}
      {...panResponder.panHandlers}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        // Lock user scrolling mid-drag (programmatic auto-scroll still works)
        // so drop-frame page coordinates can't drift under the gesture.
        scrollEnabled={draggingId == null}
        onScroll={(e) => {
          scrollXRef.current = e.nativeEvent.contentOffset.x
        }}
        scrollEventThrottle={32}
        onMomentumScrollEnd={refreshColumnFrames}
        onScrollEndDrag={refreshColumnFrames}
      >
        {columns.map((col) => (
          <KanbanColumn
            key={col.value ?? '__no_status__'}
            column={col}
            docs={buckets.get(col.value) ?? []}
            renderCardItem={(doc) => renderCardForColumn(doc, col.value)}
            registerContainer={getColumnRefCallback(col.value)}
            isDropTarget={overlayActive && hoverValue === col.value}
            scrollEnabled={draggingId == null}
            onScrollEnd={refreshColumnFrames}
            extraData={columnExtraData}
          />
        ))}
      </ScrollView>
      {overlay}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (background: string) =>
  StyleSheet.create({
    board: { flex: 1, backgroundColor: background },
    scrollContent: {
      // Leading padding matches the inter-column gap so snapToInterval
      // (width + gap) lands each column flush at the same inset.
      paddingHorizontal: KANBAN_COLUMN_GAP,
      paddingVertical: 12,
      gap: KANBAN_COLUMN_GAP,
      alignItems: 'stretch',
    },
    overlay: {
      position: 'absolute',
      left: 0,
      top: 0,
      zIndex: 1000,
      elevation: 12,
    },
  })
