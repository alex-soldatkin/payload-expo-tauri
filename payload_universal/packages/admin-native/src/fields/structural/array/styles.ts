import { StyleSheet } from 'react-native'

import { CONTENT_INSET, defaultTheme as t, ROW_MIN_HEIGHT } from '../../../theme'

export const styles = StyleSheet.create({
  container: { marginBottom: t.spacing.xs },
  // Colour injected at render (palette.destructive) — dark-mode aware.
  error: { fontSize: 12, marginTop: 2 },

  // Field header
  arrayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: t.spacing.sm,
    gap: t.spacing.sm,
  },
  // Section-header style (matches FormSection title chrome) — the array is a
  // sub-section: header above the row cards at the grid the section provides.
  fieldLabel: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  arrayCount: { fontSize: 12, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  glassHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    paddingHorizontal: t.spacing.md,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  headerAction: { fontSize: t.fontSize.sm, fontWeight: '500' },
  modeToggle: { fontSize: 18, paddingHorizontal: 2 },

  // Stacked row cards — the card keeps its glass/border tier but owns NO
  // horizontal padding: the header row and SubFieldRows rows carry the
  // canonical CONTENT_INSET so inner separators inset like FormSection's.
  rowCard: {
    borderRadius: t.borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 2,
    marginBottom: t.spacing.xs,
  },
  glassRowCard: {
    borderRadius: t.borderRadius.md,
    paddingVertical: 2,
    marginBottom: t.spacing.xs,
    overflow: 'hidden',
  },
  // Swipe wrapper owns the row margin so the revealed action layer aligns
  // flush with the card (a bottom margin inside the wrapper would leak red).
  rowSwipeWrap: { marginBottom: t.spacing.xs },
  rowCardInSwipe: { marginBottom: 0 },
  rowSwipeAction: { borderRadius: t.borderRadius.md },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_MIN_HEIGHT,
    gap: t.spacing.xs,
    paddingHorizontal: CONTENT_INSET,
  },
  rowHeaderPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  rowChevron: { fontSize: 13, width: 14, textAlign: 'center' },
  rowTitle: { fontSize: t.fontSize.md, fontWeight: '500', flexShrink: 1 },
  rowLabelCustom: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowBody: { paddingBottom: t.spacing.sm },

  // Switcher mode
  switcherToolbar: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, marginBottom: 2, minHeight: ROW_MIN_HEIGHT },
  switcherTitle: { flex: 1, flexDirection: 'row', alignItems: 'center' },

  removeText: { fontSize: t.fontSize.sm },
})
