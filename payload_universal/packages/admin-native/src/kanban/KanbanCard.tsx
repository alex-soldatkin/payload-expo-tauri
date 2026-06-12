/**
 * KanbanCard — a single board card.
 *
 * Liquid glass (GlassView isInteractive on iOS 26+) with a themed bordered
 * fallback; status-colour accent bar (3pt rounded) on the left; bold title;
 * label:value rows for the configured cardFields; ellipsis menu with an
 * optional "Preview" entry plus the "Move to <column>" targets.
 *
 * Gesture/menu rules (memory bank conventions):
 *  - When the card sits inside a react-native-reanimated-dnd Draggable
 *    (`insideDraggable`), @expo/ui SwiftUI components are FORBIDDEN in the
 *    subtree — the move menu uses the pure-JS ellipsis + BottomSheet tier
 *    (the Modal portals out of the gesture tree, so the sheet itself is safe).
 *  - When drag-drop is unavailable, the SwiftUI Menu tier renders (same
 *    pattern as RowActionsMenu in fields/structural/common.tsx) with the
 *    BottomSheet as the universal fallback.
 *  - `overlay` renders the elevated floating copy that follows the finger
 *    during a drag — solid card (no glass: it re-composites every frame),
 *    slight scale + tilt for the Apple pick-up feel, no interactivity.
 */
import React, { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { defaultTheme as t } from '../theme'
import { useListColors } from '../hooks/useListColors'
import type { ListColorPalette } from '../hooks/useListColors'
import { BottomSheet } from '../BottomSheet'
import { NativeHost } from '../fields/NativeHost'
import { nativeComponents } from '../fields/shared'
import { hexToRgba } from './types'
import type { KanbanDoc, KanbanMoveTarget } from './types'

// Optional: GlassView for liquid glass cards on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed */
}

// Optional: lucide icons for the ellipsis affordance + sheet rows (pure RN
// SVG — the only icon tier allowed inside reanimated-dnd Draggable trees)
let EllipsisIcon: React.ComponentType<{ size: number; color: string }> | null = null
let EyeIcon: React.ComponentType<{ size: number; color: string }> | null = null
try {
  const lucide = require('lucide-react-native')
  EllipsisIcon = lucide.Ellipsis ?? lucide.MoreHorizontal ?? null
  EyeIcon = lucide.Eye ?? null
} catch {
  /* lucide-react-native not available */
}

export type KanbanCardRow = { key: string; label: string; value: string }

