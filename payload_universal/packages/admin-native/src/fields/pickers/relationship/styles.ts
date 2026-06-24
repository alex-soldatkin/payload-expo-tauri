import { StyleSheet } from 'react-native'

import { defaultTheme as t } from '../../../theme'
import { ROW_MIN_HEIGHT } from '../../shared'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

export const styles = StyleSheet.create({
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  triggerText: { fontSize: t.fontSize.md, flex: 1 },
  chevron: { fontSize: 18, marginLeft: t.spacing.xs },

  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: ROW_MIN_HEIGHT,
  },
  // Peek trigger wrapper — fills the row width left of the action buttons
  valueMainWrap: { flex: 1 },
  valueMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  peekLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  valueTitle: { flex: 1, fontSize: t.fontSize.md },
  valueBadge: { fontSize: t.fontSize.xs },
  valueActions: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  actionDisabled: { opacity: 0.35 },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    minHeight: ROW_MIN_HEIGHT,
  },
  addText: { fontSize: t.fontSize.sm, fontWeight: '500' },
  minHint: { fontSize: t.fontSize.xs, marginTop: 2 },

  switcherScroll: { flexGrow: 0, marginBottom: t.spacing.sm },
  switcherRow: { flexDirection: 'row', gap: t.spacing.xs },
  switcherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  switcherText: { fontSize: t.fontSize.sm, fontWeight: '500' },

  searchGlass: { borderRadius: t.borderRadius.md, overflow: 'hidden', marginBottom: t.spacing.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.borderRadius.md,
  },
  searchInput: { flex: 1, paddingVertical: t.spacing.sm + 2, fontSize: t.fontSize.md },

  optionTextSelected: { fontWeight: '600' },
  rowDisabled: { opacity: 0.4 },

  loadMoreRow: { paddingVertical: t.spacing.md, alignItems: 'center' },
  loadMoreText: { fontSize: t.fontSize.sm, fontWeight: '600' },

  doneBtn: {
    marginTop: t.spacing.sm,
    borderRadius: t.borderRadius.md,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
  },
  doneText: { fontSize: t.fontSize.md, fontWeight: '600' },

  clearBtn: { paddingVertical: t.spacing.md, alignItems: 'center' },
  clearText: { fontSize: t.fontSize.sm },

  previewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: t.spacing.sm },
  previewActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
    marginBottom: -16,
  },
  previewSelectBtn: {
    flex: 1,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  previewSelectText: { fontSize: t.fontSize.md, fontWeight: '600' },
  previewCloseBtn: { flex: 1, paddingVertical: t.spacing.md, alignItems: 'center' },
  previewCloseText: { fontSize: t.fontSize.md },
})
