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
 * Layout (three width tiers via useWindowDimensions):
 *  - compact (< CALENDAR_COMPACT_WIDTH): stacked toolbar + legend rows, month
 *    grid with dots + the selected-day list below;
 *  - medium (>= CALENDAR_COMPACT_WIDTH): same stacking, month grid upgrades
 *    to titled event bars (showEventBars);
 *  - regular (>= CALENDAR_REGULAR_WIDTH, iPad-class — Apple Calendar feel):
 *    ONE glass header row (segmented Month/Week/Day + Today + legend chips);
 *    month grid fills the available height (fillHeight) with the selected
 *    day's event list as a ~320pt right side panel (glass inset section);
 *    week strip becomes a full-width header band with larger pills and the
 *    timeline gets comfortable insets; day mode centres the timeline at a
 *    ~720pt max width.
 *
 * Pieces:
 *  - toolbar: native segmented Month/Week/Day picker (registry-gated
 *    SwiftUI/JC tiers via SegmentedIndexPicker) + a liquid-glass "Today"
 *    button;
 *  - source legend: one visibility control per source (ON = visible) —
 *    SwiftUI Toggle rendered as a tinted toggle-button (toggleStyle('button')
 *    via the nativeComponents registry, Toggle + toggleStyle null-checked)
 *    with a JS chip fallback (filled + lucide Check when ON, outlined when
 *    OFF). Visibility SEEDS from each source's `hidden` flag (customize
 *    sheet) and then stays local — taps never mutate the injected config;
 *  - month mode: native month grid (HorizonCalendar) or MonthGridFallback,
 *    with the selected day's event rows listed below/beside (rows go through
 *    renderDocRow so screens can wrap them in peek previews);
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
import React, { useMemo } from 'react'
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'

import { useListColors } from '../../hooks/useListColors'
import { SegmentedIndexPicker } from '../../fields/structural/common'
import { CalendarEventRow, DayListFallback } from '../DayListFallback'
import { MonthGridFallback } from '../MonthGridFallback'
import { WeekStrip } from '../WeekStrip'
import {
  addDaysToKey,
  calendarEventDocId,
  formatLongDate,
  normalizeDateKey,
  todayDateKey,
} from '../../scheduling'
import { CALENDAR_COMPACT_WIDTH, CALENDAR_REGULAR_WIDTH } from '../types'
import type { CalendarMode, CalendarViewProps } from '../types'
import { createStyles } from './styles'
import { AllDayChip, EmptyDayState, GlassSection, LegendScroller, TodayButton } from './components'
import { useCalendarLegend } from './hooks/useCalendarLegend'
import { useCalendarEvents } from './hooks/useCalendarEvents'

