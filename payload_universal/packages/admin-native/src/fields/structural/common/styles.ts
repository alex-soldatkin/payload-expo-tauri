// ---------------------------------------------------------------------------
// Shared styles (layout/spacing only — colours resolve via usePalette)
// ---------------------------------------------------------------------------
import { StyleSheet } from 'react-native'

import { CONTENT_INSET, defaultTheme as t, ROW_MIN_HEIGHT } from '../../../theme'

export const commonStyles = StyleSheet.create({
  widthRow: { flexDirection: 'row' as const, gap: t.spacing.md },

  // Nested field-list rows (SubFieldRows) — mirrors FormSection's row chrome:
  // the canonical inset + 44pt floor; separators between rows only.
  subRow: {
    paddingHorizontal: CONTENT_INSET,
    minHeight: ROW_MIN_HEIGHT,
    justifyContent: 'center',
  },
  subRowSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: CONTENT_INSET, // inset from left, flush on right
  },

  // Error badge (collapsible, tabs, array/block rows)
  errorBadge: {
    backgroundColor: t.colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: t.spacing.xs,
  },
  errorBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Segmented picker wrapper
  segmentedWrapper: { marginBottom: t.spacing.sm },

  // Pill tab bar
  pillScroll: { marginBottom: t.spacing.sm },
  pillBar: {
    flexDirection: 'row',
    borderRadius: 9,
    padding: 2,
    marginBottom: t.spacing.sm,
    gap: 1,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: t.spacing.sm,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  pillFlex: { flex: 1 },
  pillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  pillText: { fontSize: t.fontSize.sm, fontWeight: '500' },
  pillTextActive: { fontWeight: '600' },

  // Row actions
  ellipsisBtn: { paddingHorizontal: 4 },
  ellipsisText: { fontSize: 20, fontWeight: '700' },
  sheetTitle: { fontSize: t.fontSize.lg, fontWeight: '700', marginBottom: t.spacing.md },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
  },
  sheetRowLabel: { fontSize: t.fontSize.md, fontWeight: '500' },

  // Add button
  addBtnWrapper: { marginTop: t.spacing.sm, alignItems: 'center' as const },
  addBtn: { paddingVertical: t.spacing.sm, marginTop: t.spacing.xs, alignItems: 'center' as const },
  glassAddBtn: {
    paddingVertical: t.spacing.sm,
    marginTop: t.spacing.xs,
    borderRadius: t.borderRadius.sm,
    alignItems: 'center' as const,
  },
  addBtnDisabled: { opacity: 0.4 },
  addText: { fontSize: t.fontSize.sm, fontWeight: '500' },
})
