/**
 * MonthGridFallback — pure-RN 7-column month grid, used when the app's
 * native `calendar-view` module (HorizonCalendar-backed) is unavailable.
 *
 * Mirrors the native month view's contract & visuals, two densities:
 *  - compact (default / `showEventBars` false): day cells show up to
 *    MAX_MONTH_CELL_DOTS colour dots for single-day events plus underline
 *    range strips (edge-to-edge with rounded caps on the range's first/last
 *    day) for multi-day events;
 *  - regular width (`showEventBars` true, Apple-Calendar style): per week
 *    row, multi-day events render as continuous TITLED spanning bars
 *    (square continuation edges when the range wraps across week rows,
 *    title on the first cell of each week run), single-day events as
 *    tinted labelled chips, with a '+N more' overflow per cell beyond
 *    MAX_MONTH_CELL_BARS lanes;
 *  - selecting a day fires onSelectDate('YYYY-MM-DD');
 *  - chevrons or a horizontal swipe (PanResponder — the approved JS gesture
 *    tier) change the visible month → onChangeVisibleMonth.
 *
 * Locale-aware: weekday labels via Intl; the first day of week comes from
 * Intl.Locale weekInfo when the engine exposes it, defaulting to Monday.
 * Liquid glass card with a themed fallback; all colours via useListColors.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, Text, View } from 'react-native'

import { useListColors } from '../../hooks/useListColors'
import { hexToRgba } from '../../kanban/types'
import {
  buildEventsByDateKey,
  getFirstDayOfWeek,
  isMultiDayEvent,
  toDateKey,
  todayDateKey,
} from '../../scheduling'
import { MAX_MONTH_CELL_BARS, MAX_MONTH_CELL_DOTS, MAX_MONTH_CELL_STRIPS } from '../types'
import type { MonthGridFallbackProps, VisibleMonth } from './types'
import {
  BAR_BADGE_AREA,
  BAR_GAP,
  BAR_HEIGHT,
  SWIPE_THRESHOLD,
  buildEventSpans,
  buildMonthWeeks,
  buildWeekBarLayout,
  monthTitle,
  visibleMonthOf,
  weekdayLabel,
} from './utils'
import { createStyles } from './styles'

export type { MonthGridFallbackProps } from './types'

// Optional: GlassView for the liquid glass grid card on iOS 26+
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MonthGridFallback: React.FC<MonthGridFallbackProps> = ({
  events,
  selectedDate,
  onSelectDate,
  onChangeVisibleMonth,
  showEventBars = false,
  fillHeight = false,
}) => {
  const { dark, colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const firstDayOfWeek = useMemo(getFirstDayOfWeek, [])
  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, col) => weekdayLabel((firstDayOfWeek + col) % 7)),
    [firstDayOfWeek],
  )

  const [visible, setVisible] = useState<VisibleMonth>(() => visibleMonthOf(selectedDate))
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  // External selection (e.g. the Today button) pulls the grid to its month.
  useEffect(() => {
    const next = visibleMonthOf(selectedDate)
    setVisible((prev) =>
      prev.year === next.year && prev.month === next.month ? prev : next,
    )
  }, [selectedDate])

  const changeMonth = useCallback(
    (delta: number) => {
      const cur = visibleRef.current
      const d = new Date(cur.year, cur.month - 1 + delta, 1)
      const next = { year: d.getFullYear(), month: d.getMonth() + 1 }
      setVisible(next)
      onChangeVisibleMonth?.(next)
    },
    [onChangeVisibleMonth],
  )

  // Horizontal swipe (approved JS gesture tier) — claims only clearly
  // horizontal moves so any ancestor vertical scrolling keeps working.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dx <= -SWIPE_THRESHOLD) changeMonth(1)
          else if (g.dx >= SWIPE_THRESHOLD) changeMonth(-1)
        },
      }),
    [changeMonth],
  )

  const weeks = useMemo(
    () => buildMonthWeeks(visible.year, visible.month, firstDayOfWeek),
    [visible, firstDayOfWeek],
  )

  const eventsByDate = useMemo(() => buildEventsByDateKey(events), [events])
  const eventSpans = useMemo(
    () => (showEventBars ? buildEventSpans(events) : []),
    [showEventBars, events],
  )
  const todayKey = todayDateKey()

  const renderCell = (date: Date) => {
    const key = toDateKey(date)
    const inMonth = date.getMonth() === visible.month - 1
    const isSelected = key === selectedDate
    const isToday = key === todayKey
    const bucket = eventsByDate.get(key) ?? []
    const strips = bucket.filter(isMultiDayEvent).slice(0, MAX_MONTH_CELL_STRIPS)
    const dots = bucket.filter((ev) => !isMultiDayEvent(ev)).slice(0, MAX_MONTH_CELL_DOTS)

    return (
      <Pressable
        key={key}
        style={({ pressed }) => [styles.col, styles.cell, pressed && styles.cellPressed]}
        onPress={() => onSelectDate(key)}
        accessibilityRole="button"
        accessibilityLabel={key}
      >
        {/* State language (shared with WeekStrip): SELECTED = filled primary
            pill; TODAY (unselected) = primary RING + primary bold number —
            today stays visibly distinct from a selected day in both schemes. */}
        <View
          style={[
            styles.dayBadge,
            isSelected && { backgroundColor: colors.primary },
            !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.primary },
          ]}
        >
          <Text
            style={[
              styles.dayText,
              !inMonth && { color: colors.textPlaceholder },
              isToday && !isSelected && { color: colors.primary, fontWeight: '700' },
              isSelected && { color: colors.primaryText, fontWeight: '700' },
            ]}
          >
            {date.getDate()}
          </Text>
        </View>
        <View style={styles.stripsArea}>
          {strips.map((ev) => {
            const startsHere = toDateKey(new Date(ev.start)) === key
            const endsHere = ev.end ? toDateKey(new Date(ev.end)) === key : startsHere
            return (
              <View
                key={ev.id}
                style={[
                  styles.strip,
                  { backgroundColor: ev.color ?? colors.primary, opacity: inMonth ? 1 : 0.35 },
                  startsHere && styles.stripStart,
                  endsHere && styles.stripEnd,
                ]}
              />
            )
          })}
        </View>
        <View style={styles.dotsRow}>
          {dots.map((ev) => (
            <View
              key={ev.id}
              style={[
                styles.dot,
                { backgroundColor: ev.color ?? colors.primary, opacity: inMonth ? 1 : 0.35 },
              ]}
            />
          ))}
        </View>
      </Pressable>
    )
  }

  // ── Bars density (showEventBars) — pressable day cells under a
  // pointer-transparent absolutely-positioned bar overlay per week row ──

  const renderBarsCell = (date: Date) => {
    const key = toDateKey(date)
    const inMonth = date.getMonth() === visible.month - 1
    const isSelected = key === selectedDate
    const isToday = key === todayKey
    return (
      <Pressable
        key={key}
        style={({ pressed }) => [
          styles.col,
          styles.barsCell,
          fillHeight ? styles.barsCellGrow : styles.barsCellFixed,
          pressed && styles.cellPressed,
        ]}
        onPress={() => onSelectDate(key)}
        accessibilityRole="button"
        accessibilityLabel={key}
      >
        {/* State language (shared with WeekStrip): SELECTED = filled primary
            pill; TODAY (unselected) = primary RING + primary bold number —
            today stays visibly distinct from a selected day in both schemes. */}
        <View
          style={[
            styles.dayBadge,
            isSelected && { backgroundColor: colors.primary },
            !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.primary },
          ]}
        >
          <Text
            style={[
              styles.dayText,
              !inMonth && { color: colors.textPlaceholder },
              isToday && !isSelected && { color: colors.primary, fontWeight: '700' },
              isSelected && { color: colors.primaryText, fontWeight: '700' },
            ]}
          >
            {date.getDate()}
          </Text>
        </View>
      </Pressable>
    )
  }

  const renderBarsWeek = (week: Date[], wi: number) => {
    const weekKeys = week.map(toDateKey)
    const { segments, overflow } = buildWeekBarLayout(weekKeys, eventSpans)
    return (
      <View key={`w-${wi}`} style={[styles.barsWeekWrap, fillHeight && styles.weekRowFill]}>
        <View style={[styles.weekRow, fillHeight && styles.flexFill]}>
          {week.map(renderBarsCell)}
        </View>
        {/* Bar/overflow lanes — pinned to the TOP of the week row at a fixed
            height (NOT absoluteFill). In fillHeight the row flexes tall; an
            absoluteFill overlay would let the fixed-top bars read as floating
            mid-cell once the cell grew. Pinning the block to the top keeps the
            bars stacked tight under the number row, with the flexible empty
            space falling BELOW the block (Apple Calendar layout). */}
        <View style={styles.barsOverlay} pointerEvents="none">
          {segments.map((seg) => {
            const color = seg.event.color ?? colors.primary
            return (
              <View
                key={seg.event.id}
                style={[
                  styles.barSlot,
                  {
                    left: `${(seg.startCol / 7) * 100}%`,
                    width: `${((seg.endCol - seg.startCol + 1) / 7) * 100}%`,
                    top: BAR_BADGE_AREA + seg.lane * (BAR_HEIGHT + BAR_GAP),
                    // Continuation treatment: runs wrapping across week rows
                    // keep square, edge-to-edge leading/trailing edges.
                    paddingLeft: seg.continuesBefore ? 0 : 2,
                    paddingRight: seg.continuesAfter ? 0 : 2,
                  },
                ]}
              >
                <View
                  style={[
                    styles.barInner,
                    seg.multiDay
                      ? { backgroundColor: color }
                      : { backgroundColor: hexToRgba(color, dark ? 0.32 : 0.16) },
                    seg.continuesBefore && styles.barNoLeftRadius,
                    seg.continuesAfter && styles.barNoRightRadius,
                  ]}
                >
                  {/* Title on the first cell of each week run */}
                  <Text
                    style={[
                      styles.barTitle,
                      // White on the solid accent bar; themed text on the tint
                      seg.multiDay ? styles.barTitleOnAccent : { color: colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {seg.event.title}
                  </Text>
                </View>
              </View>
            )
          })}
          {overflow.map((count, col) =>
            count > 0 ? (
              <Text
                key={`of-${col}`}
                style={[
                  styles.barOverflow,
                  {
                    left: `${(col / 7) * 100}%`,
                    width: `${100 / 7}%`,
                    top: BAR_BADGE_AREA + MAX_MONTH_CELL_BARS * (BAR_HEIGHT + BAR_GAP),
                  },
                ]}
                numberOfLines={1}
              >
                {`+${count} more`}
              </Text>
            ) : null,
          )}
        </View>
      </View>
    )
  }

  const inner = (
    <View style={[styles.inner, fillHeight && styles.flexFill]} {...panResponder.panHandlers}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => changeMonth(-1)}
          hitSlop={10}
          style={({ pressed }) => [styles.chevronBtn, pressed && styles.cellPressed]}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          {ChevronLeftIcon ? (
            <ChevronLeftIcon size={20} color={colors.textMuted} />
          ) : (
            <Text style={styles.chevronGlyph}>{'‹'}</Text>
          )}
        </Pressable>
        <Text style={styles.monthTitle} numberOfLines={1}>
          {monthTitle(visible.year, visible.month)}
        </Text>
        <Pressable
          onPress={() => changeMonth(1)}
          hitSlop={10}
          style={({ pressed }) => [styles.chevronBtn, pressed && styles.cellPressed]}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          {ChevronRightIcon ? (
            <ChevronRightIcon size={20} color={colors.textMuted} />
          ) : (
            <Text style={styles.chevronGlyph}>{'›'}</Text>
          )}
        </Pressable>
      </View>
      {/* Weekday header cells share styles.col with the day cells below —
          BOTH rows are 7 × col inside the same inner width, so header label
          i and day column i always align (see styles.col). */}
      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label, i) => (
          <View key={`wd-${i}`} style={styles.col}>
            <Text style={styles.weekdayLabel} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>
      {weeks.map((week, wi) =>
        showEventBars ? (
          renderBarsWeek(week, wi)
        ) : (
          <View key={`w-${wi}`} style={[styles.weekRow, fillHeight && styles.weekRowFill]}>
            {week.map(renderCell)}
          </View>
        ),
      )}
    </View>
  )

  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView style={[styles.card, fillHeight && styles.cardFill]} glassEffectStyle="regular">
        {inner}
      </GlassView>
    )
  }
  return (
    <View
      style={[
        styles.card,
        styles.cardFallback,
        fillHeight && styles.cardFill,
        dark && styles.cardDark,
      ]}
    >
      {inner}
    </View>
  )
}
