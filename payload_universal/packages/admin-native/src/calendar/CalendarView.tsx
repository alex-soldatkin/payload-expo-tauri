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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import { defaultTheme as t } from '../theme'
import { useListColors } from '../hooks/useListColors'
import type { ListColorPalette } from '../hooks/useListColors'
import { hexToRgba } from '../kanban/types'
import { SegmentedIndexPicker } from '../fields/structural/common'
import { NativeHost } from '../fields/NativeHost'
import { nativeComponents } from '../fields/shared'
import { CalendarEventRow, DayListFallback } from './DayListFallback'
import { MonthGridFallback } from './MonthGridFallback'
import { WeekStrip } from './WeekStrip'
import {
  addDaysToKey,
  calendarEventDocId,
  dayIndexFromKey,
  docsToCalendarEvents,
  eventOccursOnDate,
  formatLongDate,
  normalizeDateKey,
  todayDateKey,
} from '../scheduling'
import type { CalendarDoc, CalendarEvent } from '../scheduling'
import { CALENDAR_COMPACT_WIDTH, CALENDAR_REGULAR_WIDTH } from './types'
import type { CalendarMode, CalendarViewProps } from './types'

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

// Optional: LinearGradient for the legend scroller's right-edge fade hint
// (signals more chips scroll off-screen). Falls back to a flat fade View when
// expo-linear-gradient isn't installed — the chips never clip either way.
let LinearGradient: React.ComponentType<any> | null = null
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient ?? null
} catch {
  /* expo-linear-gradient not installed — flat fade fallback */
}

// Optional: lucide chevrons + legend check (pure RN SVG) with text fallbacks
let ChevronLeftIcon: React.ComponentType<{ size: number; color: string }> | null = null
let ChevronRightIcon: React.ComponentType<{ size: number; color: string }> | null = null
let CheckIcon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }> | null =
  null
let CalendarOffIcon: React.ComponentType<{ size: number; color: string }> | null = null
try {
  const lucide = require('lucide-react-native')
  ChevronLeftIcon = lucide.ChevronLeft ?? null
  ChevronRightIcon = lucide.ChevronRight ?? null
  CheckIcon = lucide.Check ?? null
  CalendarOffIcon = lucide.CalendarOff ?? lucide.CalendarX2 ?? lucide.CalendarDays ?? null
} catch {
  /* lucide-react-native not available */
}

// Native SwiftUI legend tier — registry Toggle rendered as a tinted toggle-
// BUTTON (toggleStyle('button')). BOTH entries are null-checked; either
// missing ⇒ the JS chip fallback renders (tint is optional sugar on top).
const NativeToggle = nativeComponents.Toggle
const toggleStyleMod = nativeComponents.toggleStyle
const tintMod = nativeComponents.tint

const MODES: CalendarMode[] = ['month', 'week', 'day']
const MODE_LABELS = ['Month', 'Week', 'Day']

