import { StyleSheet } from 'react-native'

import { CONTENT_INSET, defaultTheme as t, ROW_MIN_HEIGHT } from '../../../theme'

export const styles = StyleSheet.create({
  container: { marginBottom: t.spacing.xs },
  // Colour injected at render (palette.destructive) — dark-mode aware.
  error: { fontSize: 12, marginTop: 2 },

  // Field header
  blocksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: t.spacing.sm,
    gap: t.spacing.sm,
  },
  // Section-header style (matches FormSection title chrome) — blocks are a
  // sub-section: header above the block cards at the grid the section provides.
  fieldLabel: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  blockCount: { fontSize: 12, marginTop: 1 },
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

  // Block row cards — the card keeps its glass/border tier but owns NO
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
  rowTitleArea: { flex: 1 },
  blockTypeLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  blockName: { fontSize: t.fontSize.md, fontWeight: '500', marginTop: 1 },
  blockNameEditHint: { fontSize: 11, fontWeight: '400' },
  // Borderless inline edit affordance — field-owned hairlines are forbidden
  // (the header row supplies the affordance; no underline box).
  blockNameInput: {
    fontSize: t.fontSize.md,
    fontWeight: '500',
    paddingVertical: 2,
    paddingHorizontal: 0,
    marginTop: 1,
  },
  rowBody: { paddingBottom: t.spacing.sm },
  removeText: { fontSize: t.fontSize.sm },

  // Block picker sheet
  pickerTitle: { fontSize: t.fontSize.lg, fontWeight: '700', marginBottom: t.spacing.sm },
  searchBox: {
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.sm,
    marginBottom: t.spacing.sm,
  },
  searchInput: { fontSize: t.fontSize.md, paddingVertical: 8 },
  pickerEmpty: { fontSize: t.fontSize.sm, textAlign: 'center', paddingVertical: t.spacing.xl },
  pickerGroup: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: t.spacing.sm,
    marginBottom: 2,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: t.borderRadius.sm,
  },
  pickerThumb: { width: 40, height: 40, borderRadius: t.borderRadius.sm },
  pickerThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  pickerThumbLetter: { fontSize: t.fontSize.lg, fontWeight: '600' },
  pickerRowText: { flex: 1 },
  pickerRowLabel: { fontSize: t.fontSize.md, fontWeight: '500' },
  pickerRowDesc: { fontSize: 12, marginTop: 1 },
  pickerRowPlus: { fontSize: 20, fontWeight: '500', paddingHorizontal: 4 },
})
