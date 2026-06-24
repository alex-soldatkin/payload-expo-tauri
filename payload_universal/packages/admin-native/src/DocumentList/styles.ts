/**
 * DocumentList styles — built from the dark-mode aware palette.
 */
import { StyleSheet } from 'react-native'

import { defaultTheme as t } from '../theme'
import type { ListColorPalette } from '../hooks/useListColors'
import { SORTABLE_ITEM_HEIGHT } from './types'

export const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: c.background },
    listContent: { paddingTop: t.spacing.sm, paddingBottom: 100 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl },

    // Filter row
    filterRow: { marginVertical: t.spacing.xs },

    // ── Tablet table mode ─────────────────────────────────────────
    // Header band sits flush under the nav bar; rows are full-bleed.
    tableListContent: { paddingBottom: 100 },
    // Chips pinned with the sticky band need an opaque backdrop (content
    // scrolls underneath) — padding, not margin, so nothing shows through.
    tableChipsWrap: { backgroundColor: c.background, paddingVertical: t.spacing.xs },

    // Sort + meta controls row
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.spacing.lg,
      marginBottom: t.spacing.sm,
      gap: t.spacing.sm,
    },
    controlsSpacer: { flex: 1 },
    rangeMeta: { fontSize: t.fontSize.xs, color: c.textMuted },

    sortRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    sortDirBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    sortDirText: { fontSize: 14, color: c.text, fontWeight: '600' },
    sortChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      borderRadius: 16,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs + 2,
      overflow: 'hidden',
    },
    sortChipFallback: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    sortChipText: { fontSize: t.fontSize.sm, color: c.text, fontWeight: '500' },

    sortSheetTitle: {
      fontSize: t.fontSize.lg,
      fontWeight: '700',
      color: c.text,
      marginBottom: t.spacing.md,
    },
    sortSegmentRow: {
      flexDirection: 'row',
      backgroundColor: c.pressed,
      borderRadius: t.borderRadius.sm,
      padding: 3,
      marginBottom: t.spacing.md,
    },
    sortSegment: {
      flex: 1,
      paddingVertical: t.spacing.sm,
      alignItems: 'center',
      borderRadius: t.borderRadius.sm - 2,
    },
    sortSegmentActive: { backgroundColor: c.surface },
    sortSegmentText: { fontSize: t.fontSize.sm, color: c.textMuted, fontWeight: '500' },
    sortSegmentTextActive: { color: c.text, fontWeight: '600' },
    sortFieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    sortFieldLabel: { fontSize: t.fontSize.md, color: c.text },
    sortFieldLabelActive: { fontWeight: '600' },
    sortCheck: { fontSize: 16, color: c.primary },

    // ── Row cards (liquid glass / themed fallback) ────────────────
    cardWrap: {
      paddingHorizontal: t.spacing.lg,
      marginBottom: t.spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: t.spacing.lg,
      overflow: 'hidden',
    },
    cardFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    rowPressed: { opacity: 0.7 },
    // Revealed swipe action aligns with the card's rounded corners
    swipeAction: { borderRadius: 16 },

    // Image thumbnail (when an upload summary field has a URL)
    thumbnail: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: c.separator,
    },

    // Text content
    rowBody: { flex: 1, minWidth: 0 },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
      flex: 1,
    },
    rowDate: {
      fontSize: 12,
      color: c.textMuted,
      flexShrink: 0,
    },
    rowChevron: {
      fontSize: 18,
      color: c.tertiary,
      marginLeft: 6,
      fontWeight: '300',
    },

    // ── Two-column summary grid ──────────────────────────────────
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 4,
    },
    summaryCell: {
      width: '50%' as any,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingRight: 14,
      marginTop: 2,
    },
    summaryLabel: {
      fontSize: 12,
      color: c.textMuted,
      marginRight: 4,
    },
    summaryValue: {
      fontSize: 12,
      color: c.text,
      fontWeight: '500',
      flexShrink: 1,
      textAlign: 'right',
    },

    // ── Footer (pagination meta) ─────────────────────────────────
    footer: { alignItems: 'center', paddingVertical: t.spacing.sm },
    footerSpinner: { paddingVertical: t.spacing.sm },
    footerMeta: { fontSize: t.fontSize.xs, color: c.textMuted },

    // ── States ───────────────────────────────────────────────────
    errorText: { color: c.error, fontSize: t.fontSize.md, textAlign: 'center', marginBottom: t.spacing.md },
    retryBtn: { paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.sm, backgroundColor: c.primary, borderRadius: t.borderRadius.sm },
    retryText: { color: c.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },

    emptyContainer: { alignItems: 'center', paddingVertical: t.spacing.xl },
    emptyNativeBox: { height: 280, alignSelf: 'stretch' },
    emptyCenter: { alignItems: 'center', paddingVertical: t.spacing.xxl, gap: t.spacing.sm },
    emptyTitle: { color: c.text, fontSize: t.fontSize.lg, fontWeight: '600' },
    emptyText: {
      color: c.textMuted,
      fontSize: t.fontSize.md,
      textAlign: 'center',
      paddingHorizontal: t.spacing.xl,
    },
    clearFiltersBtn: { marginTop: t.spacing.md },
    clearFiltersText: { color: c.primary, fontSize: t.fontSize.sm, fontWeight: '600' },
  })

