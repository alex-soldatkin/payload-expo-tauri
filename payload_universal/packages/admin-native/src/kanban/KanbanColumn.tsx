/**
 * KanbanColumn — one status column.
 *
 * Glass header (colour dot + label + count badge) over a vertical FlatList
 * of cards, the whole column subtly tinted with a very low-alpha wash of its
 * status colour (glass stays primary).
 *
 * Drop-target plumbing is board-owned (PanResponder drag): the column hands
 * its container node to the board via `registerContainer` (the board
 * measures drop frames with measureInWindow), brightens its tint while the
 * dragged card hovers it (`isDropTarget`) and locks its FlatList while a
 * drag is active (`scrollEnabled`).
 *
 * The board owns all card wiring (drag activation, menus, callbacks) and
 * injects fully-built elements via `renderCardItem` — this component never
 * touches @expo/ui.
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
  /** Board-built card element (drag activation wiring included). */
  renderCardItem: (doc: KanbanDoc, index: number) => React.ReactElement
  /**
   * Callback ref for the column's container View — the board registers the
   * node and measures drop frames (measureInWindow) on drag start, board
   * layout and every scroll settle.
   */
  registerContainer?: (node: View | null) => void
  /** True while the dragged card hovers this column — brightens the tint. */
  isDropTarget?: boolean
  /**
   * False while a drag is active — locks the inner FlatList so drop frames
   * can't drift under the gesture. Defaults to true.
   */
  scrollEnabled?: boolean
  /** Notify the board to re-measure drop frames after inner scrolls. */
  onScrollEnd?: () => void
  /** Re-render trigger for the inner FlatList (drag/dim/palette changes). */
  extraData?: unknown
  width?: number
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  docs,
  renderCardItem,
  registerContainer,
  isDropTarget,
  scrollEnabled,
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
      scrollEnabled={scrollEnabled !== false}
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
    // Drop-hover highlight (board hit-tests the dragged card's center).
    isDropTarget && { backgroundColor: activeTint, borderColor: activeBorder },
  ]

  // collapsable={false}: the board measures this node (measureInWindow) for
  // drop hit-testing — never let the renderer flatten it away on Android.
  return (
    <View ref={registerContainer} collapsable={false} style={containerStyle}>
      {header}
      {body}
    </View>
  )
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
