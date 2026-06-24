/**
 * DayListFallback — pure-RN day TIMELINE with a full 24-hour grid, used when
 * the app's native `calendar-view` module (CalendarKit DayView timeline) is
 * unavailable.
 *
 * Mirrors the native day view's contract: { events, date, onPressEvent } —
 * events are filtered to the given local date here; tapping a row fires
 * onPressEvent(event.id) and the screen maps the `{docId}::{sourceId}` id
 * back to its doc.
 *
 * Layout (Apple Calendar day-timeline semantics):
 *  - an "All day" section (allDay events + ranges continuing from an earlier
 *    day) pinned above the grid;
 *  - ALL 24 hour slots render as fixed-minimum-height rows with a leading
 *    hour gutter and a hairline per hour — empty hours stay visible so the
 *    surface reads as a timeline, not a sparse list. Events stack inside
 *    their start hour's slot (the slot grows; no absolute event positioning —
 *    rows are the shared CalendarEventRow, same as the month-mode day list);
 *  - INITIAL SCROLL: never 00:00 — the list opens at 07:00, or at (current
 *    hour − 1) when the displayed day is today. Slot y-offsets are measured
 *    via onLayout (slots grow with events, so arithmetic alone would drift)
 *    and the scroll applies once per `date` from onContentSizeChange;
 *  - NOW LINE: on today only, a red (destructive-token) hairline + leading
 *    dot absolutely positioned inside the current hour's slot at the minute
 *    fraction, refreshed on a 60s tick. Mirrors CalendarKit's built-in
 *    current-time indicator on the native tier.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { defaultTheme as t } from '../theme'
import { useListColors } from '../hooks/useListColors'
import type { ListColorPalette } from '../hooks/useListColors'
import { eventOccursOnDate, formatEventTimeRange, toDateKey, todayDateKey } from '../scheduling'
import type { CalendarEvent } from '../scheduling'

// Optional: GlassView for liquid glass rows on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed */
}

// ---------------------------------------------------------------------------
// CalendarEventRow — shared glass event row (also used by CalendarView's
// month-mode selected-day list, where it is the renderDocRow default row).
// ---------------------------------------------------------------------------

export type CalendarEventRowProps = {
  event: CalendarEvent
  /** Pre-formatted time text; defaults to formatEventTimeRange(event). */
  timeText?: string
  onPress?: () => void
}

export const CalendarEventRow: React.FC<CalendarEventRowProps> = ({
  event,
  timeText,
  onPress,
}) => {
  const { colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const inner = (
    <View style={styles.rowInner}>
      <View style={[styles.rowBar, { backgroundColor: event.color ?? colors.primary }]} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.rowTime} numberOfLines={1}>
          {timeText ?? formatEventTimeRange(event)}
        </Text>
      </View>
    </View>
  )

  const card =
    liquidGlassAvailable && GlassView ? (
      <GlassView style={styles.rowCard} isInteractive glassEffectStyle="regular">
        {inner}
      </GlassView>
    ) : (
      <View style={[styles.rowCard, styles.rowCardFallback]}>{inner}</View>
    )

  if (!onPress) return card
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.rowPressed]}>
      {card}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// DayListFallback
// ---------------------------------------------------------------------------

export type DayListFallbackProps = {
  /** Merged event list — filtered to `date` internally. */
  events: CalendarEvent[]
  /** 'YYYY-MM-DD' local date to display. */
  date: string
  /** Row tap — id is `{docId}::{sourceId}` (see calendarEventDocId). */
  onPressEvent: (id: string) => void
}

/** Minimum height of one hour slot (slots with events grow beyond it). */
const HOUR_SLOT_MIN_HEIGHT = 52
/** Width of the leading hour-label gutter. */
const GUTTER_WIDTH = 64
/** Initial position for non-today days (Apple Calendar's resting hour). */
const DEFAULT_START_HOUR = 7

const HOURS = Array.from({ length: 24 }, (_, h) => h)

