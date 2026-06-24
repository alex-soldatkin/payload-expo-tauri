/**
 * Gantt header row — mirrors the calendar's glass header tier (segmented +
 * Today + legend chips). The calendar's header lives INSIDE the native
 * CalendarView (read-only reference), so this replicates the SAME visual:
 * one glass card, S/M/L segmented zoom (SegmentedIndexPicker — the calendar's
 * Month/Week/Day picker), a bordered "Today" pill and source-tinted legend
 * chips (filled + check when ON, outlined + dot when OFF) — identical
 * behaviour so the two scheduling views feel the same.
 */
import React, { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import {
  defaultTheme,
  GANTT_CHART_DEFAULT_PX_PER_DAY,
  hexToRgba,
  SegmentedIndexPicker,
  useListColors,
  type CalendarSource,
} from '@payload-universal/admin-native'

// Optional liquid glass — same optional-require + fallback the calendar/gantt
// chrome use (glass is background-only; content sits as plain RN siblings).
let GanttHeaderGlass: React.ComponentType<any> | null = null
let ganttHeaderGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GanttHeaderGlass = glassModule.GlassView
  ganttHeaderGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed — themed fallback renders */
}

const GANTT_ZOOM_LABELS = ['S', 'M', 'L']
const GANTT_ZOOM_PX = [16, GANTT_CHART_DEFAULT_PX_PER_DAY, 44]
const gt = defaultTheme

export type GanttHeaderRowProps = {
  /** Currently-effective day-column width (config ?? component default). */
  effectivePx: number
  /** Configured sources (with `hidden` flags) — one legend chip each. */
  sources: CalendarSource[]
  onZoom: (px: number) => void
  onToday: () => void
  onToggleSource: (id: string) => void
}

export function GanttHeaderRow({
  effectivePx,
  sources,
  onZoom,
  onToday,
  onToggleSource,
}: GanttHeaderRowProps) {
  const { dark, colors: c } = useListColors()
  const styles = useMemo(() => createGanttHeaderStyles(c), [c])

  // Active zoom segment: an unset/custom px (e.g. a pinch result) matches no
  // segment → index −1, so none highlights until a preset is tapped.
  const zoomIndex = GANTT_ZOOM_PX.indexOf(effectivePx)

  const legendChips = sources.map((source) => {
    const visible = source.hidden !== true
    return (
      <Pressable
        key={source.id}
        onPress={() => onToggleSource(source.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: visible }}
        style={({ pressed }) => [
          styles.chip,
          visible
            ? {
                borderColor: hexToRgba(source.color, 0.55),
                backgroundColor: hexToRgba(source.color, dark ? 0.3 : 0.16),
              }
            : { borderColor: c.border, backgroundColor: 'transparent' },
          pressed && styles.chipPressed,
        ]}
      >
        {visible ? (
          <Check size={12} color={c.text} strokeWidth={3} />
        ) : (
          <View style={[styles.chipDot, { backgroundColor: source.color }]} />
        )}
        <Text
          style={[styles.chipLabel, !visible && { color: c.textPlaceholder }]}
          numberOfLines={1}
        >
          {source.label}
        </Text>
      </Pressable>
    )
  })

  const inner = (
    <View style={styles.headerRow}>
      <View style={styles.zoomWrap}>
        <SegmentedIndexPicker
          labels={GANTT_ZOOM_LABELS}
          selectedIndex={zoomIndex}
          onSelect={(i) => onZoom(GANTT_ZOOM_PX[i] ?? GANTT_CHART_DEFAULT_PX_PER_DAY)}
        />
      </View>
      <Pressable
        onPress={onToday}
        accessibilityRole="button"
        accessibilityLabel="Go to today"
        style={({ pressed }) => [styles.todayBtn, pressed && styles.todayPressed]}
      >
        <Text style={styles.todayLabel}>Today</Text>
      </Pressable>
      {legendChips.length > 0 && <View style={styles.divider} />}
      {legendChips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.legendScroll}
          contentContainerStyle={styles.legendRow}
        >
          {legendChips}
        </ScrollView>
      )}
    </View>
  )

  return (
    <View style={styles.wrap}>
      {ganttHeaderGlassAvailable && GanttHeaderGlass ? (
        <GanttHeaderGlass style={styles.card} glassEffectStyle="regular">
          {inner}
        </GanttHeaderGlass>
      ) : (
        <View style={[styles.card, styles.cardFallback]}>{inner}</View>
      )}
    </View>
  )
}

const createGanttHeaderStyles = (c: ReturnType<typeof useListColors>['colors']) =>
  StyleSheet.create({
    // Mirrors the calendar compact header spacing (md/sm/xs grid steps).
    wrap: {
      paddingHorizontal: gt.spacing.md,
      paddingTop: gt.spacing.sm,
      paddingBottom: gt.spacing.xs,
    },
    card: { borderRadius: 18, overflow: 'hidden' },
    cardFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: gt.spacing.sm,
      paddingHorizontal: gt.spacing.sm,
      paddingVertical: 6,
    },
    // Fixed width keeps the S/M/L segment compact (the legend takes the rest).
    zoomWrap: { width: 132 },
    // Bordered, surface-transparent "Today" pill (calendar's embedded variant —
    // glass-in-glass renders poorly, so the chip is a hairline border).
    todayBtn: {
      borderRadius: 16,
      paddingVertical: 7,
      paddingHorizontal: gt.spacing.md,
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    todayPressed: { opacity: 0.7 },
    todayLabel: { fontSize: gt.fontSize.sm, fontWeight: '600', color: c.text },
    divider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      marginVertical: gt.spacing.xs,
      backgroundColor: c.hairline,
    },
    legendScroll: { flex: 1 },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: gt.spacing.sm,
      paddingRight: gt.spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    chipPressed: { opacity: 0.7 },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipLabel: { fontSize: gt.fontSize.xs, fontWeight: '600', color: c.text, maxWidth: 160 },
  })
