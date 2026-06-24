/**
 * DocumentListTableRowItem — table-mode row: the frozen-title + shared
 * translate DocumentListTableRow kept ONE viewport-width unit, wrapped in the
 * screen's renderRow (if given) or the default swipe-to-delete / press
 * handling. Extracted verbatim from DocumentList's table-mode renderItem path.
 */
import React from 'react'
import { Animated, Pressable } from 'react-native'

import { DocumentListTableRow } from '../../DocumentListTable'
import type { DocumentListTableColumn } from '../../DocumentListTable'
import { getDocumentTitle } from '../../utils/schemaHelpers'
import type { ListColorPalette } from '../../hooks/useListColors'
import { closeOpenSwipeRow, SwipeToDeleteRow } from '../../SwipeToDeleteRow'
import type { createStyles } from '../styles'

type DocumentListTableRowItemProps = {
  doc: Record<string, unknown>
  index: number
  tableTitleField?: string
  columns: DocumentListTableColumn[]
  trackWidth: number
  hasDrafts: boolean
  translateX: Animated.AnimatedInterpolation<number>
  formatValue: (value: unknown) => string
  colors: ListColorPalette
  pinFirstColumn: boolean
  styles: ReturnType<typeof createStyles>
  onPress: (doc: Record<string, unknown>) => void
  onDelete?: (doc: Record<string, unknown>) => void
  renderRow?: (props: {
    item: Record<string, unknown>
    rowContent: React.ReactElement
    onPress: () => void
    index: number
  }) => React.ReactElement
}

export function DocumentListTableRowItem({
  doc,
  index,
  tableTitleField,
  columns,
  trackWidth,
  hasDrafts,
  translateX,
  formatValue,
  colors,
  pinFirstColumn,
  styles,
  onPress,
  onDelete,
  renderRow,
}: DocumentListTableRowItemProps): React.ReactElement {
  const tableRow = (
    <DocumentListTableRow
      doc={doc}
      title={getDocumentTitle(doc, tableTitleField)}
      columns={columns}
      trackWidth={trackWidth}
      showStatus={hasDrafts}
      translateX={translateX}
      formatValue={formatValue}
      colors={colors}
      pinFirstColumn={pinFirstColumn}
    />
  )
  if (renderRow) {
    return renderRow({ item: doc, rowContent: tableRow, onPress: () => onPress(doc), index })
  }
  // Default path: full-bleed swipe action (no card insets in table mode)
  const wrappedRow =
    onDelete != null ? (
      <SwipeToDeleteRow
        onDelete={() => onDelete(doc)}
        confirmTitle="Delete"
        confirmMessage="Are you sure?"
      >
        {tableRow}
      </SwipeToDeleteRow>
    ) : (
      tableRow
    )
  return (
    <Pressable
      onPress={() => {
        if (closeOpenSwipeRow()) return
        onPress(doc)
      }}
      style={({ pressed }) => (pressed ? styles.rowPressed : undefined)}
    >
      {wrappedRow}
    </Pressable>
  )
}
