/**
 * DocumentListTable styles — hairline separators, zebra-free, palette colours
 * injected inline at the call sites.
 */
import { StyleSheet } from 'react-native'

import {
  HEADER_HEIGHT,
  TABLE_ROW_MAX_HEIGHT,
  TABLE_ROW_MIN_HEIGHT,
  TABLE_TITLE_COLUMN_WIDTH,
} from './types'

export const styles = StyleSheet.create({
  headerBand: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  headerTrackWindow: { flex: 1 },
  headerCell: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  leadingCell: { paddingLeft: 16 },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  headerArrow: { fontSize: 11, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    // Content-driven height, hard-bounded (see TABLE_ROW_MIN/MAX_HEIGHT):
    // floor = single-line rhythm, cap = the two-line long-text case. The
    // cap guarantees no ancestor measurement can ever inflate a row again;
    // overflow hidden clips cleanly if the clamp engages.
    minHeight: TABLE_ROW_MIN_HEIGHT,
    maxHeight: TABLE_ROW_MAX_HEIGHT,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleCell: {
    width: TABLE_TITLE_COLUMN_WIDTH,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    gap: 3,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  titleText: { fontSize: 15, fontWeight: '600' },
  statusPill: {
    fontSize: 11,
    fontWeight: '600',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  // Row-direction window so the track stretches to the row's (bounded)
  // height on the cross axis — NO percentage heights anywhere in the row
  // tree (the old `height: '100%'` track was the elastic link that let a
  // tall ancestor measurement blow rows up to viewport scale).
  trackWindow: { flex: 1, flexDirection: 'row', overflow: 'hidden' },
  track: { flexDirection: 'row', alignItems: 'stretch' },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  cellText: { fontSize: 14 },
})