// Optional: lucide chevrons (pure RN SVG) with text fallbacks
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

  // Width tiers: compact (iPhone-class) keeps month dots + stacked chrome;
  // >= CALENDAR_COMPACT_WIDTH upgrades the month grid to titled event bars;
  // >= CALENDAR_REGULAR_WIDTH (iPad-class) opts into the Apple-Calendar
  // layout — single glass header row, month grid + right side panel,
  // full-width week strip, centred day timeline.
  const { width: windowWidth } = useWindowDimensions()
  const compact = windowWidth < CALENDAR_COMPACT_WIDTH
  const regular = windowWidth >= CALENDAR_REGULAR_WIDTH

  // ── Source visibility + legend chips (seeded from `hidden`, local-only) ──
  const { visibleSources, legendChips } = useCalendarLegend({
    sources,
    styles,
    colors,
    dark,
  })

  // ── Docs → events, doc lookup, native gate, selectedDate guard + splits ──
  const {
    events,
    docById,
    handlePressEventId,
    handleNativeTimelineDate,
    nativeAvailable,
    NativeMonth,
    NativeDay,
    selectedDayEvents,
    allDayEvents,
    timedEvents,
  } = useCalendarEvents({
    docs,
    visibleSources,
    useAsTitle,
    selectedDate,
    onChangeSelectedDate,
    onPressDoc,
    nativeModule,
  })

  // ── Selected-day rows (month mode, below the grid) ────────────────────
  const dayRows = selectedDayEvents.map((ev) => {
    const doc = docById.get(calendarEventDocId(ev.id))
    const defaultRow = (
      <CalendarEventRow event={ev} onPress={doc ? () => onPressDoc(doc) : undefined} />
    )
    const row = doc && renderDocRow ? renderDocRow(doc, defaultRow) : defaultRow
    return <React.Fragment key={ev.id}>{row}</React.Fragment>
  })

  // ── Mode segment (shared by both header tiers; legend chips come from the
  // useCalendarLegend hook above) ───────────────────────────────────────
  const modeSegment = (
    <SegmentedIndexPicker
      labels={MODE_LABELS}
      selectedIndex={Math.max(0, MODES.indexOf(mode))}
      onSelect={(i) => onChangeMode(MODES[i] ?? 'month')}
    />
  )

  // ── Header ────────────────────────────────────────────────────────────
  // Regular width: ONE glass row — segmented + Today + legend chips (Apple
  // Calendar iPad toolbar feel). Compact keeps the stacked toolbar + legend.
  const header = regular ? (
    <View style={styles.headerWrapRegular}>
      <GlassSection style={styles.headerCard} fallbackStyle={styles.headerCardFallback}>
        <View style={styles.headerRowRegular}>
          <View style={styles.modePickerRegular}>{modeSegment}</View>
          <TodayButton
            styles={styles}
            embedded
            onPress={() => onChangeSelectedDate(todayDateKey())}
          />
          {legendChips.length > 0 && <View style={styles.headerDivider} />}
          {legendChips.length > 0 && (
            <LegendScroller
              chips={legendChips}
              fadeColor={colors.card}
              style={styles.legendScrollRegular}
              contentContainerStyle={styles.legendRowRegular}
            />
          )}
        </View>
      </GlassSection>
    </View>
  ) : (
    <>
      <View style={styles.toolbar}>
        <View style={styles.modePicker}>{modeSegment}</View>
        <TodayButton styles={styles} onPress={() => onChangeSelectedDate(todayDateKey())} />
      </View>
      {legendChips.length > 0 && (
        <LegendScroller
          chips={legendChips}
          fadeColor={colors.background}
          style={styles.legendScroll}
          contentContainerStyle={styles.legendRow}
        />
      )}
    </>
  )

  // ── Month mode ────────────────────────────────────────────────────────
  if (mode === 'month') {
    // showEventBars: >= CALENDAR_COMPACT_WIDTH renders Apple-Calendar-style
    // titled bars (optional native prop — older module builds ignore it);
    // compact keeps dots + the selected-day list below. fillHeight (regular,
    // iPad-class) stretches the grid over the available height.
    const grid = NativeMonth ? (
      <NativeMonth
        events={events}
        selectedDate={selectedDate}
        onSelectDate={(e: { nativeEvent: { date: string } }) =>
          onChangeSelectedDate(normalizeDateKey(e.nativeEvent.date))
        }
        showEventBars={!compact}
        style={regular ? styles.nativeMonthFill : styles.nativeMonth}
      />
    ) : (
      <MonthGridFallback
        events={events}
        selectedDate={selectedDate}
        onSelectDate={onChangeSelectedDate}
        showEventBars={!compact}
        fillHeight={regular}
      />
    )

    // Regular width: full-height grid + the selected-day list as a RIGHT
    // side panel (Apple Calendar's iPad month + inspector feel).
    if (regular) {
      return (
        <View style={styles.container}>
          {header}
          <View style={styles.monthSplit}>
            <View style={styles.monthGridPane}>{grid}</View>
            <GlassSection style={styles.sidePanel} fallbackStyle={styles.sidePanelFallback}>
              <Text style={styles.sidePanelHeader} numberOfLines={1}>
                {formatLongDate(selectedDate)}
              </Text>
              <ScrollView
                style={styles.sidePanelList}
                contentContainerStyle={styles.sidePanelContent}
                showsVerticalScrollIndicator={false}
              >
                {dayRows.length > 0 ? (
                  dayRows
                ) : (
                  <EmptyDayState styles={styles} colors={colors} />
                )}
              </ScrollView>
            </GlassSection>
          </View>
        </View>
      )
    }

    return (
      <View style={styles.container}>
        {header}
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
            <EmptyDayState styles={styles} colors={colors} />
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
      // page weeks; native timeline day swipes pull the strip along. Regular
      // width: full-width header band with larger pills + event dots.
      <WeekStrip
        events={events}
        selectedDate={selectedDate}
        onSelectDate={onChangeSelectedDate}
        regular={regular}
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
  // timeline renders its own all-day row from the unfiltered events). On
  // regular-width week mode its insets align with the full-width strip.
  const allDayStrip =
    !nativeAvailable && allDayEvents.length > 0 ? (
      <View
        style={[styles.allDayRow, regular && mode === 'week' && styles.allDayRowRegular]}
      >
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

  const timeline = NativeDay ? (
    // Native CalendarKit timeline — its horizontal swipe paging IS the
    // week mode's scrollable-days surface; allDay events pass through.
    // onChangeDate goes through handleNativeTimelineDate, which only accepts
    // adjacent-day user swipes (see the selectedDate contract guard above).
    <NativeDay
      events={events}
      date={selectedDate}
      onPressEvent={(e: { nativeEvent: { id: string } }) =>
        handlePressEventId(e.nativeEvent.id)
      }
      onChangeDate={(e: { nativeEvent: { date: string } }) =>
        handleNativeTimelineDate(e.nativeEvent.date)
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
  )

  // Regular-width DAY mode: centre the nav + timeline column at a max width
  // so it doesn't stretch edge-to-edge on 12.9".
  if (regular && mode === 'day') {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.dayCenterColumn}>
          {timelineHeader}
          {allDayStrip}
          {timeline}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {header}
      {timelineHeader}
      {allDayStrip}
      {regular ? (
        // Regular-width WEEK mode: comfortable timeline insets below the
        // full-width strip.
        <View style={styles.timelineInsetRegular}>{timeline}</View>
      ) : (
        timeline
      )}
    </View>
  )
}
