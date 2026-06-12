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
import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import type { ScrollView } from 'react-native'

import type { ListColorPalette } from './hooks/useListColors'
import { getByPath } from './utils/schemaHelpers'

// Lucide chevrons for the active sort column indicator
let ChevronUpIcon: React.ComponentType<{ size: number; color: string }> | null = null
let ChevronDownIcon: React.ComponentType<{ size: number; color: string }> | null = null
try {
  const lucide = require('lucide-react-native')
  ChevronUpIcon = lucide.ChevronUp
  ChevronDownIcon = lucide.ChevronDown
} catch {
  /* lucide-react-native not available — text arrows */
}

// Optional: GlassView for the liquid glass header band on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed */
}

// ---------------------------------------------------------------------------
// Column model
// ---------------------------------------------------------------------------

export type DocumentListTableColumn = {
  field: string
  label: string
  type: string
  width: number
  sortable: boolean
}

type TableSort = { field: string; direction: 'asc' | 'desc' }

/** Pinned title column: 16pt leading inset + ~160pt of content. */
export const TABLE_TITLE_COLUMN_WIDTH = 176

const HEADER_HEIGHT = 38

/**
 * Type-aware fixed column widths (pt) — columns NEVER flex-squeeze; total
 * content width grows beyond the screen and scrolls horizontally instead.
 */
const TYPE_COLUMN_WIDTHS: Record<string, number> = {
  text: 160,
  textarea: 160,
  code: 160,
  richText: 160,
  json: 160,
  relationship: 160,
  upload: 160,
  join: 160,
  email: 180,
  date: 130,
  select: 130,
  radio: 130,
  point: 130,
  number: 100,
  checkbox: 90,
}
const MIN_COLUMN_WIDTH = 80
const MAX_COLUMN_WIDTH = 240

export const getTableColumnWidth = (type: string): number =>
  Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, TYPE_COLUMN_WIDTHS[type] ?? 160))

/** "updatedAt" → "Updated At" (fallback when the schema has no label). */
const humaniseFieldName = (field: string): string =>
  field
    .replace(/^_/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()

/**
 * Build the scrolling column set from the summary-fields picker selection.
 * Order is the picker's drag order; the title field and (with drafts) the
 * `_status` field are excluded — they render inside the pinned title cell.
 * A trailing built-in "Updated" column mirrors the web admin default.
 */
export const buildTableColumns = (args: {
  summaryFields: string[]
  titleField?: string
  hasDrafts: boolean
  fieldLabelMap: Map<string, string>
  fieldTypeMap: Map<string, string>
  sortableFieldNames: Set<string>
}): DocumentListTableColumn[] => {
  const { summaryFields, titleField, hasDrafts, fieldLabelMap, fieldTypeMap, sortableFieldNames } =
    args
  const columns: DocumentListTableColumn[] = summaryFields
    .filter((f) => f !== titleField && !(hasDrafts && f === '_status'))
    .map((field) => {
      const type =
        fieldTypeMap.get(field) ??
        (field === 'createdAt' || field === 'updatedAt' ? 'date' : 'text')
      return {
        field,
        label: fieldLabelMap.get(field) ?? humaniseFieldName(field),
        type,
        width: getTableColumnWidth(type),
        sortable: sortableFieldNames.has(field),
      }
    })
  if (!columns.some((c) => c.field === 'updatedAt')) {
    columns.push({
      field: 'updatedAt',
      label: 'Updated',
      type: 'date',
      width: getTableColumnWidth('date'),
      sortable: true,
    })
  }
  return columns
}

// ---------------------------------------------------------------------------
// Header band — sticky glass strip hosting the horizontal scroll driver
// ---------------------------------------------------------------------------

type TableHeaderProps = {
  columns: DocumentListTableColumn[]
  /** Label for the pinned title column header. */
  titleLabel: string
  /** Field the pinned title column sorts on (undefined → not sortable). */
  titleSortField?: string
  /** Field type of the title field (drives the default sort direction). */
  titleSortType?: string
  sort: TableSort
  /** Tap-to-sort: toggle direction on the active column, else select it. */
  onSortPress: (field: string, type: string) => void
  /**
   * Shared horizontal scroll position. The band's ScrollView WRITES it via a
   * native-driver Animated.event; rows consume its negation as translateX.
   */
  scrollX: Animated.Value
  colors: ListColorPalette
  /**
   * Default true — the title header cell sits OUTSIDE the band's horizontal
   * ScrollView (frozen by construction). False → it renders as the first
   * cell INSIDE the scroll, mirroring the unpinned row layout.
   */
  pinFirstColumn?: boolean
}

export function DocumentListTableHeader({
  columns,
  titleLabel,
  titleSortField,
  titleSortType,
  sort,
  onSortPress,
  scrollX,
  colors,
  pinFirstColumn = true,
}: TableHeaderProps) {
  // The ONE real horizontal ScrollView of the whole table (scroll driver)
  const trackScrollRef = useRef<ScrollView | null>(null)

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
      }),
    [scrollX],
  )

  // Reset the horizontal position whenever the column SET (or the pin
  // layout) changes — stale offsets against a narrower/shifted track would
  // strand rows off-content.
  const columnsKey = columns.map((c) => c.field).join('|')
  useEffect(() => {
    trackScrollRef.current?.scrollTo({ x: 0, animated: false })
    scrollX.setValue(0)
  }, [columnsKey, pinFirstColumn, scrollX])

  const useGlass = liquidGlassAvailable && GlassView != null

  // Title column header — outside the scroll when pinned (frozen by
  // construction), first cell inside it otherwise.
  const titleHeaderCell = (
    <HeaderCell
      label={titleLabel}
      width={TABLE_TITLE_COLUMN_WIDTH}
      leading
      sortable={titleSortField != null}
      active={titleSortField != null && sort.field === titleSortField}
      direction={sort.direction}
      onPress={() => {
        if (titleSortField) onSortPress(titleSortField, titleSortType ?? 'text')
      }}
      colors={colors}
    />
  )

  return (
    <View
      style={[
        styles.headerBand,
        { borderBottomColor: colors.hairline },
        !useGlass && { backgroundColor: colors.surface },
      ]}
    >
      {useGlass && GlassView ? (
        // Background-only glass layer — the interactive header cells stay
        // plain RN views ABOVE it (never nest Pressables inside GlassView).
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          pointerEvents="none"
        />
      ) : null}

      {pinFirstColumn ? titleHeaderCell : null}

      {/* Scrolling column headers — the horizontal pan surface */}
      <Animated.ScrollView
        ref={trackScrollRef as unknown as React.ComponentProps<typeof Animated.ScrollView>['ref']}
        horizontal
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        style={styles.headerTrackWindow}
      >
        {!pinFirstColumn ? titleHeaderCell : null}
        {columns.map((col) => (
          <HeaderCell
            key={col.field}
            label={col.label}
            width={col.width}
            sortable={col.sortable}
            active={sort.field === col.field}
            direction={sort.direction}
            onPress={() => onSortPress(col.field, col.type)}
            colors={colors}
          />
        ))}
      </Animated.ScrollView>
    </View>
  )
}

