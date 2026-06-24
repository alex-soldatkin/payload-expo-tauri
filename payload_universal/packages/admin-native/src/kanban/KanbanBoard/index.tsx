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
 * Drag & drop — pure RN PanResponder, owned end-to-end by this board via
 * useKanbanDrag (see that hook for the full gesture contract: long-press
 * pick-up, capture-phase responder handoff, Telegram-style press
 * disambiguation, center hit-testing, edge auto-scroll). RNGH/reanimated-dnd
 * is deliberately NOT used here.
 *
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
import React, { useCallback, useMemo } from 'react'
import { ScrollView, View } from 'react-native'

import { useListColors } from '../../hooks/useListColors'
import { getDocumentTitle } from '../../utils/schemaHelpers'
import { KanbanCard } from '../KanbanCard'
import type { KanbanCardRow } from '../KanbanCard'
import { KanbanColumn } from '../KanbanColumn'
import {
  buildKanbanColumns,
  formatKanbanFieldValue,
  getKanbanColumnValue,
  humanizeFieldName,
} from '../types'
import type { KanbanBoardProps, KanbanDoc, KanbanMoveTarget } from '../types'
import { DragOverlay } from './components/DragOverlay'
import { SNAP_INTERVAL } from './constants'
import { useKanbanDrag } from './hooks/useKanbanDrag'
import { createStyles } from './styles'

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

  // ── Drag machinery (board-owned PanResponder) ────────────────────────
  const {
    draggingDoc,
    overlayActive,
    hoverValue,
    overlayXY,
    boardRef,
    scrollRef,
    boardWidthRef,
    scrollXRef,
    dragActiveRef,
    panResponder,
    getColumnRefCallback,
    refreshColumnFrames,
    beginDrag,
    handleCardPressOut,
  } = useKanbanDrag({ onPreviewCard, handleMove })

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
      dragActiveRef,
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
      <DragOverlay
        doc={draggingDoc}
        title={getDocumentTitle(draggingDoc, useAsTitle)}
        rows={buildRows(draggingDoc)}
        accentColor={
          colorByValue.get(getKanbanColumnValue(draggingDoc, statusField, optionValues)) ??
          colors.textMuted
        }
        overlayXY={overlayXY}
        overlayStyle={styles.overlay}
      />
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
