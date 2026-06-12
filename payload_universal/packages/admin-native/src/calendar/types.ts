/**
 * Calendar view — public types, palette and pure date/event helpers.
 *
 * Injection-friendly (mirrors the kanban module): the component never imports
 * expo-router, never fetches data and never touches the app's native
 * `calendar-view` module directly. The screen injects already-filtered docs,
 * the press/mode/date callbacks and — when the app has the native module
 * compiled in — the module itself via `nativeModule` (JS fallbacks render
 * otherwise).
 *
 * Runtime constants (DEFAULT_CALENDAR_PALETTE re-uses the kanban palette) and
 * the pure date-key / bucketing / formatting helpers live here so the module
 * keeps the kanban-style layout (types / mapping / fallbacks / view / barrel).
 */
import type React from 'react'

import { DEFAULT_KANBAN_PALETTE } from '../kanban/types'

// ---------------------------------------------------------------------------
// Public contracts
// ---------------------------------------------------------------------------

/** A Payload doc as stored in RxDB / returned by the REST API. */
export type CalendarDoc = Record<string, unknown>

/**
 * Local mirror of the app's `calendar-view` native module event shape
 * (admin-native cannot import from the app's modules/ directory — the FIXED
 * JS contract is duplicated here and must stay in sync).
 */
export type CalendarEvent = {
  /** `{docId}::{sourceId}` — split on the LAST '::' to recover the doc id. */
  id: string
  title: string
  /** ISO datetime. */
  start: string
  /** ISO datetime; absent = point event (month: dot; day view: 30min block). */
  end?: string
  allDay?: boolean
  /** Hex colour (from the source). */
  color?: string
}

/** One date(-range) mapping from doc fields to calendar events. */
export type CalendarSource = {
  id: string
  label: string
  /** Dot-path to the doc field holding the start datetime (e.g. 'scheduling.scheduledPublish'). */
  startField: string
  /** Dot-path to the doc field holding the end datetime; absent = point events. */
  endField?: string
  /** Hex accent colour (event dots/strips/bars + legend chip). */
  color: string
  /**
   * Source starts hidden (customize-sheet visibility toggle). The header
   * legend's local toggles SEED from this flag and never write back —
   * persisting visibility is the customize sheet's job. Absent = visible.
   */
  hidden?: boolean
}

/**
 * 'month' — grid; 'week' — timeline with a 7-day week-strip header;
 * 'day' — the SAME timeline surface showing exactly one day (week's child
 * mode: week/day share the timeline and differ only in the context header).
 */
export type CalendarMode = 'month' | 'week' | 'day'

/**
 * The app's `calendar-view` native module, injected by the screen. Shapes
 * follow the FIXED JS contract (modules/calendar-view/src/index.ts):
 *   NativeCalendarMonth({ events, selectedDate?, onSelectDate,
 *     onChangeVisibleMonth?, showEventBars?, style? })
 *   NativeCalendarDay({ events, date, onPressEvent, onChangeDate?, style? })
 * `showEventBars` is an OPTIONAL native month prop (regular-width tablets
 * render Apple-Calendar-style titled event bars; compact keeps dots) — older
 * module builds simply ignore it. The day timeline receives allDay events
 * unfiltered and renders its own native all-day row; the JS all-day strip
 * only renders in the fallback tier (never both).
 * Components are typed loosely on purpose — the module is built in parallel
 * and admin-native must not depend on its package types.
 */
export type CalendarNativeModule = {
  isNativeCalendarAvailable: boolean
  NativeCalendarMonth: React.ComponentType<any>
  NativeCalendarDay: React.ComponentType<any>
}

export type CalendarViewProps = {
  /** Already-filtered docs from the screen (local-first — no fetching here). */
  docs: CalendarDoc[]
  /** Date sources — multiple sources merge into one colour-coded event list. */
  sources: CalendarSource[]
  /** Field used as the event title (getDocumentTitle fallback chain). */
  useAsTitle?: string
  mode: CalendarMode
  onChangeMode: (mode: CalendarMode) => void
  /**
   * ISO date key 'YYYY-MM-DD' (local). Screens MUST seed this with
   * todayDateKey() — NEVER from event/doc data (deriving it from the first
   * mapped event once opened a Users calendar on a far-future
   * resetPasswordExpiration month). The view itself never re-seeds it; only
   * user navigation (taps/swipes/Today) calls onChangeSelectedDate.
   */
  selectedDate: string
  onChangeSelectedDate: (iso: string) => void
  /** Tap on an event row / native timeline block. */
  onPressDoc: (doc: CalendarDoc) => void
  /**
   * Screen-side wrapper injection around the default day-list row (e.g.
   * ScrollablePreview peek). The default row already owns the press.
   */
  renderDocRow?: (doc: CalendarDoc, defaultRow: React.ReactElement) => React.ReactElement
  /**
   * The app's `calendar-view` module. undefined (or
   * isNativeCalendarAvailable=false) → pure-JS fallbacks render.
   */
  nativeModule?: CalendarNativeModule
}

