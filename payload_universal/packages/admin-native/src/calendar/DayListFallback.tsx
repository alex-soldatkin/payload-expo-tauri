/**
 * DayListFallback — chronological day schedule list with hour gutters, used
 * when the app's native `calendar-view` module (CalendarKit DayView timeline)
 * is unavailable.
 *
 * Mirrors the native day view's contract: { events, date, onPressEvent } —
 * events are filtered to the given local date here; tapping a row fires
 * onPressEvent(event.id) and the screen maps the `{docId}::{sourceId}` id
 * back to its doc.
 *
 * Layout: an "All day" section (allDay events + ranges continuing from an
 * earlier day) above hour-grouped rows with a leading hour gutter. Rows are
 * the shared CalendarEventRow (liquid glass + source colour bar) — the same
 * row CalendarView uses for the month-mode selected-day list.
 */
import React, { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { defaultTheme as t } from '../theme'
import { useListColors } from '../hooks/useListColors'
import type { ListColorPalette } from '../hooks/useListColors'
import { eventOccursOnDate, formatEventTimeRange, toDateKey } from '../scheduling'
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

// Optional: lucide icon for the empty state (pure RN SVG — safe everywhere)
let CalendarIcon: React.ComponentType<{ size: number; color: string }> | null = null
try {
  const lucide = require('lucide-react-native')
  CalendarIcon = lucide.CalendarDays ?? lucide.Calendar ?? null
} catch {
  /* lucide-react-native not available */
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

  const { allDay, hourGroups } = useMemo(() => {
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
    const groups: Array<{ hour: number; events: CalendarEvent[] }> = []
    for (const ev of timed) {
      const hour = new Date(ev.start).getHours()
      const last = groups[groups.length - 1]
      if (last && last.hour === hour) last.events.push(ev)
      else groups.push({ hour, events: [ev] })
    }
    return { allDay: allDayRows, hourGroups: groups }
  }, [events, date])

  if (allDay.length === 0 && hourGroups.length === 0) {
    return (
      <View style={styles.empty}>
        {CalendarIcon ? <CalendarIcon size={24} color={colors.textMuted} /> : null}
        <Text style={styles.emptyText}>No events</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      {allDay.length > 0 && (
        <View style={styles.hourRow}>
          <Text style={styles.hourGutter} numberOfLines={1}>
            All day
          </Text>
          <View style={styles.hourEvents}>
            {allDay.map((ev) => (
              <CalendarEventRow key={ev.id} event={ev} onPress={() => onPressEvent(ev.id)} />
            ))}
          </View>
        </View>
      )}
      {hourGroups.map(({ hour, events: hourEvents }) => (
        <View key={`h-${hour}`} style={styles.hourRow}>
          <Text style={styles.hourGutter} numberOfLines={1}>
            {hourLabel(hour)}
          </Text>
          <View style={styles.hourEvents}>
            {hourEvents.map((ev) => (
              <CalendarEventRow key={ev.id} event={ev} onPress={() => onPressEvent(ev.id)} />
            ))}
          </View>
        </View>
      ))}
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

    // Day list
    list: { flex: 1 },
    listContent: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xl,
      gap: t.spacing.sm,
    },
    hourRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairline,
      paddingTop: t.spacing.sm,
    },
    hourGutter: {
      width: 64,
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      color: c.textMuted,
      textAlign: 'right',
      paddingTop: 10,
    },
    hourEvents: { flex: 1, gap: t.spacing.xs },

    // Empty state
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.sm,
      padding: t.spacing.xl,
    },
    emptyText: { fontSize: t.fontSize.sm, color: c.textMuted },
  })
