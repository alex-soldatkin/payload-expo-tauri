import { StyleSheet } from 'react-native'

import { defaultTheme as t } from '../../../theme'
import { ROW_MIN_HEIGHT } from '../../shared'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

export const styles = StyleSheet.create({
  // Empty single value — plain tappable muted row, NO dashed/bordered boxes
  // (row contract). Mirrors the relationship single-trigger metrics.
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: ROW_MIN_HEIGHT,
  },
  emptyText: { flex: 1, fontSize: t.fontSize.md },
  chevron: { fontSize: 18, marginLeft: t.spacing.xs },

  uploadHint: { fontSize: t.fontSize.sm },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  },

  // Single value row — borderless, no background, no horizontal inset (the
  // FormSection row provides the 16pt grid). minHeight ≥ 44.
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: t.spacing.xs,
  },
  fileInfo: { flex: 1, gap: 2 },
  fileName: { fontSize: t.fontSize.md, fontWeight: '600' },
  fileMeta: { fontSize: t.fontSize.xs },
  fileIconBox: { alignItems: 'center', justifyContent: 'center', borderRadius: t.borderRadius.sm },
  inlineAction: { padding: t.spacing.xs },

  strip: { flexDirection: 'row', gap: t.spacing.sm, paddingVertical: t.spacing.xs },
  stripTile: { width: 84 },
  stripCaption: { fontSize: t.fontSize.xs, marginTop: 2 },
  stripRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fill-bg add tile — dashed borders are forbidden by the row contract;
  // backgroundColor comes from palette.fill at render.
  addTile: {
    width: 84,
    height: 84,
    borderRadius: t.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minHint: { fontSize: t.fontSize.xs, marginTop: 2 },

  browseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginBottom: t.spacing.md,
  },
  searchGlass: { borderRadius: t.borderRadius.md, overflow: 'hidden', marginBottom: t.spacing.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.borderRadius.md,
  },
  searchInput: { flex: 1, paddingVertical: t.spacing.sm + 2, fontSize: t.fontSize.md },

  browseThumb: { borderRadius: t.borderRadius.sm },
  browseCaption: { fontSize: t.fontSize.xs, marginTop: 2 },
  browseCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
  },

  loadMoreRow: { paddingVertical: t.spacing.md, alignItems: 'center' },
  loadMoreText: { fontSize: t.fontSize.sm, fontWeight: '600' },

  focalBox: { alignItems: 'stretch' },
  focalDot: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  focalDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  focalHint: { fontSize: t.fontSize.xs, textAlign: 'center', marginTop: t.spacing.sm },
  focalActions: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginTop: t.spacing.lg },
  focalSaveBtn: {
    flex: 1,
    borderRadius: t.borderRadius.md,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
  },
  focalSaveText: { fontSize: t.fontSize.md, fontWeight: '600' },
  focalCancelBtn: { paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.lg },
  focalCancelText: { fontSize: t.fontSize.md },
})
