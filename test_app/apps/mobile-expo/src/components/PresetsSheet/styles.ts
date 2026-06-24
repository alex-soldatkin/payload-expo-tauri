// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------
import { StyleSheet } from 'react-native'
import type { ListColorPalette } from '@payload-universal/admin-native'

export const menuStyles = StyleSheet.create({
  androidAnchor: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  trigger: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
})

export const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      gap: 8,
    },
    sheetTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: c.text },
    sheetHint: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    backBtn: { paddingRight: 4 },
    backText: { fontSize: 15, color: c.primary, fontWeight: '600' },
    saveBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnDisabled: { opacity: 0.4 },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginTop: 16,
      marginBottom: 6,
    },

    saveCurrentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    saveCurrentText: { fontSize: 15, fontWeight: '600', color: c.primary },

    presetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    presetApply: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    presetInfo: { flex: 1 },
    presetMeta: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    rowPressed: { opacity: 0.6 },
    rowLabel: { flexShrink: 1, fontSize: 15, color: c.text, fontWeight: '500' },
    rowLabelSelected: { fontWeight: '600' },

    sharedBadge: {
      borderRadius: 999,
      backgroundColor: c.pressed,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    sharedBadgeText: { fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 0.5 },

    emptyText: { color: c.textMuted, fontSize: 13, paddingVertical: 8, paddingHorizontal: 4 },

    textInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.surface,
    },

    segmentRow: {
      flexDirection: 'row',
      backgroundColor: c.pressed,
      borderRadius: 8,
      padding: 3,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 6,
    },
    segmentActive: { backgroundColor: c.surface },
    segmentText: { fontSize: 12, color: c.textMuted, fontWeight: '500' },
    segmentTextActive: { color: c.text, fontWeight: '600' },

    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    userLoading: { paddingVertical: 16 },
  })