/** '9 AM' / '09:00' label for an hour-of-day gutter. */
const hourLabel = (hour: number): string => {
  try {
    return new Date(2024, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' })
  } catch {
    return `${String(hour).padStart(2, '0')}:00`
  }
}

export const DayListFallback: React.FC<DayListFallbackProps> = ({
  events,
  date,
  onPressEvent,
}) => {
  const { colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const { allDay, eventsByHour } = useMemo(() => {
    const dayEvents = events.filter((ev) => eventOccursOnDate(ev, date))
    const allDayRows: CalendarEvent[] = []
    const timed: CalendarEvent[] = []
    for (const ev of dayEvents) {
      const start = new Date(ev.start)
      const startsEarlier = !Number.isNaN(start.getTime()) && toDateKey(start) < date
      // allDay events and ranges that began on an earlier day have no
      // meaningful hour on THIS day — pin them above the timeline.
      if (ev.allDay || startsEarlier) allDayRows.push(ev)
      else timed.push(ev)
    }
    timed.sort((a, b) => a.start.localeCompare(b.start))
    const byHour = new Map<number, CalendarEvent[]>()
    for (const ev of timed) {
      const hour = new Date(ev.start).getHours()
      const bucket = byHour.get(hour)
      if (bucket) bucket.push(ev)
      else byHour.set(hour, [ev])
    }
    return { allDay: allDayRows, eventsByHour: byHour }
  }, [events, date])

  const isToday = date === todayDateKey()

  // 60s tick keeps the now line tracking while the surface stays mounted.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    if (!isToday) return
    const id = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [isToday])
  const now = new Date(nowTick)

  // ── Initial scroll (FLAW: opening at 00:00) — 07:00, or now−1h on today.
  // Slot y-offsets are MEASURED (slots grow with events); the scroll applies
  // once per `date`, from onContentSizeChange (fires after children laid out).
  const scrollRef = useRef<ScrollView | null>(null)
  const hourYsRef = useRef<Record<number, number>>({})
  const gridYRef = useRef(0)
  const scrolledForRef = useRef<string | null>(null)
  const targetHour = isToday ? Math.max(now.getHours() - 1, 0) : DEFAULT_START_HOUR

  const applyInitialScroll = useCallback(() => {
    if (scrolledForRef.current === date) return
    const slotY = hourYsRef.current[targetHour]
    if (slotY === undefined) return
    scrolledForRef.current = date
    scrollRef.current?.scrollTo({
      y: Math.max(0, gridYRef.current + slotY - t.spacing.sm),
      animated: false,
    })
  }, [date, targetHour])

  // Date changes may not change the content SIZE (e.g. two empty days), so
  // onContentSizeChange alone can miss the re-position — re-apply next frame
  // using the still-valid measured slot offsets.
  useEffect(() => {
    const id = requestAnimationFrame(applyInitialScroll)
    return () => cancelAnimationFrame(id)
  }, [applyInitialScroll])

  const nowHour = now.getHours()
  const nowTop = (now.getMinutes() / 60) * HOUR_SLOT_MIN_HEIGHT

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      onContentSizeChange={applyInitialScroll}
    >
      {allDay.length > 0 && (
        <View style={styles.allDaySection}>
          <Text style={styles.allDayGutter} numberOfLines={1}>
            All day
          </Text>
          <View style={styles.allDayEvents}>
            {allDay.map((ev) => (
              <CalendarEventRow key={ev.id} event={ev} onPress={() => onPressEvent(ev.id)} />
            ))}
          </View>
        </View>
      )}
      <View
        style={styles.hourGrid}
        onLayout={(e) => {
          gridYRef.current = e.nativeEvent.layout.y
          applyInitialScroll()
        }}
      >
        {HOURS.map((hour) => {
          const hourEvents = eventsByHour.get(hour) ?? []
          return (
            <View
              key={`h-${hour}`}
              style={styles.hourSlot}
              onLayout={(e) => {
                hourYsRef.current[hour] = e.nativeEvent.layout.y
              }}
            >
              <Text style={styles.hourGutter} numberOfLines={1}>
                {hourLabel(hour)}
              </Text>
              <View style={styles.hourEvents}>
                {hourEvents.map((ev) => (
                  <CalendarEventRow key={ev.id} event={ev} onPress={() => onPressEvent(ev.id)} />
                ))}
              </View>
              {/* Now line — today only, inside the current hour's slot at the
                  minute fraction (exact while the slot is at its min height;
                  clamped to the right hour block when it grew with events). */}
              {isToday && hour === nowHour && (
                <View pointerEvents="none" style={[styles.nowLine, { top: nowTop - 4 }]}>
                  <View style={styles.nowDot} />
                  <View style={styles.nowBar} />
                </View>
              )}
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}

// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    // Shared event row
    rowCard: { borderRadius: 12, overflow: 'hidden' },
    rowCardFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    rowInner: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingVertical: 9,
      paddingLeft: 10,
      paddingRight: 12,
      gap: 10,
    },
    rowBar: { width: 3, borderRadius: 1.5, alignSelf: 'stretch' },
    rowBody: { flex: 1, minWidth: 0, gap: 1 },
    rowTitle: { fontSize: t.fontSize.md, fontWeight: '600', color: c.text },
    rowTime: { fontSize: t.fontSize.xs, color: c.textMuted },
    rowPressed: { opacity: 0.7 },

    // Day timeline
    list: { flex: 1 },
    listContent: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xl,
    },
    allDaySection: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.sm,
      paddingBottom: t.spacing.sm,
    },
    allDayGutter: {
      width: GUTTER_WIDTH,
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      color: c.textMuted,
      textAlign: 'right',
      paddingTop: 10,
      paddingRight: t.spacing.sm,
    },
    allDayEvents: { flex: 1, gap: t.spacing.xs },

    hourGrid: {},
    /**
     * Hour slots: min-height rows with a hairline per hour. Separator colour
     * is c.border (NOT c.hairline) — the rgba hairline token is invisible on
     * the dark background, and the hour grid IS the surface's structure.
     */
    hourSlot: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      minHeight: HOUR_SLOT_MIN_HEIGHT,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    hourGutter: {
      width: GUTTER_WIDTH,
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      color: c.textMuted,
      textAlign: 'right',
      paddingRight: t.spacing.sm,
      // Sit the label ON its hairline (Apple Calendar gutter alignment).
      marginTop: -7,
      lineHeight: 14,
    },
    hourEvents: { flex: 1, gap: t.spacing.xs, paddingVertical: 3 },

    // Now indicator — red line + leading dot (destructive token is red in
    // BOTH schemes; primary is white in dark mode, so never use it here).
    nowLine: {
      position: 'absolute',
      left: GUTTER_WIDTH - t.spacing.sm - 4,
      right: 0,
      height: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    nowDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.destructive,
    },
    nowBar: { flex: 1, height: 2, backgroundColor: c.destructive },
  })
