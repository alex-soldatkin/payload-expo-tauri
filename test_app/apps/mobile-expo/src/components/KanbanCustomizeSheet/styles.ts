import { StyleSheet } from 'react-native'
import type { ListColorPalette } from '@payload-universal/admin-native'

import { ROW_HEIGHT } from './utils'

// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------

export const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 8,
      zIndex: 10,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 4 },
    sheetHint: { fontSize: 13, color: c.textMuted },
    saveBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginTop: 14,
      marginBottom: 4,
      paddingHorizontal: 8,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      height: ROW_HEIGHT,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
      backgroundColor: 'transparent',
    },
    rowInner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    rowToggle: {
      width: 32,
      height: ROW_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    rowLabel: { flex: 1, fontSize: 15, color: c.text, fontWeight: '500' },
    rowLabelHidden: { color: c.textPlaceholder },
    fixedTag: { fontSize: 11, color: c.textMuted, marginRight: 8 },

    dragHandle: {
      width: 32,
      height: ROW_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dragHandlePlaceholder: { width: 32 },

    checkbox: { marginRight: 12 },
    fieldInfo: { flex: 1 },
    fieldType: { fontSize: 11, color: c.textMuted, marginTop: 1 },

    swatch: {
      width: 24,
      height: 24,
      borderRadius: 12,
      marginLeft: 8,
    },
    colorSection: {
      marginTop: 4,
      paddingBottom: 4,
    },
    colorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: 8,
    },
    colorReset: { fontSize: 13, fontWeight: '600', color: c.destructive },
    colorPickerWrap: { paddingHorizontal: 8, paddingVertical: 6 },
    swatchRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 8,
      paddingVertical: 8,
      flexWrap: 'wrap',
    },
    swatchLarge: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
  })

export type KanbanSheetStyles = ReturnType<typeof createStyles>
