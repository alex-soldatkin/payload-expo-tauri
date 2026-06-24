/**
 * JoinTable pieces — presentational header / row / empty / footer renderers.
 *
 * Pure UI: every value is supplied by the JoinField container; these own no
 * data or state. Split out of the field component so the table chrome lives
 * apart from the query + render orchestration.
 */
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'

import { COLUMN_MAX_WIDTH, COLUMN_MIN_WIDTH, formatCellValue, formatColumnName } from '../utils'
import type { JoinStyles } from '../styles'

type HeaderProps = {
  columns: string[]
  sortField: string
  sortDir: 'asc' | 'desc'
  onColumnSort: (col: string) => void
  styles: JoinStyles
}

export const JoinTableHeader: React.FC<HeaderProps> = ({
  columns,
  sortField,
  sortDir,
  onColumnSort,
  styles,
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.headerRow}>
    {columns.map((col) => {
      const isActive = sortField === col
      const arrow = isActive ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
      return (
        <Pressable
          key={col}
          style={[styles.headerCell, { minWidth: COLUMN_MIN_WIDTH, maxWidth: COLUMN_MAX_WIDTH }]}
          onPress={() => onColumnSort(col)}
        >
          <Text style={[styles.headerText, isActive && styles.headerTextActive]} numberOfLines={1}>
            {formatColumnName(col)}{arrow}
          </Text>
        </Pressable>
      )
    })}
  </ScrollView>
)

type RowProps = {
  item: Record<string, unknown>
  columns: string[]
  styles: JoinStyles
}

export const JoinTableRow: React.FC<RowProps> = ({ item, columns, styles }) => {
  const rowContent = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dataRow}>
      {columns.map((col) => (
        <View key={col} style={[styles.dataCell, { minWidth: COLUMN_MIN_WIDTH, maxWidth: COLUMN_MAX_WIDTH }]}>
          <Text style={styles.cellText} numberOfLines={2}>
            {formatCellValue(item[col])}
          </Text>
        </View>
      ))}
    </ScrollView>
  )

  return <View style={styles.rowPressable}>{rowContent}</View>
}

type EmptyProps = {
  loading: boolean
  collectionLabel: string
  styles: JoinStyles
}

export const JoinTableEmpty: React.FC<EmptyProps> = ({ loading, collectionLabel, styles }) => {
  if (loading) return null
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No related {collectionLabel} found</Text>
    </View>
  )
}

type FooterProps = {
  hasNextPage: boolean
  loading: boolean
  page: number
  totalDocs: number
  docsCount: number
  onLoadMore: () => void
  styles: JoinStyles
}

export const JoinTableFooter: React.FC<FooterProps> = ({
  hasNextPage,
  loading,
  page,
  totalDocs,
  docsCount,
  onLoadMore,
  styles,
}) => {
  if (!hasNextPage && !loading) return null
  return (
    <View style={styles.footer}>
      {loading && page > 1 && <ActivityIndicator size="small" />}
      {hasNextPage && !loading && (
        <Pressable style={styles.loadMoreBtn} onPress={onLoadMore}>
          <Text style={styles.loadMoreText}>
            Load more ({totalDocs - docsCount} remaining)
          </Text>
        </Pressable>
      )}
    </View>
  )
}
