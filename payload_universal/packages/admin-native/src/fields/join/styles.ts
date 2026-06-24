/**
 * JoinField styles — dark-mode aware table palette.
 */
import { StyleSheet } from 'react-native'

import { defaultTheme as t } from '../../theme'
import { type ListColorPalette } from '../../hooks/useListColors'

export const createStyles = (c: ListColorPalette) => StyleSheet.create({
  container: {
    borderRadius: t.borderRadius.sm,
    backgroundColor: c.card,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.separator,
    backgroundColor: c.background,
  },
  countText: {
    fontSize: t.fontSize.xs,
    color: c.textMuted,
    fontWeight: '500',
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: t.spacing.xs,
  },
  collectionBadge: {
    fontSize: t.fontSize.xs,
    color: c.textMuted,
    fontWeight: '500',
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: c.pressed,
    overflow: 'hidden',
  },
  collectionBadgeActive: {
    color: c.primary,
    fontWeight: '600',
    backgroundColor: c.hairline,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    backgroundColor: c.background,
  },
  headerCell: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    justifyContent: 'center',
  },
  headerText: {
    fontSize: t.fontSize.xs,
    fontWeight: '600',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTextActive: {
    color: c.primary,
  },
  rowPressable: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.separator,
  },
  dataRow: {
    flexDirection: 'row',
  },
  dataCell: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: t.fontSize.sm,
    color: c.text,
  },
  emptyContainer: {
    paddingVertical: t.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: t.fontSize.sm,
    color: c.textMuted,
    fontStyle: 'italic',
  },
  footer: {
    paddingVertical: t.spacing.md,
    alignItems: 'center',
  },
  loadMoreBtn: {
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
  },
  loadMoreText: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: c.primary,
  },
  spinner: {
    marginVertical: t.spacing.xl,
  },
})

export type JoinStyles = ReturnType<typeof createStyles>
