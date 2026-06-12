/**
 * Horizontal scrollable row of active filter chips with remove buttons.
 * Tap a chip to re-open the filter editor pre-filled (`onEdit`); the ✕
 * removes it. Shows a "+ Filter" chip at the end to add new filters.
 *
 * Chips cluster by OR-group (web WhereBuilder parity): conditions within a
 * group AND together and sit side by side; an 'or' micro-label divider
 * separates the clusters. Grouping is derived from each filter's
 * `groupIndex`, so the props contract stays the flat `filters` array.
 *
 * Chips use liquid glass on iOS 26+ (GlassView) with a themed fallback,
 * and follow the system colour scheme.
 */
import React, { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { ActiveFilter } from './hooks/useDocumentListFilters'
import { useListColors } from './hooks/useListColors'
import type { ListColorPalette } from './hooks/useListColors'
import { defaultTheme as t } from './theme'

// Optional: GlassView for liquid glass chips on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed */
}

type Props = {
  filters: ActiveFilter[]
  onRemove: (id: string) => void
  onClearAll: () => void
  onAddFilter: () => void
  /** Tap a chip to re-open the filter editor pre-filled. */
  onEdit?: (filter: ActiveFilter) => void
  searchText?: string
}

const truncate = (s: string): string => (s.length > 24 ? s.slice(0, 24) + '…' : s)

const formatValue = (filter: ActiveFilter): string => {
  if (filter.valueLabel) return truncate(filter.valueLabel)
  const { value } = filter
  if (value === true) return 'true'
  if (value === false) return 'false'
  if (value == null) return ''
  if (Array.isArray(value)) return truncate(value.map(String).join(', '))
  const s = String(value)
  // ISO date strings — format nicely
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }
  return truncate(s)
}

/** Chip surface — GlassView on iOS 26+, themed View elsewhere. */
const ChipSurface: React.FC<{
  layoutStyle: object
  fallbackStyle: object
  children: React.ReactNode
}> = ({ layoutStyle, fallbackStyle, children }) => {
  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView style={layoutStyle} glassEffectStyle="regular">
        {children}
      </GlassView>
    )
  }
  return <View style={[layoutStyle, fallbackStyle]}>{children}</View>
}

export const FilterChips: React.FC<Props> = ({
  filters,
  onRemove,
  onClearAll,
  onAddFilter,
  onEdit,
  searchText,
}) => {
  const { colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  // Cluster chips by OR-group (derived from each filter's groupIndex)
  const groups = useMemo(() => {
    const byGroup: ActiveFilter[][] = []
    for (const f of filters) {
      const gi = f.groupIndex ?? 0
      if (!byGroup[gi]) byGroup[gi] = []
      byGroup[gi].push(f)
    }
    return byGroup.filter((g) => g && g.length > 0)
  }, [filters])

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
          <ChipSurface layoutStyle={styles.chip} fallbackStyle={styles.searchChipFallback}>
            <Text style={styles.chipText} numberOfLines={1}>
              Search: "{searchText.trim()}"
            </Text>
          </ChipSurface>
        )}

        {groups.map((group, gi) => (
          <React.Fragment key={group[0].id}>
            {gi > 0 && (
              <View style={styles.orDivider}>
                <View style={styles.orDividerLine} />
                <Text style={styles.orDividerText}>or</Text>
                <View style={styles.orDividerLine} />
              </View>
            )}
            {group.map((f) => (
              <Pressable
                key={f.id}
                onPress={onEdit ? () => onEdit(f) : undefined}
                disabled={!onEdit}
              >
                <ChipSurface layoutStyle={styles.chip} fallbackStyle={styles.chipFallback}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {f.fieldLabel} {f.operatorLabel} {formatValue(f)}
                  </Text>
                  <Pressable onPress={() => onRemove(f.id)} hitSlop={8}>
                    <Text style={styles.chipRemove}>✕</Text>
                  </Pressable>
                </ChipSurface>
              </Pressable>
            ))}
          </React.Fragment>
        ))}

        <Pressable style={styles.addChip} onPress={onAddFilter}>
          <Text style={styles.addChipText}>+ Filter</Text>
        </Pressable>

        {filters.length > 0 && (
          <Pressable style={styles.clearBtn} onPress={onClearAll}>
            <Text style={styles.clearText}>Clear all</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  )
}

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    container: { marginBottom: t.spacing.sm },
    scroll: { paddingHorizontal: t.spacing.lg, gap: t.spacing.sm, alignItems: 'center' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 20,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs + 2,
      gap: t.spacing.xs,
      overflow: 'hidden',
    },
    chipFallback: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchChipFallback: {
      backgroundColor: c.pressed,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipText: { fontSize: t.fontSize.xs, color: c.text, maxWidth: 180 },
    chipRemove: { fontSize: 12, color: c.textMuted, fontWeight: '700' },
    // 'or' micro-label between OR-group chip clusters
    orDivider: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 1 },
    orDividerLine: { width: StyleSheet.hairlineWidth + 0.5, height: 12, backgroundColor: c.hairline },
    orDividerText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    addChip: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: 20,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs + 2,
      borderStyle: 'dashed',
    },
    addChipText: { fontSize: t.fontSize.xs, color: c.primary, fontWeight: '600' },
    clearBtn: { paddingHorizontal: t.spacing.sm, paddingVertical: t.spacing.xs },
    clearText: { fontSize: t.fontSize.xs, color: c.destructive },
  })
