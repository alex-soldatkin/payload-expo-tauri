/**
 * Filter-chips strip shown above the kanban / calendar / gantt boards — the
 * screen-hosted instance of the same chips DocumentList shows internally in
 * table mode. Identical across all three overlay views, so it lives here to
 * avoid triplicating the JSX. Renders nothing when no filters are active.
 */
import React from 'react'
import { View } from 'react-native'
import { FilterChips, type ActiveFilter } from '@payload-universal/admin-native'

export type BoardFilterChipsProps = {
  hasActiveFilters: boolean
  filters: ActiveFilter[]
  searchText: string
  onRemove: (id: string) => void
  onClearAll: () => void
  onAddFilter: () => void
  onEdit: (f: ActiveFilter) => void
}

export function BoardFilterChips({
  hasActiveFilters,
  filters,
  searchText,
  onRemove,
  onClearAll,
  onAddFilter,
  onEdit,
}: BoardFilterChipsProps) {
  if (!hasActiveFilters) return null
  return (
    <View style={{ marginBottom: 4 }}>
      <FilterChips
        filters={filters}
        searchText={searchText}
        onRemove={onRemove}
        onClearAll={onClearAll}
        onAddFilter={onAddFilter}
        onEdit={onEdit}
      />
    </View>
  )
}