// ---------------------------------------------------------------------------
// Palette + limits
// ---------------------------------------------------------------------------

/** Stable pleasant palette — shared with the kanban board (iOS system hues). */
export const DEFAULT_CALENDAR_PALETTE: readonly string[] = DEFAULT_KANBAN_PALETTE

/** Max dots rendered in a month cell (mirrors the native month grid). */
export const MAX_MONTH_CELL_DOTS = 3
/** Max range strips rendered in a month cell. */
export const MAX_MONTH_CELL_STRIPS = 2
/** Max titled event-bar lanes per month week row (regular width only). */
export const MAX_MONTH_CELL_BARS = 3
/** Cap multi-day expansion so bad data can't explode the date buckets. */
export const MAX_EVENT_SPAN_DAYS = 62
/** Compact-width breakpoint: below this the month grid keeps dots. */
export const CALENDAR_COMPACT_WIDTH = 600
/**
 * Regular-width breakpoint (iPad-class): at/above this the calendar opts
 * into the iPad layout — single-row glass header (segmented + Today +
 * legend), month grid filling the available height with the selected-day
 * list as a right side panel, full-width week strip with larger pills, and
 * a centred max-width day timeline.
 */
export const CALENDAR_REGULAR_WIDTH = 768

// ---------------------------------------------------------------------------
// Pure date helpers (all LOCAL time — date keys are 'YYYY-MM-DD')
// ---------------------------------------------------------------------------

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** Local date → 'YYYY-MM-DD'. */
export const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/**
 * 'YYYY-MM-DD' (or any ISO string starting with one) → local midnight Date.
 * Returns null for unparseable input.
 */
export const parseDateKey = (key: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(key)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Today as a local date key. */
export const todayDateKey = (): string => toDateKey(new Date())

/** Shift a date key by N days (negative = back). Invalid keys pass through. */
export const addDaysToKey = (key: string, days: number): string => {
  const d = parseDateKey(key)
  if (!d) return key
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

/**
 * Normalise a native-event date payload ('YYYY-MM-DD' or full ISO) to a
 * local date key. Prefers the literal date prefix so the native module's
 * day semantics survive timezone parsing.
 */
export const normalizeDateKey = (value: string): string => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  if (m) return m[1]
  const d = parseDateKey(value)
  return d ? toDateKey(d) : value
}

const isoToDate = (iso: string): Date | null => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

// ---------------------------------------------------------------------------
// Week helpers (shared by the week-strip header and the month grid fallback)
// ---------------------------------------------------------------------------

/**
 * First day of week as a JS day index (0=Sun…6=Sat) from Intl.Locale
 * weekInfo when the engine exposes it; Monday default.
 */
export const getFirstDayOfWeek = (): number => {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    const loc: any = new (Intl as any).Locale(locale)
    const info = loc.weekInfo ?? loc.getWeekInfo?.()
    const first = info?.firstDay // 1=Mon … 7=Sun
    // Self-check: weekInfo 1 (Mon) → 1%7 = JS day 1 (Mon) ✓; weekInfo 7
    // (Sun) → 7%7 = JS day 0 (Sun) ✓ — never confuse with Sun=0 indices.
    if (typeof first === 'number' && first >= 1 && first <= 7) return first % 7
  } catch {
    /* Intl.Locale/weekInfo unavailable */
  }
  return 1
}

/**
 * Date key of the first day of the week containing `dateKey`.
 *
 * Weekday-column self-check (JS getDay() is Sun=0…Sat=6): the offset of a
 * date inside a Mon-start week (firstDayOfWeek=1) is
 *   (getDay() - 1 + 7) % 7 ≡ (getDay() + 6) % 7.
 * 2026-08-02 is a Sunday (getDay()=0) → offset (0+6)%7 = 6 → it is the LAST
 * column of a Mon-start week, and its week starts on Mon 2026-07-27.
 */