function HeaderCell({
  label,
  width,
  sortable,
  active,
  direction,
  onPress,
  colors,
  leading,
}: {
  label: string
  width: number
  sortable: boolean
  active: boolean
  direction: 'asc' | 'desc'
  onPress: () => void
  colors: ListColorPalette
  leading?: boolean
}) {
  const arrow =
    direction === 'desc' ? (
      ChevronDownIcon ? (
        <ChevronDownIcon size={12} color={colors.text} />
      ) : (
        <Text style={[styles.headerArrow, { color: colors.text }]}>↓</Text>
      )
    ) : ChevronUpIcon ? (
      <ChevronUpIcon size={12} color={colors.text} />
    ) : (
      <Text style={[styles.headerArrow, { color: colors.text }]}>↑</Text>
    )

  return (
    <Pressable
      disabled={!sortable}
      onPress={onPress}
      style={[
        styles.headerCell,
        { width, borderRightColor: colors.hairline },
        leading && styles.leadingCell,
      ]}
      accessibilityRole={sortable ? 'button' : undefined}
      accessibilityLabel={sortable ? `Sort by ${label}` : label}
    >
      <Text
        style={[styles.headerLabel, { color: active ? colors.text : colors.textMuted }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {active ? arrow : null}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Row — pinned title cell + clipped, shared-translate column track
// ---------------------------------------------------------------------------

type TableRowProps = {
  doc: Record<string, unknown>
  title: string
  columns: DocumentListTableColumn[]
  /** Σ column widths — explicit track width inside the clipped window. */
  trackWidth: number
  /** Render the draft/published pill beneath the title (drafts enabled). */
  showStatus: boolean
  /** Shared `Animated.multiply(scrollX, -1)` — native driver. */
  translateX: Animated.AnimatedInterpolation<number>
  /** DocumentList's existing cell value formatter (dates, bools, rels…). */
  formatValue: (value: unknown) => string
  colors: ListColorPalette
  /**
   * Default true — title cell frozen outside the translated track. False →
   * the row is one clipped window and the title cell scrolls as the first
   * cell of the track (track width grows by TABLE_TITLE_COLUMN_WIDTH).
   */
  pinFirstColumn?: boolean
}

export function DocumentListTableRow({
  doc,
  title,
  columns,
  trackWidth,
  showStatus,
  translateX,
  formatValue,
  colors,
  pinFirstColumn = true,
}: TableRowProps) {
  const status = String((doc as { _status?: unknown })._status ?? 'draft')
  const published = status === 'published'

  const titleCell = (
    <View style={[styles.titleCell, { borderRightColor: colors.hairline }]}>
      <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      {showStatus && (
        <Text
          style={[
            styles.statusPill,
            published
              ? { color: colors.success, backgroundColor: colors.successBackground }
              : { color: colors.warning, backgroundColor: colors.warningBackground },
          ]}
          numberOfLines={1}
        >
          {status}
        </Text>
      )}
    </View>
  )

  // Unpinned: the title cell joins the track, so the explicit track width
  // (Σ column widths from the caller) grows by the title column's width.
  const effectiveTrackWidth = pinFirstColumn
    ? trackWidth
    : trackWidth + TABLE_TITLE_COLUMN_WIDTH

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.hairline }]}>
      {/* Frozen title column — outside the translated track by construction */}
      {pinFirstColumn ? titleCell : null}

      {/* Clipped window over the shared-translate column track */}
      <View style={styles.trackWindow}>
        <Animated.View
          style={[styles.track, { width: effectiveTrackWidth, transform: [{ translateX }] }]}
        >
          {!pinFirstColumn ? titleCell : null}
          {columns.map((col) => (
            <View
              key={col.field}
              style={[styles.cell, { width: col.width, borderRightColor: colors.hairline }]}
            >
              <Text style={[styles.cellText, { color: colors.textMuted }]} numberOfLines={1}>
                {formatValue(getByPath(doc, col.field))}
              </Text>
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles — hairline separators, zebra-free, palette colours injected inline
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
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
    minHeight: 48,
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
  trackWindow: { flex: 1, overflow: 'hidden' },
  track: { flexDirection: 'row', alignItems: 'stretch', height: '100%' },
  cell: {
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  cellText: { fontSize: 14 },
})
