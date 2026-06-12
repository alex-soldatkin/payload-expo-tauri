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
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'

import { defaultTheme as t } from '../theme'
import { useListColors } from '../hooks/useListColors'
import type { ListColorPalette } from '../hooks/useListColors'
import { hexToRgba } from '../kanban/types'
import {
  buildEventsByDateKey,
  getFirstDayOfWeek,
  isMultiDayEvent,
  MAX_MONTH_CELL_BARS,
  MAX_MONTH_CELL_DOTS,
  MAX_MONTH_CELL_STRIPS,
  parseDateKey,
  toDateKey,
  todayDateKey,
} from './types'
import type { CalendarEvent } from './types'

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

export type MonthGridFallbackProps = {
  /** Merged event list (multi-day events bucket onto every covered day). */
  events: CalendarEvent[]
  /** 'YYYY-MM-DD' — highlighted cell; also seeds the visible month. */
  selectedDate: string
  onSelectDate: (iso: string) => void
  /** Fires after chevron/swipe month changes (month is 1-12). */
  onChangeVisibleMonth?: (visible: { year: number; month: number }) => void
  /**
   * Regular-width density: titled spanning bars (multi-day) + labelled chips
   * (single-day) per week row instead of dots/strips. Default false (dots).
   */
  showEventBars?: boolean
  /**
   * iPad-class layout: the grid card stretches to fill the available height —
   * week rows flex evenly (with hairline separators, Apple Calendar style),
   * the weekday header row stays pinned. Default false (intrinsic height).
   */
  fillHeight?: boolean
}

/** Swipe must travel this far horizontally to change month. */
const SWIPE_THRESHOLD = 40

// ── Event-bar metrics (showEventBars density) ──────────────────────────────
/** Day-number badge zone height at the top of a bars-mode cell. */
const BAR_BADGE_AREA = 30
const BAR_HEIGHT = 16
const BAR_GAP = 2
/** '+N more' overflow line height below the lanes. */
const BAR_OVERFLOW_HEIGHT = 14
const BARS_CELL_HEIGHT =
  BAR_BADGE_AREA + MAX_MONTH_CELL_BARS * (BAR_HEIGHT + BAR_GAP) + BAR_OVERFLOW_HEIGHT

// ---------------------------------------------------------------------------
// Locale helpers (module-level — locale doesn't change while mounted)
// ---------------------------------------------------------------------------

const FALLBACK_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Short weekday label for a JS day index via Intl (2024-01-07 was a Sunday). */
const weekdayLabel = (jsDay: number): string => {
  try {
    return new Date(2024, 0, 7 + jsDay).toLocaleDateString(undefined, { weekday: 'short' })
  } catch {
    return FALLBACK_WEEKDAYS[jsDay] ?? ''
  }
}

const monthTitle = (year: number, month: number): string => {
  try {
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return `${year}-${String(month).padStart(2, '0')}`
  }
}

/**
 * All cell dates for a month (1-12) as full weeks starting on firstDayOfWeek.
 *
 * Column-placement self-check (JS getDay() is Sun=0…Sat=6; Mon-start weeks
 * use firstDayOfWeek=1, so a date's column is (getDay()-1+7)%7 ≡ (getDay()+6)%7):
 *   - 2026-08-01 is a Saturday (getDay()=6) → offset (6+6)%7 = 5 → August
 *     2026's first week starts on Mon 2026-07-27;
 *   - 2026-08-02 is a Sunday (getDay()=0) → column (0+6)%7 = 6 → it renders
 *     in the LAST column of a MON…SUN header, never under TUE.
 * Days fill each week sequentially from that start, so cell column i always
 * holds weekday (firstDayOfWeek + i) % 7 — exactly the header label order
 * built in `weekdayLabels` below.
 */
