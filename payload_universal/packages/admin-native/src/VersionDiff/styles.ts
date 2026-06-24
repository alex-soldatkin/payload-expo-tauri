import { Platform, StyleSheet } from 'react-native'

import { defaultTheme as t } from '../theme'
import type { ListColorPalette } from '../hooks/useListColors'

export const createStyles = (c: ListColorPalette, dark: boolean) => {
  // Diff tints chosen to read on both light surfaces and dark glass
  const addColor = dark ? '#86efac' : '#15803d'
  const addBg = dark ? 'rgba(74,222,128,0.22)' : 'rgba(22,163,74,0.14)'
  const delColor = dark ? '#fca5a5' : '#b91c1c'
  const delBg = dark ? 'rgba(255,107,102,0.22)' : 'rgba(220,38,38,0.12)'
  const addSurface = dark ? 'rgba(74,222,128,0.10)' : '#f0fdf4'
  const addBorder = dark ? 'rgba(74,222,128,0.45)' : '#86efac'
  const delSurface = dark ? 'rgba(255,107,102,0.10)' : '#fef2f2'
  const delBorder = dark ? 'rgba(255,107,102,0.45)' : '#fca5a5'
  const neutralSurface = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'

  return StyleSheet.create({
    container: { flex: 1 },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: t.spacing.sm,
      marginBottom: t.spacing.sm,
    },
    toggleLabel: {
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      fontWeight: '500',
    },

    // Field row
    diffRow: {
      paddingVertical: t.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    diffLabel: {
      fontSize: t.fontSize.sm,
      fontWeight: '700',
      color: c.text,
      marginBottom: t.spacing.sm,
    },

    // Old / new boxes
    diffValues: {
      flexDirection: 'row',
      gap: t.spacing.sm,
    },
    diffValuesVertical: {
      flexDirection: 'column',
      gap: t.spacing.sm,
    },
    diffOldBox: {
      flex: 1,
      backgroundColor: delSurface,
      borderLeftWidth: 3,
      borderLeftColor: delBorder,
      padding: t.spacing.sm,
      borderRadius: 4,
    },
    diffNewBox: {
      flex: 1,
      backgroundColor: addSurface,
      borderLeftWidth: 3,
      borderLeftColor: addBorder,
      padding: t.spacing.sm,
      borderRadius: 4,
    },
    diffBoxFullWidth: {
      flex: undefined,
    },
    diffValueText: {
      fontSize: t.fontSize.sm,
      color: c.text,
    },
    diffValueMono: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: t.fontSize.xs,
    },
    delPlainText: {
      textDecorationLine: 'line-through',
      color: c.textMuted,
    },

    // Inline word diff
    inlineDiffBox: {
      backgroundColor: neutralSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: t.borderRadius.sm,
      padding: t.spacing.sm,
    },
    addText: {
      backgroundColor: addBg,
      color: addColor,
      fontWeight: '600',
    },
    delText: {
      backgroundColor: delBg,
      color: delColor,
      textDecorationLine: 'line-through',
    },
    formattingOnlyNote: {
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      fontStyle: 'italic',
    },
    emptyDash: {
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },

    // Array / blocks rows
    rowsContainer: {
      gap: t.spacing.sm,
    },
    rowCard: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: t.borderRadius.sm,
      padding: t.spacing.sm,
      backgroundColor: neutralSurface,
    },
    rowCardAdded: {
      backgroundColor: addSurface,
      borderColor: addBorder,
    },
    rowCardRemoved: {
      backgroundColor: delSurface,
      borderColor: delBorder,
    },
    rowCardChanged: {},
    rowCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.spacing.sm,
      marginBottom: t.spacing.xs,
    },
    rowCardTitle: {
      flex: 1,
      fontSize: t.fontSize.sm,
      fontWeight: '600',
      color: c.text,
    },
    rowBadge: {
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 2,
      borderRadius: 4,
    },
    rowBadgeAdded: { backgroundColor: addBg },
    rowBadgeRemoved: { backgroundColor: delBg },
    rowBadgeChanged: { backgroundColor: c.warningBackground },
    rowBadgeText: {
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    rowBadgeTextAdded: { color: addColor },
    rowBadgeTextRemoved: { color: delColor },
    rowBadgeTextChanged: { color: c.warning },
    rowFieldLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.sm,
      paddingVertical: 2,
    },
    rowFieldLabel: {
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      color: c.textMuted,
      maxWidth: '40%',
    },
    rowFieldValue: {
      flex: 1,
      fontSize: t.fontSize.xs,
      color: c.text,
    },
    rowFieldValueRemoved: {
      textDecorationLine: 'line-through',
      color: c.textMuted,
    },
    rowsUnchangedNote: {
      fontSize: t.fontSize.xs,
      color: c.textMuted,
      fontStyle: 'italic',
    },
    nestedField: {
      marginTop: t.spacing.sm,
    },
    nestedFieldLabel: {
      fontSize: t.fontSize.xs,
      fontWeight: '700',
      color: c.text,
      marginBottom: 4,
    },

    // Locale sub-rows
    localeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.sm,
      marginBottom: t.spacing.sm,
    },
    localePill: {
      backgroundColor: c.pressed,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginTop: 2,
    },
    localePillText: {
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      color: c.textMuted,
    },
    localeBody: { flex: 1 },

    // Unchanged (collapsed) field row
    unchangedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
    },
    unchangedLabel: {
      flexShrink: 1,
      fontSize: t.fontSize.sm,
      fontWeight: '600',
      color: c.textMuted,
    },
    unchangedPill: {
      marginLeft: 'auto',
      backgroundColor: c.pressed,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    unchangedPillText: {
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      color: c.textMuted,
    },
    neutralBox: {
      marginTop: t.spacing.sm,
      backgroundColor: neutralSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: t.borderRadius.sm,
      padding: t.spacing.sm,
    },

    // Empty
    emptyState: {
      padding: t.spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      textAlign: 'center',
    },
  })
}
