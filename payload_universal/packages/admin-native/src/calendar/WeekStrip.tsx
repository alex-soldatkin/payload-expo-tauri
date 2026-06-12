/**
 * WeekStrip — 7-day week-strip header for the calendar's WEEK mode, rendered
 * above the day timeline (native CalendarKit or DayListFallback).
 *
 * Locale-aware (week start from Intl.Locale weekInfo, Monday default):
 *  - day pills show the short weekday label, the day number (selected/today
 *    badge styling mirrors the month grid) and up to 3 event-presence dots;
 *  - tapping a pill fires onSelectDate('YYYY-MM-DD') — the timeline follows;
 *  - chevrons or a horizontal swipe (PanResponder — the approved JS gesture
 *    tier) page the visible week; external selection changes (Today button,
 *    native timeline day swipes) pull the strip to the selected week.
 *
 * Liquid glass card with a themed fallback; all colours via useListColors.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'

import { defaultTheme as t } from '../theme'
import { useListColors } from '../hooks/useListColors'
import type { ListColorPalette } from '../hooks/useListColors'
import {
  addDaysToKey,
  buildEventsByDateKey,
  formatWeekRangeLabel,
  getFirstDayOfWeek,
  MAX_MONTH_CELL_DOTS,
  parseDateKey,
  todayDateKey,
  weekStartKey,
} from './types'
import type { CalendarEvent } from './types'

// Optional: GlassView for the liquid glass strip card on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed */
}

// Optional: lucide chevrons (pure RN SVG) with text glyph fallbacks
let ChevronLeftIcon: React.ComponentType<{ size: number; color: string }> | null = null
let ChevronRightIcon: React.ComponentType<{ size: number; color: string }> | null = null
try {
  const lucide = require('lucide-react-native')
  ChevronLeftIcon = lucide.ChevronLeft ?? null
  ChevronRightIcon = lucide.ChevronRight ?? null
} catch {
  /* lucide-react-native not available */
}

export type WeekStripProps = {
  /** Merged event list — presence dots only (no titles at this density). */
  events: CalendarEvent[]
  /** 'YYYY-MM-DD' — highlighted pill; also seeds the visible week. */
  selectedDate: string
  onSelectDate: (iso: string) => void
}

/** Swipe must travel this far horizontally to change week. */
const SWIPE_THRESHOLD = 40

/** Short weekday label for a date key via Intl. */
const weekdayLabelFor = (dateKey: string): string => {
  const d = parseDateKey(dateKey)
  if (!d) return ''
  try {
    return d.toLocaleDateString(undefined, { weekday: 'short' })
  } catch {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] ?? ''
  }
}

export const WeekStrip: React.FC<WeekStripProps> = ({
  events,
  selectedDate,
  onSelectDate,
}) => {
  const { dark, colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const firstDayOfWeek = useMemo(getFirstDayOfWeek, [])

  const [visibleStart, setVisibleStart] = useState<string>(() =>
    weekStartKey(selectedDate, firstDayOfWeek),
  )
  const visibleStartRef = useRef(visibleStart)
  visibleStartRef.current = visibleStart

  // External selection (Today button, native timeline day swipe) pulls the
  // strip to the selected day's week.
  useEffect(() => {
    const next = weekStartKey(selectedDate, firstDayOfWeek)
    setVisibleStart((prev) => (prev === next ? prev : next))
  }, [selectedDate, firstDayOfWeek])

  const changeWeek = useCallback((delta: number) => {
    setVisibleStart(addDaysToKey(visibleStartRef.current, delta * 7))
  }, [])

  // Horizontal swipe (approved JS gesture tier) — claims only clearly
  // horizontal moves so ancestor vertical scrolling keeps working.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dx <= -SWIPE_THRESHOLD) changeWeek(1)
          else if (g.dx >= SWIPE_THRESHOLD) changeWeek(-1)
        },
      }),
    [changeWeek],
  )

  const weekKeys = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysToKey(visibleStart, i)),
    [visibleStart],
  )

  const eventsByDate = useMemo(() => buildEventsByDateKey(events), [events])
  const todayKey = todayDateKey()

  const inner = (
    <View style={styles.inner} {...panResponder.panHandlers}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => changeWeek(-1)}
          hitSlop={10}
          style={({ pressed }) => [styles.chevronBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
        >
          {ChevronLeftIcon ? (
            <ChevronLeftIcon size={18} color={colors.textMuted} />
          ) : (
            <Text style={styles.chevronGlyph}>{'‹'}</Text>
          )}
        </Pressable>
        <Text style={styles.weekTitle} numberOfLines={1}>
          {formatWeekRangeLabel(weekKeys[0], weekKeys[6])}
        </Text>
        <Pressable
          onPress={() => changeWeek(1)}
          hitSlop={10}
          style={({ pressed }) => [styles.chevronBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Next week"
        >
          {ChevronRightIcon ? (
            <ChevronRightIcon size={18} color={colors.textMuted} />
          ) : (
            <Text style={styles.chevronGlyph}>{'›'}</Text>
          )}
        </Pressable>
      </View>
      <View style={styles.pillsRow}>
        {weekKeys.map((key) => {
          const isSelected = key === selectedDate
          const isToday = key === todayKey
          const dots = (eventsByDate.get(key) ?? []).slice(0, MAX_MONTH_CELL_DOTS)
          const day = parseDateKey(key)
          return (
            <Pressable
              key={key}
              onPress={() => onSelectDate(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={key}
              style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
            >
              <Text
                style={[styles.pillWeekday, isSelected && { color: colors.text }]}
                numberOfLines={1}
              >
                {weekdayLabelFor(key)}
              </Text>
              <View
                style={[
                  styles.pillBadge,
                  isSelected && { backgroundColor: colors.primary },
                  !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.pillDay,
                    isToday && !isSelected && { color: colors.text, fontWeight: '700' },
                    isSelected && { color: colors.primaryText, fontWeight: '700' },
                  ]}
                >
                  {day ? day.getDate() : ''}
                </Text>
              </View>
              <View style={styles.dotsRow}>
                {dots.map((ev) => (
                  <View
                    key={ev.id}
                    style={[styles.dot, { backgroundColor: ev.color ?? colors.primary }]}
                  />
                ))}
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )

  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView style={styles.card} glassEffectStyle="regular">
        {inner}
      </GlassView>
    )
  }
  return <View style={[styles.card, styles.cardFallback, dark && styles.cardDark]}>{inner}</View>
}

// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    card: {
      borderRadius: 18,
      overflow: 'hidden',
      marginHorizontal: t.spacing.md,
    },
    cardFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    cardDark: {},
    inner: { paddingVertical: t.spacing.xs, paddingHorizontal: t.spacing.xs },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.spacing.sm,
      gap: t.spacing.sm,
    },
    weekTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: t.fontSize.sm,
      fontWeight: '700',
      color: c.text,
    },
    chevronBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevronGlyph: { fontSize: 20, fontWeight: '600', color: c.textMuted, lineHeight: 22 },
    pressed: { opacity: 0.7 },

    pillsRow: { flexDirection: 'row', paddingBottom: 2 },
    pill: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 4,
      borderRadius: 12,
      gap: 2,
    },
    pillWeekday: {
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      color: c.textMuted,
      textTransform: 'uppercase',
    },
    pillBadge: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    pillDay: { fontSize: t.fontSize.sm, fontWeight: '500', color: c.text },

    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 3,
      minHeight: 5,
    },
    dot: { width: 5, height: 5, borderRadius: 2.5 },
  })
