/**
 * Horizontal scrollable row of active filter chips with remove buttons.
 * Shows a "+ Filter" chip at the end to add new filters.
 */
import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { ActiveFilter } from './useDocumentListFilters'
import { defaultTheme as t } from './theme'

type Props = {
  filters: ActiveFilter[]
  onRemove: (id: string) => void
  onClearAll: () => void
  onAddFilter: () => void
  searchText?: string
}

const formatValue = (value: unknown): string => {
  if (value === true) return 'true'
  if (value === false) return 'false'
  if (value == null) return ''
  const s = String(value)
  return s.length > 20 ? s.slice(0, 20) + '…' : s
}

export const FilterChips: React.FC<Props> = ({
  filters,
  onRemove,
  onClearAll,
  onAddFilter,
  searchText,
}) => {
  const hasAny = filters.length > 0 || (searchText && searchText.trim().length > 0)
  if (!hasAny) return null

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {searchText && searchText.trim().length > 0 && (
          <View style={[styles.chip, styles.searchChip]}>
            <Text style={styles.chipText} numberOfLines={1}>
              Search: "{searchText.trim()}"
            </Text>
          </View>
        )}

        {filters.map((f) => (
          <View key={f.id} style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {f.fieldLabel} {f.operatorLabel} {formatValue(f.value)}
            </Text>
            <Pressable onPress={() => onRemove(f.id)} hitSlop={8}>
              <Text style={styles.chipRemove}>✕</Text>
            </Pressable>
          </View>
        ))}

        <Pressable style={styles.addChip} onPress={onAddFilter}>
          <Text style={styles.addChipText}>+ Filter</Text>
        </Pressable>

        {(filters.length > 0) && (
          <Pressable style={styles.clearBtn} onPress={onClearAll}>
            <Text style={styles.clearText}>Clear all</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: t.spacing.sm },
  scroll: { paddingHorizontal: t.spacing.lg, gap: t.spacing.sm, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 20,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
    gap: t.spacing.xs,
  },
  searchChip: { backgroundColor: '#f0f0f0' },
  chipText: { fontSize: t.fontSize.xs, color: t.colors.text, maxWidth: 180 },
  chipRemove: { fontSize: 12, color: t.colors.textMuted, fontWeight: '700' },
  addChip: {
    borderWidth: 1,
    borderColor: t.colors.primary,
    borderRadius: 20,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
    borderStyle: 'dashed',
  },
  addChipText: { fontSize: t.fontSize.xs, color: t.colors.primary, fontWeight: '600' },
  clearBtn: { paddingHorizontal: t.spacing.sm, paddingVertical: t.spacing.xs },
  clearText: { fontSize: t.fontSize.xs, color: t.colors.destructive },
})