/** Height of the native month grid area (the day list takes the rest). */
const NATIVE_MONTH_HEIGHT = 360
/** Regular-width month mode: width of the selected-day right side panel. */
const MONTH_SIDE_PANEL_WIDTH = 320
/** Regular-width day mode: max content width (don't stretch on 12.9"). */
const DAY_TIMELINE_MAX_WIDTH = 720
/** Regular-width header: fixed width of the Month/Week/Day segment. */
const HEADER_SEGMENT_WIDTH = 300

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

  // ── Source visibility — SEEDED from the configured `hidden` flags
  // (customize-sheet visibility toggles), then local-only: legend taps never
  // mutate the injected config. A new `sources` array (config/preset save)
  // re-seeds, so persisted visibility always wins on arrival ────────────────
  const [hiddenSourceIds, setHiddenSourceIds] = useState<ReadonlySet<string>>(
    () => new Set(sources.filter((s) => s.hidden).map((s) => s.id)),
  )
  useEffect(() => {
    setHiddenSourceIds(new Set(sources.filter((s) => s.hidden).map((s) => s.id)))
  }, [sources])

  const setSourceVisible = useCallback((id: string, visible: boolean) => {
    setHiddenSourceIds((prev) => {
      if (visible === !prev.has(id)) return prev
      const next = new Set(prev)
      if (visible) next.delete(id)
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

  // ── selectedDate contract guard (week/day timeline) ────────────────────
  // types.ts: selectedDate is screen-seeded with todayDateKey() and NEVER
  // event-derived; every mode entry (segmented switch, preset apply, Today)
  // must inherit the CURRENT selection. The native CalendarKit timeline is
  // the ONLY surface that can PUSH a date into the selection without a user
  // tap (didMoveTo → onChangeDate) — and a USER page swipe always lands on a
  // day ADJACENT to the current selection (UIPageViewController emits one
  // didMoveTo per completed single-page transition). Anything else — mount-
  // time echoes from module builds whose internal DayViewState initialised
  // before/without the `date` prop (observed: entering week mode jumped the
  // selection to the first event's week, e.g. Products' Aug 2 release dates
  // clobbering a June 13 selection) — is rejected here so week mode can
  // never re-seed the selection from event data. The ref tracks the latest
  // accepted key synchronously so fast multi-page swipes (emissions arriving
  // before the prop round-trip) still chain ±1 moves correctly.
  const selectedDateRef = useRef(selectedDate)
  selectedDateRef.current = selectedDate
  const handleNativeTimelineDate = useCallback(
    (raw: string) => {
      const next = normalizeDateKey(raw)
      const current = selectedDateRef.current
      if (next === current) return // controlled-prop echo — no-op
      const distance = dayIndexFromKey(next, current)
      if (distance === null || Math.abs(distance) !== 1) return // not a user swipe
      selectedDateRef.current = next
      onChangeSelectedDate(next)
    },
    [onChangeSelectedDate],
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

  // ── Mode segment + legend chips (shared by both header tiers) ─────────
  const modeSegment = (
    <SegmentedIndexPicker
      labels={MODE_LABELS}
      selectedIndex={Math.max(0, MODES.indexOf(mode))}
      onSelect={(i) => onChangeMode(MODES[i] ?? 'month')}
    />
  )

  // Legend — one visibility control per source (ON = source visible):
  //  - native tier: SwiftUI Toggle as a tinted toggle-BUTTON
  //    (toggleStyle('button') + tint(source.color)) hosted per-source in a
  //    NativeHost matchContents (hosts size to their SwiftUI content inside
  //    the horizontal legend scroller);
  //  - JS fallback: source-tinted FILLED chip with a lucide Check when ON vs
  //    an OUTLINED chip with the bare colour dot when OFF — the check glyph
  //    keeps the state unambiguous without relying on colour vision.
  const legendChips = sources.map((source) => {
    const visible = !hiddenSourceIds.has(source.id)
    if (NativeToggle && toggleStyleMod) {
      return (
        <NativeHost key={source.id} matchContents>
          <NativeToggle
            isOn={visible}
            label={source.label}
            onIsOnChange={(isOn: boolean) => setSourceVisible(source.id, isOn)}
            modifiers={[
              toggleStyleMod('button'),
              ...(tintMod ? [tintMod(source.color)] : []),
            ]}
          />
        </NativeHost>
      )
    }
    return (
      <Pressable
        key={source.id}
        onPress={() => setSourceVisible(source.id, !visible)}
        accessibilityRole="button"
        accessibilityState={{ selected: visible }}
        style={({ pressed }) => [
          styles.chip,
          visible
            ? {
                borderColor: hexToRgba(source.color, 0.55),
                backgroundColor: hexToRgba(source.color, dark ? 0.3 : 0.16),
              }
            : { borderColor: colors.border, backgroundColor: 'transparent' },
          pressed && styles.chipPressed,
        ]}
      >
        {visible ? (
          CheckIcon ? (
            <CheckIcon size={12} color={colors.text} strokeWidth={3} />
          ) : (
            <Text style={styles.chipCheckGlyph}>{'✓'}</Text>
          )
        ) : (
          // OFF affordance: outlined chip + FULL-strength colour dot (muted
          // label carries the "off" state) — a dimmed dot was unreadable on
          // the dark glass header.
          <View style={[styles.chipDot, { backgroundColor: source.color }]} />
        )}
        <Text
          style={[styles.chipLabel, !visible && { color: colors.textPlaceholder }]}
          numberOfLines={1}
        >
          {source.label}
        </Text>
      </Pressable>
    )
  })

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

// ---------------------------------------------------------------------------
// LegendScroller — horizontal source-legend chips with a right-edge fade hint.
//
// The chips already live in a horizontal ScrollView; the fade is the missing
// affordance — with 3+ sources the row scrolls but the last chip looked
// clipped at the screen edge ("Schedu…"). A right-edge gradient (or a flat
// fade fallback) signals "more →" and is shown ONLY while content overflows
// AND hasn't been scrolled to the end. Measurement only — no gesture beyond
// the ScrollView itself. The fade colour matches the surface beneath so it
// reads as the chips dissolving, not a stripe.
// ---------------------------------------------------------------------------

function LegendScroller({
  chips,
  fadeColor,
  style,
  contentContainerStyle,
}: {
  chips: React.ReactNode
  /** Solid surface colour beneath the chips (header card / screen bg). */
  fadeColor: string
  style: StyleProp<ViewStyle>
  contentContainerStyle: StyleProp<ViewStyle>
}) {
  const [viewportW, setViewportW] = useState(0)
  const [contentW, setContentW] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  // Overflow + not yet scrolled to the very end ⇒ more chips hide right.
  const atEnd = offsetX + viewportW >= contentW - 1
  const showFade = contentW > viewportW + 1 && !atEnd

  return (
    // position:relative wrapper so the fade can pin to the scroller's right
    // edge regardless of how far the content has scrolled.
    <View style={[styles_legendFade.wrap, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        scrollEventThrottle={16}
        onLayout={(e) => setViewportW(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContentW(w)}
        onScroll={(e) => setOffsetX(e.nativeEvent.contentOffset.x)}
      >
        {chips}
      </ScrollView>
      {showFade ? (
        LinearGradient ? (
          <LinearGradient
            pointerEvents="none"
            colors={[hexToRgba(fadeColor, 0), fadeColor]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles_legendFade.fade}
          />
        ) : (
          // Flat fade fallback — a soft right-edge wash when no gradient lib.
          <View
            pointerEvents="none"
            style={[styles_legendFade.fade, { backgroundColor: hexToRgba(fadeColor, 0.7) }]}
          />
        )
      ) : null}
    </View>
  )
}

const styles_legendFade = StyleSheet.create({
  wrap: { position: 'relative' },
  fade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 28 },
})

// ---------------------------------------------------------------------------
// GlassSection — liquid glass container with a themed bordered fallback
// (regular-width header row + month-mode side panel)
// ---------------------------------------------------------------------------

function GlassSection({
  style,
  fallbackStyle,
  children,
}: {
  style: StyleProp<ViewStyle>
  fallbackStyle: StyleProp<ViewStyle>
  children: React.ReactNode
}) {
  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView style={style} glassEffectStyle="regular">
        {children}
      </GlassView>
    )
  }
  return <View style={[style, fallbackStyle]}>{children}</View>
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
// EmptyDayState — selected-day panel/list empty state (month mode). Registry
// ContentUnavailableView (SwiftUI, iOS 17+) when available, else a muted
// lucide CalendarOff + caption. Renders inside the day panel's glass card /
// list so it inherits the surface — no chrome of its own beyond spacing.
// ---------------------------------------------------------------------------

const ContentUnavailable = nativeComponents.ContentUnavailableView

function EmptyDayState({
  styles,
  colors,
}: {
  styles: ReturnType<typeof createStyles>
  colors: ListColorPalette
}) {
  if (ContentUnavailable) {
    return (
      // Fixed-height box so the stretched Host has an explicit frame
      // (mirrors DocumentList's EmptyState sizing pattern).
      <View style={styles.emptyDayNativeBox}>
        <NativeHost matchContents={false} style={styles.flexFill}>
          <ContentUnavailable
            title="No Events"
            systemImage="calendar.badge.minus"
            description="No events on this day"
          />
        </NativeHost>
      </View>
    )
  }
  return (
    <View style={styles.emptyDay}>
      {CalendarOffIcon ? <CalendarOffIcon size={28} color={colors.textMuted} /> : null}
      <Text style={styles.emptyDayText}>No events on this day</Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Today button — liquid glass first, themed bordered fallback. `embedded`
// (inside the regular-width glass header) skips the nested glass and renders
// a hairline-bordered pill instead (glass-in-glass renders poorly).
// ---------------------------------------------------------------------------

function TodayButton({
  onPress,
  styles,
  embedded = false,
}: {
  onPress: () => void
  styles: ReturnType<typeof createStyles>
  embedded?: boolean
}) {
  const inner = <Text style={styles.todayLabel}>Today</Text>
  const body = embedded ? (
    <View style={[styles.todayBtn, styles.todayBtnEmbedded]}>{inner}</View>
  ) : liquidGlassAvailable && GlassView ? (
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
    // Inside the regular-width glass header — bordered, surface-transparent.
    todayBtnEmbedded: {
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    todayLabel: { fontSize: t.fontSize.sm, fontWeight: '600', color: c.text },
    todayPressed: { opacity: 0.7 },

    // ── Regular-width header — ONE glass row: segmented + Today + legend ──
    headerWrapRegular: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
      paddingBottom: t.spacing.xs,
    },
    headerCard: { borderRadius: 18, overflow: 'hidden' },
    headerCardFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    headerRowRegular: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 6,
    },
    modePickerRegular: { width: HEADER_SEGMENT_WIDTH },
    headerDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      marginVertical: t.spacing.xs,
      backgroundColor: c.hairline,
    },
    legendScrollRegular: { flex: 1 },
    legendRowRegular: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingRight: t.spacing.sm,
    },

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
    chipLabel: { fontSize: t.fontSize.xs, fontWeight: '600', color: c.text, maxWidth: 160 },
    /** Text fallback for the legend check when lucide is unavailable. */
    chipCheckGlyph: { fontSize: 11, fontWeight: '800', color: c.text, lineHeight: 12 },

    nativeMonth: { height: NATIVE_MONTH_HEIGHT, marginHorizontal: t.spacing.md },
    // Regular width: the grid owns its split pane (pane provides the insets).
    nativeMonthFill: { flex: 1 },

    // ── Regular-width month split — full-height grid + right side panel ──
    monthSplit: {
      flex: 1,
      flexDirection: 'row',
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.xs,
      paddingBottom: t.spacing.md,
    },
    monthGridPane: { flex: 1 },
    sidePanel: {
      width: MONTH_SIDE_PANEL_WIDTH,
      borderRadius: 18,
      overflow: 'hidden',
    },
    sidePanelFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    sidePanelHeader: {
      fontSize: t.fontSize.sm,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      paddingHorizontal: t.spacing.lg,
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.xs,
    },
    sidePanelList: { flex: 1 },
    sidePanelContent: {
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.lg,
      gap: t.spacing.sm,
    },

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
    // ── Selected-day empty state (icon + caption / native tier) ──
    flexFill: { flex: 1 },
    emptyDayNativeBox: { height: 160 },
    emptyDay: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.sm,
      paddingTop: t.spacing.xl,
      paddingBottom: t.spacing.lg,
    },
    emptyDayText: { fontSize: t.fontSize.sm, color: c.textMuted, textAlign: 'center' },

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
    // Regular-width WEEK mode: comfortable timeline insets under the strip.
    timelineInsetRegular: { flex: 1, paddingHorizontal: t.spacing.lg },
    // Regular-width DAY mode: centred max-width column (nav + timeline).
    dayCenterColumn: {
      flex: 1,
      width: '100%',
      maxWidth: DAY_TIMELINE_MAX_WIDTH,
      alignSelf: 'center',
    },

    // ── All-day strip (fallback tier only) ──
    allDayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingLeft: t.spacing.md,
      paddingVertical: t.spacing.xs,
    },
    // Regular-width week mode: align with the full-width strip's insets.
    allDayRowRegular: {
      paddingLeft: t.spacing.lg,
      paddingVertical: t.spacing.sm,
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
