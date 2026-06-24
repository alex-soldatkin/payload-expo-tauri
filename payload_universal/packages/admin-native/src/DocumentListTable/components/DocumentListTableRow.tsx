/**
 * DocumentListTable row — pinned title cell + clipped, shared-translate
 * column track. See ../index.tsx for the structure decision rationale.
 */
import React from 'react'
import { Animated, Text, View } from 'react-native'

import type { ListColorPalette } from '../../hooks/useListColors'
import { getByPath } from '../../utils/schemaHelpers'
import { styles } from '../styles'
import { TABLE_TITLE_COLUMN_WIDTH } from '../types'
import type { DocumentListTableColumn } from '../types'
import { formatTableCellValue, getCellLineLimit } from '../utils'

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
  /**
   * DocumentList's scalar value formatter (date strings, booleans). The row
   * layers the field-type cell rules on top via `formatTableCellValue`
   * (rich-text excerpts, array summaries, title-ish object extraction).
   */
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
              <Text
                style={[styles.cellText, { color: colors.textMuted }]}
                numberOfLines={getCellLineLimit(col.type)}
              >
                {formatTableCellValue(getByPath(doc, col.field), col.type, formatValue)}
              </Text>
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  )
}
