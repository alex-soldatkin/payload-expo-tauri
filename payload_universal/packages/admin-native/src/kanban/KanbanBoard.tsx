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
 * Drag & drop (react-native-reanimated-dnd v2, optional try/catch require —
 * the lib + worklets 0.7.x live in the APP, per the memory-bank
 * Drag-to-Reorder rules):
 *  - Cards wrap in Draggable with `preDragDelay` (long-press to drag — taps
 *    and column scrolling keep working) and columns register as Droppables.
 *  - Column FlatLists clip their content on iOS, so the in-tree card can't
 *    visually cross columns. The board therefore renders a DRAG OVERLAY: on
 *    the first onDragging tick the real card turns invisible (layout space
 *    kept) and an elevated copy follows the finger above the ScrollView.
 *    Collision math and the overlay share the same origin+translation
 *    coordinates, so hover/drop detection matches what the user sees.
 *  - Hovering near the board's left/right edge auto-scrolls one column per
 *    cooldown tick; drop targets re-measure after every scroll settles.
 *  - NEVER mount @expo/ui components inside the Draggable subtree (lucide
 *    icons only) — KanbanCard receives `insideDraggable` and downgrades its
 *    move menu to the JS BottomSheet tier accordingly.
 *  - Long-press belongs to the DRAG (Apple boards convention). Screens must
 *    not wrap cards in native long-press peek triggers (ScrollablePreview):
 *    the raw UILongPressGestureRecognizer claims the press at the UIKit
 *    layer and cancels the reanimated-dnd activation. Preview access goes
 *    through `onPreviewCard` (ellipsis-menu "Preview" entry) instead.
 *  - When the lib is unavailable the board degrades gracefully: cards move
 *    via the ellipsis "Move to <column>" menu (SwiftUI Menu tier allowed
 *    there) and `onLongPressCard` becomes the long-press owner.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Animated, ScrollView, StyleSheet, View } from 'react-native'

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

// ---------------------------------------------------------------------------
// Optional drag & drop — react-native-reanimated-dnd is installed in the APP
// (with react-native-worklets 0.7.x); the package must not hard-depend on it.
// ---------------------------------------------------------------------------

let DropProvider: any = null
let Draggable: any = null
let Droppable: any = null
try {
  const dnd = require('react-native-reanimated-dnd')
  DropProvider = dnd.DropProvider
  Draggable = dnd.Draggable
  Droppable = dnd.Droppable
} catch {
  /* drag-drop unavailable — the ellipsis "Move to" menu handles moves */
}
const dndAvailable = Boolean(DropProvider && Draggable && Droppable)

