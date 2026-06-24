import { StyleSheet } from 'react-native'

import { defaultTheme as t } from '../theme'
import type { ListColorPalette } from '../hooks/useListColors'

export const createStyles = (c: ListColorPalette) => StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: t.spacing.md,
    gap: t.spacing.sm,
  },
  title: {
    fontSize: t.fontSize.lg,
    fontWeight: '700',
    color: c.text,
  },
  backBtn: {
    padding: t.spacing.xs,
  },

  // Selection hint
  selectionHint: {
    fontSize: t.fontSize.xs,
    color: c.textMuted,
    marginBottom: t.spacing.sm,
    fontStyle: 'italic',
  },

  // Compare button
  compareBtn: {
    marginLeft: 'auto',
    backgroundColor: c.primary,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
    borderRadius: t.borderRadius.sm,
  },
  compareBtnText: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: c.primaryText,
  },

  // List
  listContent: {
    paddingBottom: t.spacing.xl,
  },
  listFooter: {
    paddingVertical: t.spacing.md,
  },

  // Version row
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.separator,
    gap: t.spacing.md,
  },
  versionRowSelected: {
    backgroundColor: c.pressed,
  },

  // Check circle
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },

  // Version info
  versionInfo: { flex: 1 },
  versionDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionDate: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: c.text,
  },
  versionRelative: {
    fontSize: t.fontSize.xs,
    color: c.textMuted,
  },
  versionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginTop: 4,
  },

  // Status pills
  versionStatusPill: {
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusDraftPill: { backgroundColor: c.warningBackground },
  statusPublishedPill: { backgroundColor: c.successBackground },
  versionStatusText: {
    fontSize: t.fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusDraftColor: { color: c.warning },
  statusPublishedColor: { color: c.success },
  autosavePill: {
    backgroundColor: c.pressed,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  autosaveColor: { color: c.textMuted },

  // Comparison dates
  compareDates: {
    flexDirection: 'row',
    gap: t.spacing.sm,
    marginBottom: t.spacing.md,
  },
  compareDate: {
    flex: 1,
    backgroundColor: c.pressed,
    padding: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  compareDateLabel: {
    fontSize: t.fontSize.xs,
    color: c.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  compareDateValue: {
    fontSize: t.fontSize.sm,
    color: c.text,
    fontWeight: '600',
  },

  // Diff scroll
  diffScroll: { flex: 1 },
  diffContent: { paddingBottom: t.spacing.xl },

  // Restore button
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    backgroundColor: c.primary,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.sm,
    marginTop: t.spacing.sm,
  },
  restoreBtnDisabled: { opacity: 0.5 },
  restoreBtnText: {
    fontSize: t.fontSize.md,
    fontWeight: '600',
    color: c.primaryText,
  },

  // Loading / error / empty states
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.spacing.xl,
  },
  errorText: {
    fontSize: t.fontSize.sm,
    color: c.error,
    textAlign: 'center',
    marginBottom: t.spacing.md,
  },
  retryBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
  },
  retryBtnText: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: c.primaryText,
  },
  emptyText: {
    fontSize: t.fontSize.sm,
    color: c.textMuted,
  },
})
