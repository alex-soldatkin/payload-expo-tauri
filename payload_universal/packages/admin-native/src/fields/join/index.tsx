/**
 * JoinField — Native mobile component for Payload's join field type.
 *
 * Renders a scrollable table of related documents from the joined collection,
 * filtered by the inverse relationship (`on` field equals current doc ID).
 *
 * Features:
 * - Configurable columns via `admin.defaultColumns` from Payload config
 * - Horizontal scroll for wide tables, vertical scroll for many rows
 * - Tappable rows → navigate to the related document (Link.Preview for peek/pop)
 * - Local-first: queries RxDB with proper WHERE filter, falls back to REST API
 * - Pagination with "Load more" button
 * - Pull-to-refresh
 * - Column header tap to toggle sort direction
 * - Empty state when no related docs exist or doc not yet saved
 * - Polymorphic join badge for multi-collection joins
 *
 * Data + pagination + sort state lives in useJoinData; the table chrome
 * (header / row / empty / footer) lives in components/JoinTable.
 */
import React, { useMemo } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'

import type { ClientJoinField, FieldComponentProps } from '../../types'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { FieldShell } from '../shared'
import { useListColors } from '../../hooks/useListColors'
import {
  JoinTableEmpty,
  JoinTableFooter,
  JoinTableHeader,
  JoinTableRow,
} from './components/JoinTable'
import { useJoinData } from './hooks/useJoinData'
import { createStyles } from './styles'

// No expo-router imports — shared packages must never use router hooks directly.
// Navigation is handled via onRowPress callback prop.

export const JoinField: React.FC<FieldComponentProps<ClientJoinField>> = ({
  field,
  value,
  // onChange not used — join fields are read-only by nature
}) => {
  // Dark-mode aware table palette
  const { colors: jc } = useListColors()
  const styles = useMemo(() => createStyles(jc), [jc])

  const {
    docs,
    loading,
    refreshing,
    hasNextPage,
    page,
    totalDocs,
    sortField,
    sortDir,
    parentDocId,
    prePopulated,
    columns,
    joinCollection,
    collectionLabel,
    isPolymorphic,
    handleLoadMore,
    handleRefresh,
    handleColumnSort,
  } = useJoinData(field, value)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // If the document hasn't been saved yet, show a placeholder
  if (!parentDocId && !prePopulated) {
    return (
      <FieldShell
        label={getFieldLabel(field, collectionLabel)}
        description={getFieldDescription(field)}
      >
        <View style={styles.container}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Save this document to see related {collectionLabel}
            </Text>
          </View>
        </View>
      </FieldShell>
    )
  }

  return (
    <FieldShell
      label={getFieldLabel(field, collectionLabel)}
      description={getFieldDescription(field)}
    >
      <View style={styles.container}>
        {/* Table header bar */}
        <View style={styles.tableHeader}>
          <Text style={styles.countText}>
            {totalDocs > 0
              ? `${totalDocs} ${totalDocs === 1 ? 'item' : 'items'}`
              : ''}
          </Text>
          {isPolymorphic && (
            <View style={styles.badgeContainer}>
              {(field.collection as string[]).map((slug) => (
                <Text key={slug} style={[
                  styles.collectionBadge,
                  slug === joinCollection && styles.collectionBadgeActive,
                ]}>
                  {slug}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Loading spinner for initial load */}
        {loading && docs.length === 0 && (
          <ActivityIndicator style={styles.spinner} />
        )}

        {/* Column headers */}
        {docs.length > 0 && (
          <JoinTableHeader
            columns={columns}
            sortField={sortField}
            sortDir={sortDir}
            onColumnSort={handleColumnSort}
            styles={styles}
          />
        )}

        {/* Data rows */}
        <FlatList
          data={docs}
          keyExtractor={(item) => String(item.id ?? Math.random())}
          renderItem={({ item }) => (
            <JoinTableRow item={item} columns={columns} styles={styles} />
          )}
          ListEmptyComponent={
            <JoinTableEmpty loading={loading} collectionLabel={collectionLabel} styles={styles} />
          }
          ListFooterComponent={
            <JoinTableFooter
              hasNextPage={hasNextPage}
              loading={loading}
              page={page}
              totalDocs={totalDocs}
              docsCount={docs.length}
              onLoadMore={handleLoadMore}
              styles={styles}
            />
          }
          onRefresh={handleRefresh}
          refreshing={refreshing}
          scrollEnabled={false}
          nestedScrollEnabled
        />
      </View>
    </FieldShell>
  )
}
