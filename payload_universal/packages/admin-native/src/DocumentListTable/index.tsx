/**
 * DocumentListTable — tablet table mode building blocks for DocumentList
 * (web Payload admin parity: many fixed-width columns, a frozen title
 * column and a sticky tap-to-sort header band; Apple-native feel).
 *
 * STRUCTURE — "in-row frozen title + shared horizontal track":
 * every row stays ONE viewport-width unit:
 *
 *   [ pinned title cell (176pt) | clipped window (flex:1, overflow hidden)
 *                                 └ Animated track (width = Σ column widths)
 *                                   translateX = -scrollX               ]
 *
 * The sticky header band hosts the single REAL horizontal Animated.ScrollView
 * (the scroll driver). Animated.event (native driver) maps its
 * contentOffset.x into one shared `scrollX`; every row's track renders
 * `translateX: Animated.multiply(scrollX, -1)` — header and rows share one
 * scroll position with zero JS-frame lag, and the title column is frozen by
 * construction (it simply lives OUTSIDE the translated track; no overlay,
 * no translateY syncing).
 *
 * CUSTOMISATION — both pins are DEFAULTS, not invariants:
 *  - `pinFirstColumn=false` collapses a row to a SINGLE clipped window: the
 *    title cell becomes the first cell INSIDE the translated track (track
 *    width grows by the title width; header band mirrors the layout). Same
 *    pieces, simpler arrangement — nothing is frozen.
 *  - `stickyHeader=false` is handled by DocumentList (it drops
 *    stickyHeaderIndices so the band scrolls away vertically with content);
 *    the band stays the horizontal scroll driver either way.
 *
 * WHY NOT the overlay / whole-row-scroll variants:
 *  - Screens wrap the WHOLE rowContent in SwipeToDeleteRow (PanResponder
 *    that claims horizontal-left drags and reveals its action at the
 *    wrapper's right edge) and ScrollablePreview.Trigger (native tap +
 *    long-press recognizers), plus a selection-mode checkbox row. An
 *    absolutely-positioned frozen-title overlay would sit OUTSIDE those
 *    wrappers: the title wouldn't translate with a swipe, long-press peek
 *    would be dead on the title, and the selection checkbox would hide
 *    underneath the overlay.
 *  - Putting whole rows INSIDE a horizontal ScrollView makes row left-drags
 *    race the swipe PanResponder (nondeterministic swipe vs. scroll) AND
 *    anchors the revealed Delete action at the far CONTENT edge — off the
 *    viewport at every scroll position except the maximum.
 *  - Keeping rows viewport-width preserves every existing row gesture
 *    verbatim. The tradeoff: horizontal panning happens on the always
 *    visible header band rather than on row surfaces — pan-anywhere row
 *    scrolling is impossible anyway because row-level horizontal drags
 *    belong to swipe-to-delete by contract.
 *
 * MUST stay free of @expo/ui — pure RN + optional expo-glass-effect/lucide,
 * matching the conventions of the rest of the list surfaces.
 */
export { DocumentListTableHeader } from './components/DocumentListTableHeader'
export { DocumentListTableRow } from './components/DocumentListTableRow'

export type { DocumentListTableColumn } from './types'
export {
  TABLE_TITLE_COLUMN_WIDTH,
  TABLE_ROW_MIN_HEIGHT,
  TABLE_ROW_MAX_HEIGHT,
} from './types'

export {
  getTableColumnWidth,
  getCellLineLimit,
  extractRichTextPlainText,
  titleishFromObject,
  summariseArrayValue,
  formatTableCellValue,
  buildTableColumns,
} from './utils'
