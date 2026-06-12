/**
 * CalendarView — config-driven calendar over Payload docs.
 *
 * Injection-friendly core component (no expo-router, no data fetching, no
 * direct native-module import): the screen supplies already-filtered docs,
 * the source config, mode/date state + callbacks and — when the app has the
 * `calendar-view` Expo module compiled in — the module itself via
 * `nativeModule`. Without it the pure-JS tiers render (MonthGridFallback /
 * DayListFallback).
 *
 * Layout:
 *  - toolbar: native segmented Month/Week/Day picker (registry-gated
 *    SwiftUI/JC tiers via SegmentedIndexPicker) + a liquid-glass "Today"
 *    button;
 *  - source legend chips (colour dot + label; tap toggles a source's
 *    visibility — local state only, never mutates the injected config);
 *  - month mode: native month grid (HorizonCalendar) or MonthGridFallback,
 *    with the selected day's event rows listed below (rows go through
 *    renderDocRow so screens can wrap them in peek previews); regular width
 *    (>= CALENDAR_COMPACT_WIDTH) opts into titled event bars
 *    (showEventBars), compact keeps dots + the selected-day list;
 *  - week mode: 7-day week-strip header (day pills with presence dots; tap
 *    selects; chevrons/swipe page weeks) above the day timeline — the native
 *    CalendarKit DayView IS the horizontally-scrollable-days surface (its
 *    swipe paging syncs back through onChangeDate);
 *  - day mode: week's CHILD — the SAME timeline surface, just with a
 *    single-date nav header (chevrons) instead of the week strip;
 *  - all-day handling: the native timeline receives allDay events unfiltered
 *    (CalendarKit renders its own all-day row); the JS all-day glass-chip
 *    strip renders ONLY in the fallback tier so the two never duplicate.
 */
