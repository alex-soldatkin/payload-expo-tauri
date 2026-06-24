/**
 * GanttCustomizeSheet — shared constants + dark-mode-aware StyleSheet factory.
 */
import { StyleSheet } from 'react-native'
import {
  DEFAULT_CALENDAR_PALETTE,
  GANTT_CHART_DEFAULT_PX_PER_DAY,
  type ListColorPalette,
} from '@payload-universal/admin-native'

export const ROW_HEIGHT = 54
/** Curated quick-pick swatches (also the fallback when ColorPicker is null). */
export const SWATCHES = DEFAULT_CALENDAR_PALETTE.slice(0, 8)

/** S/M/L zoom presets — day-column width in px (M = the component default). */
export const ZOOM_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 16, label: 'S' },
  { value: GANTT_CHART_DEFAULT_PX_PER_DAY, label: 'M' },
  { value: 44, label: 'L' },
]

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
      gap: 8,
      zIndex: 10,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 4 },
    sheetTitleCentered: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
      textAlign: 'center',
    },
    sheetHint: { fontSize: 13, color: c.textMuted },
    backBtn: { paddingRight: 4, paddingTop: 8 },
    backText: { fontSize: 15, color: c.primary, fontWeight: '600' },
    saveBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
    saveBtnDisabled: { opacity: 0.4 },

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
    rowInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowAction: {
      width: 36,
      height: ROW_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: { fontSize: 15, color: c.text, fontWeight: '500' },
    /** Visibility section: hidden sources read muted (mirrors calendar sheet). */
    rowLabelHidden: { color: c.textPlaceholder },
    rowPressed: { opacity: 0.6 },

    dragHandle: {
      width: 32,
      height: ROW_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dragHandlePlaceholder: { width: 32 },

    checkbox: { marginRight: 12, marginLeft: 4 },
    fieldInfo: { flex: 1, minWidth: 0 },
    fieldType: { fontSize: 11, color: c.textMuted, marginTop: 1 },

    swatch: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
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

    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    addText: { fontSize: 15, fontWeight: '600', color: c.primary },

    emptyText: { color: c.textMuted, fontSize: 13, paddingVertical: 8, paddingHorizontal: 8 },

    textInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.surface,
      marginHorizontal: 8,
    },

    segmentRow: {
      flexDirection: 'row',
      backgroundColor: c.pressed,
      borderRadius: 8,
      padding: 3,
      marginHorizontal: 8,
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
  })

export type SheetStyles = ReturnType<typeof createStyles>