export type KanbanCardProps = {
  doc: KanbanDoc
  title: string
  /** label:value rows below the title (already formatted). */
  rows: KanbanCardRow[]
  /** Column accent colour (left bar). */
  accentColor: string
  /** Mid-move (loadingDocIds) — renders dimmed. */
  dimmed?: boolean
  /**
   * Content invisible while the board's drag overlay follows the finger.
   * Layout space is kept so the column doesn't reflow under the drag.
   */
  hidden?: boolean
  /** Render as the floating drag overlay copy (elevated, non-interactive). */
  overlay?: boolean
  /** Suppress taps while any card on the board is dragging. */
  gated?: boolean
  onPress?: () => void
  /** Only wired when NOT inside a Draggable (drag owns long-press there). */
  onLongPress?: () => void
  /** "Move to <column>" targets — current column disabled. */
  moveTargets?: KanbanMoveTarget[]
  onMove?: (toValue: string | null) => void
  /**
   * Optional "Preview" entry above the move targets in the ellipsis menu —
   * the drag-safe preview path (long-press belongs to the drag gesture, so
   * cards never host native long-press peek triggers).
   */
  onPreview?: () => void
  /**
   * True when the card renders inside a reanimated-dnd Draggable — the
   * SwiftUI Menu tier is skipped (no @expo/ui inside drag trees).
   */
  insideDraggable?: boolean
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  title,
  rows,
  accentColor,
  dimmed,
  hidden,
  overlay,
  gated,
  onPress,
  onLongPress,
  moveTargets,
  onMove,
  onPreview,
  insideDraggable,
}) => {
  const { colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const inner = (
    <View style={styles.cardRow}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {!overlay && moveTargets && moveTargets.length > 0 && onMove ? (
            <MoveMenu
              targets={moveTargets}
              onMove={onMove}
              onPreview={onPreview}
              cardTitle={title}
              allowNative={!insideDraggable}
              colors={colors}
              styles={styles}
            />
          ) : null}
        </View>
        {rows.length > 0 && (
          <View style={styles.fieldRows}>
            {rows.map((row) => (
              <View key={row.key} style={styles.fieldRow}>
                <Text style={styles.fieldLabel} numberOfLines={1}>
                  {row.label}
                </Text>
                <Text style={styles.fieldValue} numberOfLines={1}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )

  // Overlay copy: solid elevated card (glass re-composites every frame —
  // too heavy under a per-frame transform), slight scale + tilt.
  if (overlay) {
    return <View style={[styles.card, styles.cardFallback, styles.cardOverlay]}>{inner}</View>
  }

  const card =
    liquidGlassAvailable && GlassView ? (
      <GlassView style={styles.card} isInteractive glassEffectStyle="regular">
        {inner}
      </GlassView>
    ) : (
      <View style={[styles.card, styles.cardFallback]}>{inner}</View>
    )

  return (
    <Pressable
      onPress={gated ? undefined : onPress}
      onLongPress={!insideDraggable && onLongPress ? onLongPress : undefined}
      style={({ pressed }) => [
        dimmed && styles.dimmed,
        hidden && styles.hiddenCard,
        pressed && !gated && styles.pressed,
      ]}
    >
      {card}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Move menu — SwiftUI Menu tier (outside drag trees only) with a pure-JS
// ellipsis + BottomSheet fallback (same tiering as RowActionsMenu).
// ---------------------------------------------------------------------------

function MoveMenu({
  targets,
  onMove,
  onPreview,
  cardTitle,
  allowNative,
  colors,
  styles,
}: {
  targets: KanbanMoveTarget[]
  onMove: (toValue: string | null) => void
  /** Optional "Preview" entry above the move targets. */
  onPreview?: () => void
  cardTitle: string
  /** False inside Draggable trees — never mount @expo/ui there. */
  allowNative: boolean
  colors: ListColorPalette
  styles: ReturnType<typeof createStyles>
}) {
  const [sheetVisible, setSheetVisible] = useState(false)

  // Tier 1 — SwiftUI Menu (registry-gated; null on Android / Expo Go).
  const Menu = nativeComponents.Menu
  const NativeButton = nativeComponents.Button
  const disabledMod = nativeComponents.disabled
  const tintMod = nativeComponents.tint
  if (allowNative && Menu && NativeButton) {
    // Disabled entries grey out via the `disabled` modifier; when the factory
    // is missing they are omitted instead (never render tappable no-ops).
    const visible = targets.filter((tg) => !tg.disabled || disabledMod)
    return (
      <NativeHost matchContents>
        <Menu
          label=""
          systemImage="ellipsis.circle"
          modifiers={tintMod ? [tintMod(colors.textMuted)] : undefined}
        >
          {onPreview ? (
            <NativeButton label="Preview" systemImage="eye" onPress={onPreview} />
          ) : null}
          {visible.map((tg) => (
            <NativeButton
              key={tg.value ?? '__no_status__'}
              label={`Move to ${tg.label}`}
              systemImage="arrow.right.circle"
              onPress={tg.disabled ? undefined : () => onMove(tg.value)}
              modifiers={tg.disabled && disabledMod ? [disabledMod(true)] : undefined}
            />
          ))}
        </Menu>
      </NativeHost>
    )
  }

  // Tier 2 — pure JS: lucide ellipsis opens the package BottomSheet. The
  // sheet is a Modal (separate native layer), so it is safe to trigger from
  // inside a Draggable tree.
  const rowCount = targets.length + (onPreview ? 1 : 0)
  const sheetHeight = Math.min(0.6, (rowCount * 52 + 120) / 800)
  return (
    <>
      <Pressable onPress={() => setSheetVisible(true)} hitSlop={10} style={styles.ellipsisBtn}>
        {EllipsisIcon ? (
          <EllipsisIcon size={16} color={colors.textMuted} />
        ) : (
          <Text style={styles.ellipsisText}>{'⋯'}</Text>
        )}
      </Pressable>
      <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} height={sheetHeight}>
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {cardTitle}
        </Text>
        {onPreview ? (
          <Pressable
            style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
            onPress={() => {
              setSheetVisible(false)
              // This sheet and the screen's preview surface are both RN
              // Modals — presenting one while the other dismisses races on
              // iOS, so let this Modal fully tear down first.
              setTimeout(onPreview, 350)
            }}
          >
            {EyeIcon ? (
              <EyeIcon size={16} color={colors.textMuted} />
            ) : (
              <View style={[styles.sheetDot, { backgroundColor: colors.textMuted }]} />
            )}
            <Text style={styles.sheetRowLabel}>Preview</Text>
          </Pressable>
        ) : null}
        {targets.map((tg) => (
          <Pressable
            key={tg.value ?? '__no_status__'}
            disabled={tg.disabled}
            style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
            onPress={() => {
              setSheetVisible(false)
              onMove(tg.value)
            }}
          >
            <View style={[styles.sheetDot, { backgroundColor: tg.color }]} />
            <Text style={[styles.sheetRowLabel, tg.disabled && styles.sheetRowLabelDisabled]}>
              {`Move to ${tg.label}`}
            </Text>
            {tg.disabled && <Text style={styles.sheetCurrent}>Current</Text>}
          </Pressable>
        ))}
      </BottomSheet>
    </>
  )
}

// ---------------------------------------------------------------------------
// Styles — built from the dark-mode aware palette (zero hardcoded light)
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    card: {
      borderRadius: 14,
      overflow: 'hidden',
    },
    cardFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    cardOverlay: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 10,
      transform: [{ scale: 1.04 }, { rotate: '1.5deg' }],
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingVertical: 10,
      paddingLeft: 10,
      paddingRight: 12,
      gap: 10,
    },
    accentBar: {
      width: 3,
      borderRadius: 1.5,
      alignSelf: 'stretch',
    },
    cardBody: { flex: 1, minWidth: 0 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 6,
    },
    title: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: c.text,
    },

    fieldRows: { marginTop: 6, gap: 3 },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
    },
    fieldLabel: { fontSize: 11, color: c.textMuted, flexShrink: 0 },
    fieldValue: {
      fontSize: 12,
      color: c.text,
      fontWeight: '500',
      flexShrink: 1,
      textAlign: 'right',
    },

    dimmed: { opacity: 0.4 },
    hiddenCard: { opacity: 0 },
    pressed: { opacity: 0.7 },

    // Ellipsis (JS tier)
    ellipsisBtn: { paddingLeft: 2, paddingTop: 1 },
    ellipsisText: { fontSize: 16, fontWeight: '700', color: c.textMuted, lineHeight: 18 },

    // Move sheet
    sheetTitle: {
      fontSize: t.fontSize.lg,
      fontWeight: '700',
      color: c.text,
      marginBottom: t.spacing.md,
    },
    sheetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.sm,
      borderRadius: t.borderRadius.sm,
    },
    sheetRowPressed: { backgroundColor: c.pressed },
    sheetDot: { width: 10, height: 10, borderRadius: 5 },
    sheetRowLabel: { flex: 1, fontSize: t.fontSize.md, fontWeight: '500', color: c.text },
    sheetRowLabelDisabled: { color: c.textPlaceholder },
    sheetCurrent: { fontSize: t.fontSize.xs, color: c.textMuted },
  })