export const weekStartKey = (dateKey: string, firstDayOfWeek: number): string => {
  const d = parseDateKey(dateKey)
  if (!d) return dateKey
  const offset = (d.getDay() - firstDayOfWeek + 7) % 7
  d.setDate(d.getDate() - offset)
  return toDateKey(d)
}

/** The 7 date keys of the week containing `dateKey` (locale week start). */
export const weekKeysForDate = (dateKey: string, firstDayOfWeek: number): string[] => {
  const start = weekStartKey(dateKey, firstDayOfWeek)
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i))
}

// ---------------------------------------------------------------------------
// Pure event helpers
// ---------------------------------------------------------------------------

/** True when the event has an end on a different (local) day than its start. */
export const isMultiDayEvent = (event: CalendarEvent): boolean => {
  if (!event.end) return false
  const start = isoToDate(event.start)
  const end = isoToDate(event.end)
  if (!start || !end) return false
  return toDateKey(start) !== toDateKey(end)
}

/** True when the event overlaps the given local date key (inclusive). */
export const eventOccursOnDate = (event: CalendarEvent, dateKey: string): boolean => {
  const start = isoToDate(event.start)
  if (!start) return false
  const startKey = toDateKey(start)
  const end = event.end ? isoToDate(event.end) : null
  const endKey = end ? toDateKey(end) : startKey
  // Date keys are zero-padded → lexicographic order === chronological order.
  return startKey <= dateKey && dateKey <= endKey
}

/**
 * Bucket events per covered local date key (multi-day events appear under
 * every day they span, capped at MAX_EVENT_SPAN_DAYS). Buckets preserve the
 * input order — feed pre-sorted events for chronological buckets.
 */
export const buildEventsByDateKey = (
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> => {
  const map = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    const start = isoToDate(event.start)
    if (!start) continue
    const end = event.end ? isoToDate(event.end) : null
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const last = end
      ? new Date(end.getFullYear(), end.getMonth(), end.getDate())
      : new Date(cursor)
    let steps = 0
    while (cursor.getTime() <= last.getTime() && steps <= MAX_EVENT_SPAN_DAYS) {
      const key = toDateKey(cursor)
      const bucket = map.get(key)
      if (bucket) bucket.push(event)
      else map.set(key, [event])
      cursor.setDate(cursor.getDate() + 1)
      steps += 1
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// Pure formatting helpers (Intl with safe fallbacks — Hermes ships Intl)
// ---------------------------------------------------------------------------

/** '2:30 PM' / '14:30' per device locale. */
export const formatTimeOfDay = (d: Date): string => {
  try {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }
}

const formatShortDate = (d: Date): string => {
  try {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return toDateKey(d)
  }
}

/** 'Wed, June 11' per device locale — day-mode nav / day-list headers. */
export const formatLongDate = (dateKey: string): string => {
  const d = parseDateKey(dateKey)
  if (!d) return dateKey
  try {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })
  } catch {
    return dateKey
  }
}

/**
 * 'Jun 8 – 14' (same month) / 'Jun 30 – Jul 6' (cross month) for a week's
 * [first, last] date keys — the week-strip header label.
 */
export const formatWeekRangeLabel = (firstKey: string, lastKey: string): string => {
  const first = parseDateKey(firstKey)
  const last = parseDateKey(lastKey)
  if (!first || !last) return `${firstKey} – ${lastKey}`
  try {
    const left = first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const right =
      first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
        ? String(last.getDate())
        : last.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${left} – ${right}`
  } catch {
    return `${firstKey} – ${lastKey}`
  }
}

/**
 * Display range for an event row:
 *  - allDay            → 'All day'
 *  - point (no end)    → '2:30 PM'
 *  - same-day range    → '2:30 PM – 4:00 PM'
 *  - multi-day range   → 'Jun 10, 2:30 PM – Jun 12, 4:00 PM'
 */
export const formatEventTimeRange = (event: CalendarEvent): string => {
  if (event.allDay) return 'All day'
  const start = isoToDate(event.start)
  if (!start) return ''
  const startTime = formatTimeOfDay(start)
  const end = event.end ? isoToDate(event.end) : null
  if (!end) return startTime
  if (toDateKey(start) === toDateKey(end)) return `${startTime} – ${formatTimeOfDay(end)}`
  return `${formatShortDate(start)}, ${startTime} – ${formatShortDate(end)}, ${formatTimeOfDay(end)}`
}
