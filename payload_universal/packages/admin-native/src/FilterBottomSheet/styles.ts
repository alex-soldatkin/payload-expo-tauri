// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
import { StyleSheet } from 'react-native'

import { defaultTheme as t } from '../theme'
import type { ListColorPalette } from '../hooks/useListColors'

export const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: t.spacing.md, gap: t.spacing.sm },
    backBtn: { paddingRight: t.spacing.sm },
    backText: { fontSize: t.fontSize.md, color: c.primary, fontWeight: '600' },
    title: { fontSize: t.fontSize.lg, fontWeight: '700', color: c.text, flex: 1 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    rowSelected: { backgroundColor: c.pressed },
    rowLabel: { fontSize: t.fontSize.md, color: c.text, flexShrink: 1 },
    rowLabelSelected: { fontWeight: '600' },
    rowType: { fontSize: t.fontSize.xs, color: c.textMuted, textTransform: 'uppercase' },
    checkMark: { fontSize: 16, color: c.primary },

    emptyText: { textAlign: 'center', padding: t.spacing.xl, color: c.textMuted },

    valueContainer: { flex: 1 },
    textInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: t.borderRadius.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm + 2,
      fontSize: t.fontSize.md,
      color: c.text,
      backgroundColor: c.surface,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: t.spacing.md,
    },
    switchLabel: { fontSize: t.fontSize.md, color: c.text },
    optionList: { maxHeight: 220 },

    dateWrap: { marginBottom: t.spacing.sm },

    relationContainer: { flex: 1 },
    relationList: { flex: 1, marginTop: t.spacing.sm },
    relationLoading: { paddingVertical: t.spacing.xl },

    applyBtn: {
      backgroundColor: c.primary,
      borderRadius: t.borderRadius.sm,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      marginTop: t.spacing.lg,
    },
    applyDisabled: { opacity: 0.4 },
    applyText: { color: c.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },

    // ── Step 0: OR-group overview ─────────────────────────────────
    overviewScroll: { flex: 1 },
    overviewContent: { paddingBottom: t.spacing.lg },
    groupSection: {
      borderRadius: t.borderRadius.lg,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
      overflow: 'hidden',
    },
    groupSectionFallback: {
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    conditionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.spacing.sm,
      paddingVertical: t.spacing.sm + 2,
    },
    conditionRowPressed: { opacity: 0.6 },
    conditionText: { flex: 1, fontSize: t.fontSize.sm, color: c.textMuted },
    conditionField: { color: c.text, fontWeight: '600' },
    conditionValue: { color: c.text, fontWeight: '500' },
    conditionRemove: { fontSize: 13, color: c.textMuted, fontWeight: '700' },
    andRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    andLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    andLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.hairline },
    orPillRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      marginVertical: t.spacing.sm + 2,
    },
    orPillLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.hairline },
    orPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.pressed,
      paddingHorizontal: t.spacing.md,
      paddingVertical: 3,
    },
    orPillText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 1,
    },
    overviewActions: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      marginTop: t.spacing.lg,
    },
    addFilterBtn: {
      flex: 1,
      borderRadius: t.borderRadius.sm,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      backgroundColor: c.primary,
    },
    addFilterText: { color: c.primaryText, fontSize: t.fontSize.sm, fontWeight: '600' },
    addOrBtn: {
      flex: 1,
      borderRadius: t.borderRadius.sm,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.primary,
      borderStyle: 'dashed',
    },
    addOrText: { color: c.primary, fontSize: t.fontSize.sm, fontWeight: '600' },

    // ── Step 0: query presets section ─────────────────────────────
    presetSection: { marginTop: t.spacing.xl },
    presetHeading: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: t.spacing.xs,
    },
    presetLoading: { paddingVertical: t.spacing.md },
    presetEmpty: { color: c.textMuted, fontSize: t.fontSize.sm, paddingVertical: t.spacing.sm },
    presetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingVertical: t.spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    presetRowBody: { flex: 1 },
    presetTitle: { fontSize: t.fontSize.md, color: c.text, fontWeight: '500' },
    presetWarn: { fontSize: t.fontSize.xs, color: c.warning, marginTop: 2 },
    presetBadge: {
      borderRadius: 999,
      backgroundColor: c.pressed,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 2,
    },
    presetBadgeText: { fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 0.5 },
    presetSaveLink: { fontSize: t.fontSize.sm, fontWeight: '600', color: c.primary },
    presetSaveBox: { marginTop: t.spacing.sm },
    presetSaveActions: { flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.sm },
    presetError: { fontSize: t.fontSize.xs, color: c.error, marginTop: t.spacing.xs },

    // ── Step 3: AND/OR group choice ───────────────────────────────
    combineRow: { marginTop: t.spacing.lg },
    combineLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: t.spacing.xs,
    },
    combineSegmentRow: {
      flexDirection: 'row',
      backgroundColor: c.pressed,
      borderRadius: t.borderRadius.sm,
      padding: 3,
    },
    combineSegment: {
      flex: 1,
      paddingVertical: t.spacing.sm,
      alignItems: 'center',
      borderRadius: t.borderRadius.sm - 2,
    },
    combineSegmentActive: { backgroundColor: c.surface },
    combineSegmentText: { fontSize: t.fontSize.xs, color: c.textMuted, fontWeight: '500' },
    combineSegmentTextActive: { color: c.text, fontWeight: '600' },
  })