import React, { useCallback, useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

import { defaultTheme as t } from '../theme'
import { useListColors } from '../hooks/useListColors'
import type { ListColorPalette } from '../hooks/useListColors'
import { hexToRgba } from '../kanban/types'
import { SegmentedIndexPicker } from '../fields/structural/common'
import { CalendarEventRow, DayListFallback } from './DayListFallback'
import { MonthGridFallback } from './MonthGridFallback'
import { WeekStrip } from './WeekStrip'
import { calendarEventDocId, docsToCalendarEvents } from './eventMapping'
import {
  addDaysToKey,
  CALENDAR_COMPACT_WIDTH,
  eventOccursOnDate,
  formatLongDate,
  normalizeDateKey,
  todayDateKey,
} from './types'
import type { CalendarDoc, CalendarEvent, CalendarMode, CalendarViewProps } from './types'

// Optional: GlassView for the liquid glass "Today" button on iOS 26+
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

const MODES: CalendarMode[] = ['month', 'week', 'day']
const MODE_LABELS = ['Month', 'Week', 'Day']

/** Height of the native month grid area (the day list takes the rest). */
const NATIVE_MONTH_HEIGHT = 360

export const CalendarView: React.FC<CalendarViewProps> = ({
  docs,
  sources,
  useAsTitle,
  mode,
  onChangeMode,
  selectedDate,
  onChangeSelectedDate,
  onPressDoc,
  renderDocRow,
  nativeModule,
}) => {
  const { dark, colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  // Compact width (iPhone-class) keeps month dots; regular width (tablet /
  // landscape) upgrades the month grid to titled event bars.
  const { width: windowWidth } = useWindowDimensions()
  const compact = windowWidth < CALENDAR_COMPACT_WIDTH

  // ── Source visibility (local — never mutates the injected config) ─────
  const [hiddenSourceIds, setHiddenSourceIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )
  const toggleSource = useCallback((id: string) => {
    setHiddenSourceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const visibleSources = useMemo(
    () => sources.filter((s) => !hiddenSourceIds.has(s.id)),
    [sources, hiddenSourceIds],
  )

  // ── Docs → events ─────────────────────────────────────────────────────
  const events = useMemo(
    () => docsToCalendarEvents(docs, visibleSources, useAsTitle),
    [docs, visibleSources, useAsTitle],
  )

  const docById = useMemo(() => {
    const map = new Map<string, CalendarDoc>()
    for (const doc of docs) {
      if (doc.id !== null && doc.id !== undefined) map.set(String(doc.id), doc)
    }
    return map
  }, [docs])

  const handlePressEventId = useCallback(
    (eventId: string) => {
      const doc = docById.get(calendarEventDocId(eventId))
      if (doc) onPressDoc(doc)
    },
    [docById, onPressDoc],
  )

  // ── Native tier gate (screen-injected module; never imported here) ────
  const nativeAvailable = Boolean(nativeModule?.isNativeCalendarAvailable)
  const NativeMonth = nativeAvailable ? nativeModule!.NativeCalendarMonth : null
  const NativeDay = nativeAvailable ? nativeModule!.NativeCalendarDay : null

  // ── Selected-day rows (month mode, below the grid) ────────────────────
  const selectedDayEvents = useMemo(
    () => events.filter((ev) => eventOccursOnDate(ev, selectedDate)),
    [events, selectedDate],
  )

  // ── All-day split (week/day timeline) — the JS all-day strip owns these
  // in the FALLBACK tier only; the native tier passes them through and
  // trusts CalendarKit's all-day row (never both) ────────────────────────
  const allDayEvents = useMemo(
    () => selectedDayEvents.filter((ev) => Boolean(ev.allDay)),
    [selectedDayEvents],
  )
  const timedEvents = useMemo(() => events.filter((ev) => !ev.allDay), [events])

  const dayRows = selectedDayEvents.map((ev) => {
    const doc = docById.get(calendarEventDocId(ev.id))
    const defaultRow = (
      <CalendarEventRow event={ev} onPress={doc ? () => onPressDoc(doc) : undefined} />
    )
    const row = doc && renderDocRow ? renderDocRow(doc, defaultRow) : defaultRow
    return <React.Fragment key={ev.id}>{row}</React.Fragment>
  })

  // ── Toolbar ───────────────────────────────────────────────────────────
  const toolbar = (
    <View style={styles.toolbar}>
      <View style={styles.modePicker}>
        <SegmentedIndexPicker
          labels={MODE_LABELS}
          selectedIndex={Math.max(0, MODES.indexOf(mode))}
          onSelect={(i) => onChangeMode(MODES[i] ?? 'month')}
        />
      </View>
      <TodayButton
        styles={styles}
        onPress={() => onChangeSelectedDate(todayDateKey())}
      />
    </View>
  )

  // ── Legend ────────────────────────────────────────────────────────────
  const legend =
    sources.length > 0 ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.legendScroll}
        contentContainerStyle={styles.legendRow}
      >
        {sources.map((source) => {
          const hidden = hiddenSourceIds.has(source.id)
          return (
            <Pressable
              key={source.id}
              onPress={() => toggleSource(source.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: !hidden }}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: hexToRgba(source.color, hidden ? 0.25 : 0.55),
                  backgroundColor: hidden
                    ? 'transparent'
                    : hexToRgba(source.color, dark ? 0.2 : 0.1),
                },
                pressed && styles.chipPressed,
              ]}
            >
              <View
                style={[
                  styles.chipDot,
                  { backgroundColor: source.color },
                  hidden && styles.chipDotHidden,
                ]}
              />
              <Text
                style={[styles.chipLabel, hidden && { color: colors.textPlaceholder }]}
                numberOfLines={1}
              >
                {source.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    ) : null

  // ── Month mode ────────────────────────────────────────────────────────
  if (mode === 'month') {
    // showEventBars: regular width renders Apple-Calendar-style titled bars
    // (optional native prop — older module builds ignore it); compact keeps
    // dots + the selected-day list below.
    const grid = NativeMonth ? (
      <NativeMonth
        events={events}
        selectedDate={selectedDate}
        onSelectDate={(e: { nativeEvent: { date: string } }) =>
          onChangeSelectedDate(normalizeDateKey(e.nativeEvent.date))
        }
        showEventBars={!compact}
        style={styles.nativeMonth}
      />
    ) : (
      <MonthGridFallback
        events={events}
        selectedDate={selectedDate}
        onSelectDate={onChangeSelectedDate}
        showEventBars={!compact}
      />
    )

    return (
      <View style={styles.container}>
        {toolbar}
        {legend}
        {grid}
        <Text style={styles.dayListHeader} numberOfLines={1}>
          {formatLongDate(selectedDate)}
        </Text>
        <ScrollView
          style={styles.dayList}
          contentContainerStyle={styles.dayListContent}
          showsVerticalScrollIndicator={false}
        >
          {dayRows.length > 0 ? (
            dayRows
          ) : (
            <Text style={styles.emptyText}>No events</Text>
          )}
        </ScrollView>
      </View>
    )
  }

  // ── Week / Day modes — the SAME timeline surface (day is week's child
  // mode); they differ only in the context header above it ───────────────
  const timelineHeader =
    mode === 'week' ? (
      // 7-day strip: tap selects a day (the timeline follows); chevrons/swipe
      // page weeks; native timeline day swipes pull the strip along.
      <WeekStrip
        events={events}
        selectedDate={selectedDate}
        onSelectDate={onChangeSelectedDate}
      />
    ) : (
      <View style={styles.dateNav}>
        <Pressable
          onPress={() => onChangeSelectedDate(addDaysToKey(selectedDate, -1))}
          hitSlop={10}
          style={({ pressed }) => [styles.dateNavBtn, pressed && styles.chipPressed]}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
        >
          {ChevronLeftIcon ? (
            <ChevronLeftIcon size={20} color={colors.textMuted} />
          ) : (
            <Text style={styles.dateNavGlyph}>{'‹'}</Text>
          )}
        </Pressable>
        <Text style={styles.dateNavLabel} numberOfLines={1}>
          {formatLongDate(selectedDate)}
        </Text>
        <Pressable
          onPress={() => onChangeSelectedDate(addDaysToKey(selectedDate, 1))}
          hitSlop={10}
          style={({ pressed }) => [styles.dateNavBtn, pressed && styles.chipPressed]}
          accessibilityRole="button"
          accessibilityLabel="Next day"
        >
          {ChevronRightIcon ? (
            <ChevronRightIcon size={20} color={colors.textMuted} />
          ) : (
            <Text style={styles.dateNavGlyph}>{'›'}</Text>
          )}
        </Pressable>
      </View>
    )

  // All-day glass-chip strip — FALLBACK TIER ONLY (the native CalendarKit
  // timeline renders its own all-day row from the unfiltered events).
  const allDayStrip =
    !nativeAvailable && allDayEvents.length > 0 ? (
      <View style={styles.allDayRow}>
        <Text style={styles.allDayLabel} numberOfLines={1}>
          All-day
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.allDayChips}
        >
          {allDayEvents.map((ev) => (
            <AllDayChip
              key={ev.id}
              event={ev}
              dark={dark}
              fallbackColor={colors.primary}
              styles={styles}
              onPress={() => handlePressEventId(ev.id)}
            />
          ))}
        </ScrollView>
      </View>
    ) : null

  return (
    <View style={styles.container}>
      {toolbar}
      {legend}
      {timelineHeader}
      {allDayStrip}
      {NativeDay ? (
        // Native CalendarKit timeline — its horizontal swipe paging IS the
        // week mode's scrollable-days surface; allDay events pass through.
        <NativeDay
          events={events}
          date={selectedDate}
          onPressEvent={(e: { nativeEvent: { id: string } }) =>
            handlePressEventId(e.nativeEvent.id)
          }
          onChangeDate={(e: { nativeEvent: { date: string } }) =>
            onChangeSelectedDate(normalizeDateKey(e.nativeEvent.date))
          }
          style={styles.nativeDay}
        />
      ) : (
        // Fallback timeline gets TIMED events only — the JS all-day strip
        // above already owns the allDay ones.
        <DayListFallback
          events={timedEvents}
          date={selectedDate}
          onPressEvent={handlePressEventId}
        />
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// All-day chip — liquid glass first, source-tinted bordered fallback
// ---------------------------------------------------------------------------

function AllDayChip({
  event,
  dark,
  fallbackColor,
  styles,
  onPress,
}: {
  event: CalendarEvent
  dark: boolean
  fallbackColor: string
  styles: ReturnType<typeof createStyles>
  onPress: () => void
}) {
  const color = event.color ?? fallbackColor
  const inner = (
    <View style={styles.allDayChipInner}>
      <View style={[styles.allDayChipDot, { backgroundColor: color }]} />
      <Text style={styles.allDayChipLabel} numberOfLines={1}>
        {event.title}
      </Text>
    </View>
  )
  const body =
    liquidGlassAvailable && GlassView ? (
      <GlassView style={styles.allDayChip} isInteractive glassEffectStyle="regular">
        {inner}
      </GlassView>
    ) : (
      <View
        style={[
          styles.allDayChip,
          {
            backgroundColor: hexToRgba(color, dark ? 0.2 : 0.1),
            borderWidth: 1,
            borderColor: hexToRgba(color, 0.45),
          },
        ]}
      >
        {inner}
      </View>
    )
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={event.title}
      style={({ pressed }) => [pressed && styles.chipPressed]}
    >
      {body}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Today button — liquid glass first, themed bordered fallback
// ---------------------------------------------------------------------------

function TodayButton({
  onPress,
  styles,
}: {
  onPress: () => void
  styles: ReturnType<typeof createStyles>
}) {
  const inner = <Text style={styles.todayLabel}>Today</Text>
  const body =
    liquidGlassAvailable && GlassView ? (
      <GlassView style={styles.todayBtn} isInteractive glassEffectStyle="regular">
        {inner}
      </GlassView>
    ) : (
      <View style={[styles.todayBtn, styles.todayBtnFallback]}>{inner}</View>
    )
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Go to today"
      style={({ pressed }) => [pressed && styles.todayPressed]}
    >
      {body}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },

    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xs,
    },
    modePicker: { flex: 1 },
    todayBtn: {
      borderRadius: 16,
      paddingVertical: 7,
      paddingHorizontal: t.spacing.md,
      overflow: 'hidden',
    },
    todayBtnFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    todayLabel: { fontSize: t.fontSize.sm, fontWeight: '600', color: c.text },
    todayPressed: { opacity: 0.7 },

    legendScroll: { flexGrow: 0 },
    legendRow: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
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
    chipDotHidden: { opacity: 0.35 },
    chipLabel: { fontSize: t.fontSize.xs, fontWeight: '600', color: c.text, maxWidth: 160 },

    nativeMonth: { height: NATIVE_MONTH_HEIGHT, marginHorizontal: t.spacing.md },

    dayListHeader: {
      fontSize: t.fontSize.sm,
      fontWeight: '700',
      color: c.textMuted,
      paddingHorizontal: t.spacing.lg,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    dayList: { flex: 1 },
    dayListContent: {
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.xl,
      gap: t.spacing.sm,
    },
    emptyText: {
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      textAlign: 'center',
      paddingVertical: t.spacing.lg,
    },

    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
    },
    dateNavBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateNavGlyph: { fontSize: 22, fontWeight: '600', color: c.textMuted, lineHeight: 24 },
    dateNavLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: t.fontSize.md,
      fontWeight: '700',
      color: c.text,
    },
    nativeDay: { flex: 1 },

    // ── All-day strip (fallback tier only) ──
    allDayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingLeft: t.spacing.md,
      paddingVertical: t.spacing.xs,
    },
    allDayLabel: {
      fontSize: t.fontSize.xs,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    allDayChips: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingRight: t.spacing.md,
    },
    allDayChip: {
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: 10,
      overflow: 'hidden',
    },
    allDayChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    allDayChipDot: { width: 8, height: 8, borderRadius: 4 },
    allDayChipLabel: {
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      color: c.text,
      maxWidth: 180,
    },
  })
