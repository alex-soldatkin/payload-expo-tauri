/**
 * DocumentListTable header band — sticky glass strip hosting the horizontal
 * scroll driver (the ONE real horizontal ScrollView of the whole table).
 * See ../index.tsx for the structure decision rationale.
 */
import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import type { ScrollView } from 'react-native'

import type { ListColorPalette } from '../../hooks/useListColors'
import { styles } from '../styles'
import { TABLE_TITLE_COLUMN_WIDTH } from '../types'
import type { DocumentListTableColumn, TableSort } from '../types'

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
