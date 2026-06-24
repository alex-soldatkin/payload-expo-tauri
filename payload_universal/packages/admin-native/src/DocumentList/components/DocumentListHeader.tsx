/**
 * DocumentListHeader — the FlatList ListHeaderComponent element.
 *
 * Table mode: the WHOLE header sticks (stickyHeaderIndices=[0]) — the column
 * band hosts the horizontal scroll driver and must stay reachable; active
 * filter chips pin with it (web admin parity: the filter bar stays above the
 * table). The in-list SortControl row is dropped — column headers are
 * tap-to-sort, and the range meta already lives in the footer.
 *
 * Card mode: the sort control + pagination meta row, plus the active filter
 * chips when any filter is applied.
 */
import React from 'react'
import { Animated, Text, View } from 'react-native'

import { DocumentListTableHeader } from '../../DocumentListTable'
import type { DocumentListTableColumn } from '../../DocumentListTable'
import type { ClientField } from '../../types'
import type { ListColorPalette } from '../../hooks/useListColors'
import type { ActiveFilter } from '../../hooks/useDocumentListFilters'
import { FilterChips } from '../../FilterChips'
import { SortControl } from './SortControl'
import { createStyles } from '../styles'
import type { DocumentListSort } from '../types'

type DocumentListHeaderProps = {
  tableMode: boolean
  styles: ReturnType<typeof createStyles>
  colors: ListColorPalette
  hasActiveFilters: boolean
  filters: ActiveFilter[]
  searchText: string
  onRemoveFilter: (id: string) => void
  onClearAllFilters: () => void
  onOpenFilterEditor: (filter: ActiveFilter | null) => void
  rangeLabel: string | null
  effectiveSort: DocumentListSort
  sortableFields: ClientField[]
  onSortChange: (sort: DocumentListSort) => void
  // Table mode only
  tableColumns: DocumentListTableColumn[]
  tableTitleField?: string
  fieldLabelMap: Map<string, string>
  fieldTypeMap: Map<string, string>
  sortableFieldNames: Set<string>
  onHeaderSortPress: (field: string, type: string) => void
  tableScrollX: Animated.Value
  pinFirstColumn: boolean
}

export function DocumentListHeader({
  tableMode,
  styles,
  colors,
  hasActiveFilters,
  filters,
  searchText,
  onRemoveFilter,
  onClearAllFilters,
  onOpenFilterEditor,
  rangeLabel,
  effectiveSort,
  sortableFields,
  onSortChange,
  tableColumns,
  tableTitleField,
  fieldLabelMap,
  fieldTypeMap,
  sortableFieldNames,
  onHeaderSortPress,
  tableScrollX,
  pinFirstColumn,
}: DocumentListHeaderProps): React.ReactElement {
  if (tableMode) {
    return (
      <View>
        {hasActiveFilters && (
          <View style={styles.tableChipsWrap}>
            <FilterChips
              filters={filters}
              searchText={searchText}
              onRemove={onRemoveFilter}
              onClearAll={onClearAllFilters}
              onAddFilter={() => onOpenFilterEditor(null)}
              onEdit={(f) => onOpenFilterEditor(f)}
            />
          </View>
        )}
        <DocumentListTableHeader
          columns={tableColumns}
          titleLabel={
            tableTitleField ? fieldLabelMap.get(tableTitleField) ?? tableTitleField : 'ID'
          }
          titleSortField={
            tableTitleField && sortableFieldNames.has(tableTitleField) ? tableTitleField : undefined
          }
          titleSortType={tableTitleField ? fieldTypeMap.get(tableTitleField) : undefined}
          sort={effectiveSort}
          onSortPress={onHeaderSortPress}
          scrollX={tableScrollX}
          colors={colors}
          pinFirstColumn={pinFirstColumn}
        />
      </View>
    )
  }

  return (
    <View>
      {/* Sort control + pagination meta */}
      <View style={styles.controlsRow}>
        <SortControl
          sort={effectiveSort}
          sortableFields={sortableFields}
          onChange={onSortChange}
          colors={colors}
          styles={styles}
        />
        <View style={styles.controlsSpacer} />
        {rangeLabel != null && <Text style={styles.rangeMeta}>{rangeLabel}</Text>}
      </View>

      {/* Active filter chips (only shown when filters are applied) */}
      {hasActiveFilters && (
        <View style={styles.filterRow}>
          <FilterChips
            filters={filters}
            searchText={searchText}
            onRemove={onRemoveFilter}
            onClearAll={onClearAllFilters}
            onAddFilter={() => onOpenFilterEditor(null)}
            onEdit={(f) => onOpenFilterEditor(f)}
          />
        </View>
      )}
    </View>
  )
}