/** Long-press duration (ms) before a card drag activates. */
const PRE_DRAG_DELAY = 220
// Max finger travel (pt) for a long-press to count as STATIC (open preview)
// rather than a drag — Telegram-style press disambiguation.
const STATIC_PRESS_MAX_DIST = 8
/** Edge zone (pt) that triggers horizontal auto-scroll while dragging. */
const AUTO_SCROLL_EDGE = 56
/** Minimum gap (ms) between auto-scroll steps. */
const AUTO_SCROLL_COOLDOWN = 650
const SNAP_INTERVAL = KANBAN_COLUMN_WIDTH + KANBAN_COLUMN_GAP

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
  onLongPressCard,
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

  // ── Drag state + overlay (only used when dnd is available) ───────────
  const [draggingDoc, setDraggingDoc] = useState<KanbanDoc | null>(null)
  // Telegram-style long-press disambiguation: a STATIC long-press (released
  // with < STATIC_PRESS_MAX_DIST of finger travel) opens the card preview
  // instead of performing a drop. Travel is the max |tx|/|ty| translation
  // reported by the drag callbacks; the drop path is gated on the same
  // measurement so a sub-threshold release over the origin column can never
  // fire a move. previewFiredRef debounces double-firing if the lib delivers
  // dragEnd twice.
  const maxDragDistRef = useRef(0)
  const dragDocRef = useRef<KanbanDoc | null>(null)
  const previewFiredRef = useRef(false)
  // Overlay appears on the first movement tick so a stationary long-press
  // never blanks the real card before the copy is positioned.
  const [overlayActive, setOverlayActive] = useState(false)
  const overlayActiveRef = useRef(false)
  const draggingRef = useRef(false)
  const overlayXY = useRef(new Animated.ValueXY({ x: -10000, y: -10000 })).current

  const boardRef = useRef<View>(null)
  const boardOrigin = useRef({ x: 0, y: 0 })
  const boardWidthRef = useRef(0)
  const dropProviderRef = useRef<any>(null)
  const scrollRef = useRef<ScrollView>(null)
  const scrollXRef = useRef(0)
  const lastAutoScrollRef = useRef(0)

  const refreshDropTargets = useCallback(() => {
    dropProviderRef.current?.requestPositionUpdate?.()
  }, [])

  const handleDragStart = useCallback(
    (data: unknown) => {
      draggingRef.current = true
      overlayActiveRef.current = false
      maxDragDistRef.current = 0
      dragDocRef.current = data as KanbanDoc
      previewFiredRef.current = false
      overlayXY.setValue({ x: -10000, y: -10000 })
      boardRef.current?.measureInWindow((x, y, width) => {
        boardOrigin.current = { x, y }
        if (width > 0) boardWidthRef.current = width
      })
      setDraggingDoc(data as KanbanDoc)
    },
    [overlayXY],
  )

  const handleDragging = useCallback(
    (payload: { x: number; y: number; tx: number; ty: number }) => {
      if (!draggingRef.current) return
      const travel = Math.max(Math.abs(payload.tx), Math.abs(payload.ty))
      if (travel > maxDragDistRef.current) maxDragDistRef.current = travel
      const ox = payload.x + payload.tx - boardOrigin.current.x
      const oy = payload.y + payload.ty - boardOrigin.current.y
      overlayXY.setValue({ x: ox, y: oy })
      if (!overlayActiveRef.current) {
        overlayActiveRef.current = true
        setOverlayActive(true)
      }

      // Edge-hover auto-scroll, one column per cooldown tick. The overlay and
      // the lib's collision math share the same (origin + translation) space,
      // so they stay consistent through programmatic scrolls — drop targets
      // re-measure once the scroll settles (onMomentumScrollEnd + fallback).
      const boardWidth = boardWidthRef.current
      if (boardWidth <= 0) return
      const now = Date.now()
      if (now - lastAutoScrollRef.current < AUTO_SCROLL_COOLDOWN) return
      const cardCenterX = ox + KANBAN_CARD_WIDTH / 2
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
        // all platforms — refresh again after the animation as a fallback.
        setTimeout(refreshDropTargets, 420)
      }
    },
    [overlayXY, refreshDropTargets],
  )

  const handleDragEnd = useCallback(() => {
    draggingRef.current = false
    overlayActiveRef.current = false
    setOverlayActive(false)
    setDraggingDoc(null)
    // Static long-press (lifted, but released without meaningful travel):
    // open the preview. The lib's spring-back restores the card; the drop
    // path is separately gated on the same threshold below.
    const doc = dragDocRef.current
    dragDocRef.current = null
    if (
      doc &&
      onPreviewCard &&
      !previewFiredRef.current &&
      maxDragDistRef.current < STATIC_PRESS_MAX_DIST
    ) {
      previewFiredRef.current = true
      onPreviewCard(doc)
    }
  }, [onPreviewCard])

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
            if (!draggingRef.current) onPressCard(doc)
          }}
          onLongPress={onLongPressCard ? () => onLongPressCard(doc) : undefined}
          insideDraggable={dndAvailable}
          moveTargets={moveTargetsFor(columnValue)}
          onMove={(toValue) => handleMove(doc, toValue)}
          onPreview={onPreviewCard ? () => onPreviewCard(doc) : undefined}
        />
      )
      const cardEl = renderCard ? renderCard(doc, defaultCard) : defaultCard
      if (!dndAvailable) return cardEl
      return (
        <Draggable
          draggableId={`kanban-card-${id}`}
          data={doc}
          preDragDelay={PRE_DRAG_DELAY}
          collisionAlgorithm="center"
          dragDisabled={loadingSet.has(id)}
        >
          {cardEl}
        </Draggable>
      )
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
      onLongPressCard,
      onPreviewCard,
      moveTargetsFor,
      handleMove,
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
    dndAvailable && draggingDoc && overlayActive ? (
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

  const board = (
    <View
      ref={boardRef}
      style={styles.board}
      onLayout={(e) => {
        boardWidthRef.current = e.nativeEvent.layout.width
        refreshDropTargets()
      }}
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
        // so drop-target page coordinates can't drift under the gesture.
        scrollEnabled={draggingId == null}
        onScroll={(e) => {
          scrollXRef.current = e.nativeEvent.contentOffset.x
        }}
        scrollEventThrottle={32}
        onMomentumScrollEnd={refreshDropTargets}
        onScrollEndDrag={refreshDropTargets}
      >
        {columns.map((col) => (
          <KanbanColumn
            key={col.value ?? '__no_status__'}
            column={col}
            docs={buckets.get(col.value) ?? []}
            renderCardItem={(doc) => renderCardForColumn(doc, col.value)}
            DroppableComponent={dndAvailable ? Droppable : null}
            onDropDoc={
              dndAvailable
                ? (doc) => {
                    // Sub-threshold release = static long-press → preview
                    // (handled in handleDragEnd), never a move.
                    if (maxDragDistRef.current < STATIC_PRESS_MAX_DIST) return
                    handleMove(doc, col.value)
                  }
                : undefined
            }
            onScrollEnd={dndAvailable ? refreshDropTargets : undefined}
            extraData={columnExtraData}
          />
        ))}
      </ScrollView>
      {overlay}
    </View>
  )

  if (!dndAvailable) return board
  return (
    <DropProvider
      ref={dropProviderRef}
      onDragStart={handleDragStart}
      onDragging={handleDragging}
      onDragEnd={handleDragEnd}
    >
      {board}
    </DropProvider>
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
