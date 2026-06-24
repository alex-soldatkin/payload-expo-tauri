/**
 * MonthGridFallback — StyleSheet factory.
 * Dark-mode aware palette only (zero hardcoded light colours).
 */
import { StyleSheet } from 'react-native'

import { defaultTheme as t } from '../../theme'
import type { ListColorPalette } from '../../hooks/useListColors'
import {
  BARS_CELL_HEIGHT,
  BARS_LANE_BLOCK_HEIGHT,
  BAR_HEIGHT,
  BAR_OVERFLOW_HEIGHT,
} from './utils'

export const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    card: {
      borderRadius: 18,
      overflow: 'hidden',
      marginHorizontal: t.spacing.md,
    },
    cardFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    cardDark: {},
    /** fillHeight: the card owns its pane (the parent provides the insets). */
    cardFill: { flex: 1, marginHorizontal: 0 },
    inner: { paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.xs },
    flexFill: { flex: 1 },
    /**
     * fillHeight week rows: share the leftover height with Apple Calendar's
     * separator scheme — hairlines between week ROWS only, no column lines.
     * Colour is c.border (NOT c.hairline): the rgba hairline token disappears
     * against the dark card surface, leaving the tall iPad cells reading as
     * floating numbers; the solid border token stays subtle in light mode and
     * visibly structures the grid in dark mode.
     */
    weekRowFill: {
      flex: 1,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.spacing.sm,
      marginBottom: t.spacing.xs,
      gap: t.spacing.sm,
    },
    monthTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: t.fontSize.md,
      fontWeight: '700',
      color: c.text,
    },
    chevronBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevronGlyph: { fontSize: 22, fontWeight: '600', color: c.textMuted, lineHeight: 24 },

    /**
     * THE shared per-column metric (squished-grid guard): every column —
     * weekday header cell, dots-density day cell, bars-density day cell —
     * derives its width from this one style, and all three rows
     * (weekdayRow / weekRow / barsWeekWrap>weekRow) stretch to the same
     * `inner` width. flex:1 + minWidth:0 ⇒ exactly 1/7 each at every width
     * tier (incl. fillHeight), so the header can never spread full-width
     * while the day cells compress (the iPad squish bug). Never give a
     * column an intrinsic width or a different flex value.
     */
    col: { flex: 1, minWidth: 0 },

    /**
     * Shared horizontal ANCHOR invariant: weekday header letters and day
     * numbers are BOTH centred within the same styles.col metric — the
     * header label uses textAlign center, the day badge uses alignSelf
     * center. Never anchor one without the other (a top-left number under a
     * centred letter reads as misaligned floating digits on tall iPad cells).
     */
    weekdayRow: { flexDirection: 'row', marginBottom: 2 },
    weekdayLabel: {
      textAlign: 'center',
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      color: c.textMuted,
      textTransform: 'uppercase',
    },

    weekRow: { flexDirection: 'row' },
    /** Day cell extras — column width comes ONLY from styles.col. */
    cell: {
      minHeight: 52,
      alignItems: 'stretch',
      paddingTop: 3,
      borderRadius: 10,
    },
    cellPressed: { backgroundColor: c.pressed },
    dayBadge: {
      alignSelf: 'center',
      minWidth: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    dayText: { fontSize: t.fontSize.sm, fontWeight: '500', color: c.text },

    stripsArea: { marginTop: 2, gap: 2, minHeight: 0 },
    strip: { height: 3 },
    stripStart: {
      marginLeft: 3,
      borderTopLeftRadius: 1.5,
      borderBottomLeftRadius: 1.5,
    },
    stripEnd: {
      marginRight: 3,
      borderTopRightRadius: 1.5,
      borderBottomRightRadius: 1.5,
    },

    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 3,
      marginTop: 3,
      minHeight: 5,
    },
    dot: { width: 5, height: 5, borderRadius: 2.5 },

    // ── Bars density (showEventBars) ──
    barsWeekWrap: { position: 'relative' },
    /**
     * The bar/overflow lane block, pinned to the TOP of the week row at a
     * fixed height (left/right/top: 0, height: BARS_LANE_BLOCK_HEIGHT). This
     * is deliberately NOT StyleSheet.absoluteFill: in fillHeight the week row
     * grows tall, and a bottom-anchored (absoluteFill) overlay made the
     * fixed-top bars read as floating ~mid-cell with empty space ABOVE them.
     * A top-pinned fixed-height block keeps the bars tight under the number
     * row; the flexible empty space lands BELOW the block.
     */
    barsOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: BARS_LANE_BLOCK_HEIGHT,
    },
    /** Day cell extras — column width comes ONLY from styles.col. */
    barsCell: {
      alignItems: 'stretch',
      paddingTop: 3,
      borderRadius: 10,
    },
    barsCellFixed: { height: BARS_CELL_HEIGHT },
    /** fillHeight: rows flex — keep the lane area as the floor, grow beyond. */
    barsCellGrow: { minHeight: BARS_CELL_HEIGHT },
    barSlot: { position: 'absolute', height: BAR_HEIGHT },
    barInner: {
      flex: 1,
      borderRadius: 4,
      justifyContent: 'center',
      paddingHorizontal: 4,
      overflow: 'hidden',
    },
    barNoLeftRadius: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
    barNoRightRadius: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
    barTitle: { fontSize: 10, fontWeight: '600' },
    // Solid accent bars need fixed light text regardless of theme — the bar
    // background is the source colour, not a themed surface.
    barTitleOnAccent: { color: '#FFFFFF' },
    barOverflow: {
      position: 'absolute',
      fontSize: 10,
      fontWeight: '600',
      color: c.textMuted,
      textAlign: 'center',
      height: BAR_OVERFLOW_HEIGHT,
    },
  })
