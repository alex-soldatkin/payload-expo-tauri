// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------
import { StyleSheet } from 'react-native'

import { defaultTheme as t } from '../../theme'
import type { ListColorPalette } from '../../hooks/useListColors'
import { GANTT_AXIS_HEIGHT, GANTT_TITLE_COLUMN_WIDTH } from '../types'

export const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },

    axisBand: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: GANTT_AXIS_HEIGHT,
    },
    axisBandFallback: { backgroundColor: c.surface },
    axisBandDark: {},

    hScroll: { flex: 1 },
    bodyWrap: { flex: 1 },
    list: { flex: 1 },
    listContent: { paddingBottom: 24 },

    weekendStripe: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      backgroundColor: c.pressed,
    },
    todayLine: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: c.primary,
      opacity: 0.85,
    },

    titleOverlay: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: GANTT_TITLE_COLUMN_WIDTH,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: c.hairline,
      overflow: 'hidden',
    },
    titleOverlayFallback: { backgroundColor: c.card },
    titleCorner: {
      height: GANTT_AXIS_HEIGHT,
      justifyContent: 'flex-end',
      paddingHorizontal: 10,
      paddingBottom: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    titleCornerText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: c.textMuted,
    },
    titleRowsClip: { flex: 1, overflow: 'hidden' },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hairline,
    },
    titleRowPressed: { backgroundColor: c.pressed },
    titleText: { flex: 1, fontSize: 12, fontWeight: '600', color: c.text },
    titleChevron: { fontSize: 14, fontWeight: '600', color: c.tertiary },

    empty: { paddingTop: 48, paddingLeft: GANTT_TITLE_COLUMN_WIDTH + 24 },
    emptyText: { fontSize: t.fontSize.md, color: c.textMuted },
  })