const buildMonthWeeks = (year: number, month: number, firstDayOfWeek: number): Date[][] => {
  const first = new Date(year, month - 1, 1)
  const offset = (first.getDay() - firstDayOfWeek + 7) % 7
  const cursor = new Date(year, month - 1, 1 - offset)
  const weeks: Date[][] = []
  do {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  } while (cursor.getMonth() === month - 1)
  return weeks
}

type VisibleMonth = { year: number; month: number }

const visibleMonthOf = (dateKey: string): VisibleMonth => {
  const d = parseDateKey(dateKey) ?? new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

// ---------------------------------------------------------------------------
// Event-bar lane layout (showEventBars density) — pure week-row packing
// ---------------------------------------------------------------------------

/** An event with its covered local date-key span (end clamps to >= start). */
type EventSpan = { event: CalendarEvent; startKey: string; endKey: string }

/** One placed bar/chip within a week row. Columns are 0-6 (clamped). */
type WeekBarSegment = {
  event: CalendarEvent
  lane: number
  startCol: number
  endCol: number
  /** Range continues from an earlier week row → square leading edge. */
  continuesBefore: boolean
  /** Range continues into a later week row → square trailing edge. */
  continuesAfter: boolean
  /** Multi-day → solid spanning bar; single-day → tinted labelled chip. */
  multiDay: boolean
}

const buildEventSpans = (events: CalendarEvent[]): EventSpan[] => {
  const out: EventSpan[] = []
  for (const event of events) {
    const start = new Date(event.start)
    if (Number.isNaN(start.getTime())) continue
    const startKey = toDateKey(start)
    let endKey = startKey
    if (event.end) {
      const end = new Date(event.end)
      if (!Number.isNaN(end.getTime())) endKey = toDateKey(end)
    }
    if (endKey < startKey) endKey = startKey
    out.push({ event, startKey, endKey })
  }
  // Apple-style stacking: earlier start first, longer span wins ties — long
  // bars claim the top lanes so week runs stay visually continuous.
  out.sort((a, b) =>
    a.startKey !== b.startKey
      ? a.startKey.localeCompare(b.startKey)
      : b.endKey.localeCompare(a.endKey),
  )
  return out
}

/**
 * Pack a week row's overlapping events into MAX_MONTH_CELL_BARS lanes
 * (first-fit by sorted span order). Events that don't fit add to the per-cell
 * '+N more' overflow counts instead.
 */
const buildWeekBarLayout = (
  weekKeys: string[],
  spans: EventSpan[],
): { segments: WeekBarSegment[]; overflow: number[] } => {
  const firstKey = weekKeys[0]
  const lastKey = weekKeys[6]
  const occupied: boolean[][] = [] // [lane][col]
  const segments: WeekBarSegment[] = []
  const overflow = new Array(7).fill(0) as number[]
  for (const { event, startKey, endKey } of spans) {
    if (endKey < firstKey || startKey > lastKey) continue
    const continuesBefore = startKey < firstKey
    const continuesAfter = endKey > lastKey
    const startCol = continuesBefore ? 0 : weekKeys.indexOf(startKey)
    const endCol = continuesAfter ? 6 : weekKeys.indexOf(endKey)
    if (startCol === -1 || endCol === -1 || endCol < startCol) continue
    let lane = 0
    while (
      lane < MAX_MONTH_CELL_BARS &&
      occupied[lane]?.slice(startCol, endCol + 1).some(Boolean)
    ) {
      lane += 1
    }
    if (lane >= MAX_MONTH_CELL_BARS) {
      for (let col = startCol; col <= endCol; col += 1) overflow[col] += 1
      continue
    }
    if (!occupied[lane]) occupied[lane] = new Array(7).fill(false) as boolean[]
    for (let col = startCol; col <= endCol; col += 1) occupied[lane][col] = true
    segments.push({
      event,
      lane,
      startCol,
      endCol,
      continuesBefore,
      continuesAfter,
      multiDay: startKey !== endKey,
    })
  }
  return { segments, overflow }
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
              isToday && !isSelected && { color: colors.text, fontWeight: '700' },
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
              isToday && !isSelected && { color: colors.text, fontWeight: '700' },
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
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
    /** fillHeight: the card owns its pane (the parent provides the insets). */
    cardFill: { flex: 1, marginHorizontal: 0 },
    inner: { paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.xs },
    flexFill: { flex: 1 },
    /** fillHeight week rows: share the leftover height, Apple-style hairlines. */
    weekRowFill: {
      flex: 1,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairline,
    },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.spacing.sm,
      marginBottom: t.spacing.xs,
      gap: t.spacing.sm,
    },
    monthTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: t.fontSize.md,
      fontWeight: '700',
      color: c.text,
    },
    chevronBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevronGlyph: { fontSize: 22, fontWeight: '600', color: c.textMuted, lineHeight: 24 },

    /**
     * THE shared per-column metric (squished-grid guard): every column —
     * weekday header cell, dots-density day cell, bars-density day cell —
     * derives its width from this one style, and all three rows
     * (weekdayRow / weekRow / barsWeekWrap>weekRow) stretch to the same
     * `inner` width. flex:1 + minWidth:0 ⇒ exactly 1/7 each at every width
     * tier (incl. fillHeight), so the header can never spread full-width
     * while the day cells compress (the iPad squish bug). Never give a
     * column an intrinsic width or a different flex value.
     */
    col: { flex: 1, minWidth: 0 },

    weekdayRow: { flexDirection: 'row', marginBottom: 2 },
    weekdayLabel: {
      textAlign: 'center',
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      color: c.textMuted,
      textTransform: 'uppercase',
    },

    weekRow: { flexDirection: 'row' },
    /** Day cell extras — column width comes ONLY from styles.col. */
    cell: {
      minHeight: 52,
      alignItems: 'stretch',
      paddingTop: 3,
      borderRadius: 10,
    },
    cellPressed: { backgroundColor: c.pressed },
    dayBadge: {
      alignSelf: 'center',
      minWidth: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    dayText: { fontSize: t.fontSize.sm, fontWeight: '500', color: c.text },

    stripsArea: { marginTop: 2, gap: 2, minHeight: 0 },
    strip: { height: 3 },
    stripStart: {
      marginLeft: 3,
      borderTopLeftRadius: 1.5,
      borderBottomLeftRadius: 1.5,
    },
    stripEnd: {
      marginRight: 3,
      borderTopRightRadius: 1.5,
      borderBottomRightRadius: 1.5,
    },

    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 3,
      marginTop: 3,
      minHeight: 5,
    },
    dot: { width: 5, height: 5, borderRadius: 2.5 },

    // ── Bars density (showEventBars) ──
    barsWeekWrap: { position: 'relative' },
    /** Day cell extras — column width comes ONLY from styles.col. */
    barsCell: {
      alignItems: 'stretch',
      paddingTop: 3,
      borderRadius: 10,
    },
    barsCellFixed: { height: BARS_CELL_HEIGHT },
    /** fillHeight: rows flex — keep the lane area as the floor, grow beyond. */
    barsCellGrow: { minHeight: BARS_CELL_HEIGHT },
    barSlot: { position: 'absolute', height: BAR_HEIGHT },
    barInner: {
      flex: 1,
      borderRadius: 4,
      justifyContent: 'center',
      paddingHorizontal: 4,
      overflow: 'hidden',
    },
    barNoLeftRadius: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
    barNoRightRadius: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
    barTitle: { fontSize: 10, fontWeight: '600' },
    // Solid accent bars need fixed light text regardless of theme — the bar
    // background is the source colour, not a themed surface.
    barTitleOnAccent: { color: '#FFFFFF' },
    barOverflow: {
      position: 'absolute',
      fontSize: 10,
      fontWeight: '600',
      color: c.textMuted,
      textAlign: 'center',
      height: BAR_OVERFLOW_HEIGHT,
    },
  })
