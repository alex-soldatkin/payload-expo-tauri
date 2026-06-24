/**
 * CalendarView — StyleSheet factory + layout sizing constants.
 * Dark-mode aware palette only (zero hardcoded light colours).
 */
import { StyleSheet } from 'react-native'

import { defaultTheme as t } from '../../theme'
import type { ListColorPalette } from '../../hooks/useListColors'

/** Height of the native month grid area (the day list takes the rest). */
export const NATIVE_MONTH_HEIGHT = 360
/** Regular-width month mode: width of the selected-day right side panel. */
export const MONTH_SIDE_PANEL_WIDTH = 320
/** Regular-width day mode: max content width (don't stretch on 12.9"). */
export const DAY_TIMELINE_MAX_WIDTH = 720
/** Regular-width header: fixed width of the Month/Week/Day segment. */
export const HEADER_SEGMENT_WIDTH = 300

export const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xs,
    },
    modePicker: { flex: 1 },
    todayBtn: {
      borderRadius: 16,
      paddingVertical: 7,
      paddingHorizontal: t.spacing.md,
      overflow: 'hidden',
    },
    todayBtnFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    // Inside the regular-width glass header — bordered, surface-transparent.
    todayBtnEmbedded: {
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    todayLabel: { fontSize: t.fontSize.sm, fontWeight: '600', color: c.text },
    todayPressed: { opacity: 0.7 },

    // ── Regular-width header — ONE glass row: segmented + Today + legend ──
    headerWrapRegular: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xs,
    },
    headerCard: { borderRadius: 18, overflow: 'hidden' },
    headerCardFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    headerRowRegular: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 6,
    },
    modePickerRegular: { width: HEADER_SEGMENT_WIDTH },
    headerDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      marginVertical: t.spacing.xs,
      backgroundColor: c.hairline,
    },
    legendScrollRegular: { flex: 1 },
    legendRowRegular: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingRight: t.spacing.sm,
    },

    legendScroll: { flexGrow: 0 },
    legendRow: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    chipPressed: { opacity: 0.7 },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipLabel: { fontSize: t.fontSize.xs, fontWeight: '600', color: c.text, maxWidth: 160 },
    /** Text fallback for the legend check when lucide is unavailable. */
    chipCheckGlyph: { fontSize: 11, fontWeight: '800', color: c.text, lineHeight: 12 },

    nativeMonth: { height: NATIVE_MONTH_HEIGHT, marginHorizontal: t.spacing.md },
    // Regular width: the grid owns its split pane (pane provides the insets).
    nativeMonthFill: { flex: 1 },

    // ── Regular-width month split — full-height grid + right side panel ──
    monthSplit: {
      flex: 1,
      flexDirection: 'row',
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.xs,
      paddingBottom: t.spacing.md,
    },
    monthGridPane: { flex: 1 },
    sidePanel: {
      width: MONTH_SIDE_PANEL_WIDTH,
      borderRadius: 18,
      overflow: 'hidden',
    },
    sidePanelFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    sidePanelHeader: {
      fontSize: t.fontSize.sm,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      paddingHorizontal: t.spacing.lg,
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.xs,
    },
    sidePanelList: { flex: 1 },
    sidePanelContent: {
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.lg,
      gap: t.spacing.sm,
    },

    dayListHeader: {
      fontSize: t.fontSize.sm,
      fontWeight: '700',
      color: c.textMuted,
      paddingHorizontal: t.spacing.lg,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    dayList: { flex: 1 },
    dayListContent: {
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.xl,
      gap: t.spacing.sm,
    },
    // ── Selected-day empty state (icon + caption / native tier) ──
    flexFill: { flex: 1 },
    emptyDayNativeBox: { height: 160 },
    emptyDay: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.sm,
      paddingTop: t.spacing.xl,
      paddingBottom: t.spacing.lg,
    },
    emptyDayText: { fontSize: t.fontSize.sm, color: c.textMuted, textAlign: 'center' },

    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
    },
    dateNavBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateNavGlyph: { fontSize: 22, fontWeight: '600', color: c.textMuted, lineHeight: 24 },
    dateNavLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: t.fontSize.md,
      fontWeight: '700',
      color: c.text,
    },
    nativeDay: { flex: 1 },
    // Regular-width WEEK mode: comfortable timeline insets under the strip.
    timelineInsetRegular: { flex: 1, paddingHorizontal: t.spacing.lg },
    // Regular-width DAY mode: centred max-width column (nav + timeline).
    dayCenterColumn: {
      flex: 1,
      width: '100%',
      maxWidth: DAY_TIMELINE_MAX_WIDTH,
      alignSelf: 'center',
    },

    // ── All-day strip (fallback tier only) ──
    allDayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingLeft: t.spacing.md,
      paddingVertical: t.spacing.xs,
    },
    // Regular-width week mode: align with the full-width strip's insets.
    allDayRowRegular: {
      paddingLeft: t.spacing.lg,
      paddingVertical: t.spacing.sm,
    },
    allDayLabel: {
      fontSize: t.fontSize.xs,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    allDayChips: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingRight: t.spacing.md,
    },
    allDayChip: {
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: 10,
      overflow: 'hidden',
    },
    allDayChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    allDayChipDot: { width: 8, height: 8, borderRadius: 4 },
    allDayChipLabel: {
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      color: c.text,
      maxWidth: 180,
    },
  })

export type CalendarStyles = ReturnType<typeof createStyles>
