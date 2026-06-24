import { StyleSheet } from 'react-native'

import { defaultTheme as t } from '../../theme'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

export const styles = StyleSheet.create({
  sheetTitle: {
    fontSize: t.fontSize.lg,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: t.spacing.md,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    fontSize: t.fontSize.md,
    color: t.colors.text,
    marginBottom: t.spacing.md,
  },
  loader: {
    marginVertical: t.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.xs,
    marginTop: t.spacing.sm,
  },
  sectionLabel: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: t.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
  },
  glassItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
    marginVertical: 2,
  },
  itemTitle: {
    flex: 1,
    fontSize: t.fontSize.md,
    color: t.colors.text,
  },
  badge: {
    backgroundColor: t.colors.background,
    borderRadius: 10,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 2,
    marginLeft: t.spacing.sm,
  },
  badgeText: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: t.spacing.xl,
    color: t.colors.textMuted,
    fontSize: t.fontSize.sm,
  },
})