// Summary field picker styles
export const createSfStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: t.spacing.sm,
      zIndex: 10,
    },
    sheetTitle: { fontSize: t.fontSize.lg, fontWeight: '700', color: c.text, marginBottom: 4 },
    sheetHint: { fontSize: t.fontSize.sm, color: c.textMuted },
    saveBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginLeft: t.spacing.md,
    },
    saveBtnSuccess: {
      backgroundColor: c.success,
    },
    saveBtnError: {
      backgroundColor: c.destructive,
    },
    saveBtnText: {
      color: c.primaryText,
      fontSize: 18,
      fontWeight: '700',
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
      marginTop: t.spacing.md,
      marginBottom: t.spacing.xs,
      paddingHorizontal: t.spacing.sm,
    },
    pageSizeWrap: {
      paddingHorizontal: t.spacing.sm,
      marginBottom: t.spacing.xs,
    },
    pageSizeRow: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.sm,
      marginBottom: t.spacing.xs,
    },
    pageSizeChip: {
      flex: 1,
      paddingVertical: t.spacing.sm,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    pageSizeChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    pageSizeText: { fontSize: t.fontSize.sm, color: c.text, fontWeight: '500' },
    pageSizeTextActive: { color: c.primaryText, fontWeight: '600' },
    pinRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xs + 2,
      minHeight: 40,
    },
    pinLabel: { fontSize: t.fontSize.md, color: c.text, fontWeight: '500' },
    pinFallbackText: { fontSize: t.fontSize.sm, fontWeight: '600' },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: SORTABLE_ITEM_HEIGHT,
      paddingHorizontal: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
      backgroundColor: 'transparent',
    },
    fieldRowInner: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    dragHandle: {
      width: 32,
      height: SORTABLE_ITEM_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dragIcon: {
      fontSize: 18,
      color: c.textMuted,
    },
    dragHandlePlaceholder: {
      width: 32,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: t.spacing.md,
    },
    checkboxSelected: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    checkboxNative: {
      marginRight: t.spacing.md,
    },
    checkmark: { fontSize: 13, color: c.primaryText, fontWeight: '700' },
    fieldInfo: { flex: 1 },
    fieldLabel: { fontSize: t.fontSize.md, color: c.text, fontWeight: '500' },
    fieldType: { fontSize: t.fontSize.xs, color: c.textMuted, marginTop: 1 },
    clearBtn: { paddingVertical: t.spacing.md, alignItems: 'center' },
    clearText: { fontSize: t.fontSize.sm, color: c.destructive, fontWeight: '600' },
    emptyText: { textAlign: 'center', paddingVertical: t.spacing.xl, color: c.textMuted, fontSize: t.fontSize.sm },
  })
