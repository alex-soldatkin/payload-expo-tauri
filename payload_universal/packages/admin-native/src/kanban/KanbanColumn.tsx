/**
 * KanbanColumn — one status column.
 *
 * Glass header (colour dot + label + count badge) over a vertical FlatList
 * of cards, the whole column subtly tinted with a very low-alpha wash of its
 * status colour (glass stays primary). When the board passes a reanimated-dnd
 * Droppable, the entire column registers as a drop target and brightens its
 * tint while a card hovers over it.
 *
 * The board owns all card wiring (Draggable wrapper, menus, callbacks) and
 * injects fully-built elements via `renderCardItem` — this component never
 * touches @expo/ui or the dnd library directly beyond the injected Droppable.
 */
import React, { useMemo } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'

import { defaultTheme as t } from '../theme'
import { useListColors } from '../hooks/useListColors'
import type { ListColorPalette } from '../hooks/useListColors'
import { hexToRgba, KANBAN_COLUMN_PADDING, KANBAN_COLUMN_WIDTH } from './types'
import type { KanbanColumnSpec, KanbanDoc } from './types'

// Optional: GlassView for the liquid glass column header on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed */
}

// Optional: lucide icon for the empty state (pure RN SVG — safe everywhere)
let InboxIcon: React.ComponentType<{ size: number; color: string }> | null = null
try {
  const lucide = require('lucide-react-native')
  InboxIcon = lucide.Inbox ?? null
} catch {
  /* lucide-react-native not available */
}

export type KanbanColumnProps = {
  column: KanbanColumnSpec
  docs: KanbanDoc[]
  /** Board-built card element (includes Draggable wiring when available). */
  renderCardItem: (doc: KanbanDoc, index: number) => React.ReactElement
  /**
   * reanimated-dnd Droppable component injected by the board (null → plain
   * View, column is not a drop target).
   */
  DroppableComponent?: React.ComponentType<any> | null
  /** Called when a dragged doc is released over this column. */
  onDropDoc?: (doc: KanbanDoc) => void
  /** Notify the board to re-measure drop targets after inner scrolls. */
  onScrollEnd?: () => void
  /** Re-render trigger for the inner FlatList (drag/dim/palette changes). */
  extraData?: unknown
  width?: number
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  docs,
  renderCardItem,
  DroppableComponent,
  onDropDoc,
  onScrollEnd,
  extraData,
  width = KANBAN_COLUMN_WIDTH,
}) => {
  const { dark, colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  // Very low-alpha tint so the glass surfaces stay primary.
  const tint = hexToRgba(column.color, dark ? 0.12 : 0.07)
  const tintBorder = hexToRgba(column.color, dark ? 0.28 : 0.16)
  const activeTint = hexToRgba(column.color, dark ? 0.26 : 0.16)
  const activeBorder = hexToRgba(column.color, 0.6)
  const badgeBg = hexToRgba(column.color, dark ? 0.32 : 0.16)

  const headerInner = (
    <>
      <View style={[styles.dot, { backgroundColor: column.color }]} />
      <Text style={styles.headerLabel} numberOfLines={1}>
        {column.label}
      </Text>
      <View style={[styles.countBadge, { backgroundColor: badgeBg }]}>
        <Text style={styles.countText}>{docs.length}</Text>
      </View>
    </>
  )

  const header =
    liquidGlassAvailable && GlassView ? (
      <GlassView style={styles.header} glassEffectStyle="regular">
        {headerInner}
      </GlassView>
    ) : (
      <View style={[styles.header, styles.headerFallback]}>{headerInner}</View>
    )

  const body = (
    <FlatList
      data={docs}
      keyExtractor={(item) => String((item as KanbanDoc).id)}
      renderItem={({ item, index }) => renderCardItem(item as KanbanDoc, index)}
      extraData={extraData}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      onMomentumScrollEnd={onScrollEnd}
      onScrollEndDrag={onScrollEnd}
      style={styles.list}
      ListEmptyComponent={
        <View style={[styles.empty, { borderColor: tintBorder }]}>
          {InboxIcon ? <InboxIcon size={20} color={colors.textMuted} /> : null}
          <Text style={styles.emptyText}>No cards</Text>
        </View>
      }
    />
  )

  const containerStyle = [
    styles.column,
    { width, backgroundColor: tint, borderColor: tintBorder },
  ]
  const inner = (
    <>
      {header}
      {body}
    </>
  )

  if (DroppableComponent && onDropDoc) {
    return (
      <DroppableComponent
        droppableId={`kanban-${column.value ?? '__no_status__'}`}
        onDrop={onDropDoc}
        capacity={Number.MAX_SAFE_INTEGER}
        style={containerStyle}
        activeStyle={{ backgroundColor: activeTint, borderColor: activeBorder }}
      >
        {inner}
      </DroppableComponent>
    )
  }
  return <View style={containerStyle}>{inner}</View>
}

// ---------------------------------------------------------------------------
// Styles — layout + dark-mode aware palette
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    column: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      padding: KANBAN_COLUMN_PADDING,
      // NO overflow:'hidden' — drop highlight + glass corners are safe, and
      // clipped corners would shear the header glass shadow on iOS.
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: t.spacing.md,
      marginBottom: t.spacing.sm,
      overflow: 'hidden',
    },
    headerFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    headerLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: c.text,
    },
    countBadge: {
      minWidth: 24,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countText: { fontSize: 11, fontWeight: '700', color: c.text },

    list: { flex: 1 },
    listContent: { paddingBottom: 6, gap: t.spacing.sm },

    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: t.spacing.xl,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
    },
    emptyText: { fontSize: t.fontSize.sm, color: c.textMuted },
  })
