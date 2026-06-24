/**
 * DocumentListCard — the phone card-mode row: optional upload thumbnail, a
 * title + date header line, a two-column summary grid, wrapped in a liquid
 * glass card (iOS 26+) or themed fallback, plus the swipe-to-delete / press
 * wrapping. Extracted verbatim from DocumentList's card-mode renderItem path.
 */
import React from 'react'
import { Image, Pressable, Text, View } from 'react-native'

import { getDocumentTitle } from '../../utils/schemaHelpers'
import { closeOpenSwipeRow, SwipeToDeleteRow } from '../../SwipeToDeleteRow'
import { liquidGlassAvailable, GlassView } from '../icons'
import type { createStyles } from '../styles'

type DocumentListCardProps = {
  doc: Record<string, unknown>
  index: number
  titleField?: string
  summaryFields: string[]
  fieldTypeMap: Map<string, string>
  fieldLabelMap: Map<string, string>
  baseURL: string
  styles: ReturnType<typeof createStyles>
  formatDate: (iso: string) => string
  formatFieldValue: (val: unknown) => string
  onPress: (doc: Record<string, unknown>) => void
  onDelete?: (doc: Record<string, unknown>) => void
  renderRow?: (props: {
    item: Record<string, unknown>
    rowContent: React.ReactElement
    onPress: () => void
    index: number
  }) => React.ReactElement
}

export function DocumentListCard({
  doc,
  index,
  titleField,
  summaryFields,
  fieldTypeMap,
  fieldLabelMap,
  baseURL,
  styles,
  formatDate,
  formatFieldValue,
  onPress,
  onDelete,
  renderRow,
}: DocumentListCardProps): React.ReactElement {
  const title = getDocumentTitle(doc, titleField)
  const date = doc.updatedAt ? formatDate(doc.updatedAt as string) : undefined

  // ── Detect image thumbnail from upload summary fields ──────────
  let thumbnailUrl: string | null = null
  let thumbnailField: string | null = null
  for (const fieldName of summaryFields) {
    if (fieldTypeMap.get(fieldName) === 'upload') {
      const val = doc[fieldName]
      if (val && typeof val === 'object') {
        const obj = val as Record<string, unknown>
        if (typeof obj.url === 'string') {
          const raw = obj.url
          thumbnailUrl = raw.startsWith('http') ? raw : `${baseURL}${raw}`
          thumbnailField = fieldName
          break
        }
      }
    }
  }

  // ── Build summary lines (exclude title field and image field) ──
  const summaryLines = summaryFields
    .filter((f) => f !== titleField && f !== thumbnailField)
    .map((fieldName) => ({
      key: fieldName,
      label: fieldLabelMap.get(fieldName) ?? fieldName,
      value: formatFieldValue(doc[fieldName]),
    }))
    .filter((line) => line.value !== '—')

  const rowInner = (
    <>
      {thumbnailUrl && (
        <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
      )}
      <View style={styles.rowBody}>
        {/* Title + date on one line */}
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
          {date && <Text style={styles.rowDate}>{date}</Text>}
        </View>

        {/* Two-column summary grid */}
        {summaryLines.length > 0 && (
          <View style={styles.summaryGrid}>
            {summaryLines.map((line) => (
              <View key={line.key} style={styles.summaryCell}>
                <Text style={styles.summaryLabel} numberOfLines={1}>{line.label}</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{line.value}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </>
  )

  // Liquid glass card (iOS 26+) with a themed card fallback — consistent
  // with the dashboard's collection cards.
  const card = liquidGlassAvailable && GlassView ? (
    <GlassView style={styles.card} isInteractive glassEffectStyle="regular">
      {rowInner}
    </GlassView>
  ) : (
    <View style={[styles.card, styles.cardFallback]}>{rowInner}</View>
  )

  // Default path only: swipe-to-delete wraps the card when onDelete is
  // provided (the confirm dialog lives inside SwipeToDeleteRow). With a
  // renderRow the parent wraps instead — never double-wrap.
  const rowContent = (
    <View style={styles.cardWrap}>
      {!renderRow && onDelete ? (
        <SwipeToDeleteRow
          onDelete={() => onDelete(doc)}
          confirmTitle="Delete"
          confirmMessage="Are you sure?"
          actionStyle={styles.swipeAction}
        >
          {card}
        </SwipeToDeleteRow>
      ) : (
        card
      )}
    </View>
  )

  if (renderRow) {
    return renderRow({ item: doc, rowContent, onPress: () => onPress(doc), index })
  }
  return (
    <Pressable
      onPress={() => {
        // A tap while a swipe row is open just closes it (iOS Mail parity)
        if (closeOpenSwipeRow()) return
        onPress(doc)
      }}
      style={({ pressed }) => (pressed ? styles.rowPressed : undefined)}
    >
      {rowContent}
    </Pressable>
  )
}
