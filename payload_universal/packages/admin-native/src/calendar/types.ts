/**
 * Calendar view — month/week/day rendering-specific types and constants.
 *
 * Injection-friendly (mirrors the kanban module): the component never imports
 * expo-router, never fetches data and never touches the app's native
 * `calendar-view` module directly. The screen injects already-filtered docs,
 * the press/mode/date callbacks and — when the app has the native module
 * compiled in — the module itself via `nativeModule` (JS fallbacks render
 * otherwise).
 *
 * The view-agnostic layer (ScheduleEvent/ScheduleSource contracts, doc→event
 * mapping, date-key/week math, palette) lives in ../scheduling — shared with
 * the gantt view. Only what is specific to the month/week/day surfaces stays
 * here: the mode/native-module/view-props contracts and the month-cell /
 * width-breakpoint rendering constants. calendar/index.ts re-exports the
 * shared names so existing imports never changed.
 */
import type React from 'react'

import type { CalendarDoc, CalendarSource } from '../scheduling'

// ---------------------------------------------------------------------------
// Public contracts (view-specific — the event/source shapes are ../scheduling)
// ---------------------------------------------------------------------------

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
  // null when the native view isn't registered (e.g. Expo Go) — the module
  // exports `ComponentType | null` and consumers gate on
  // isNativeCalendarAvailable before rendering.
  NativeCalendarMonth: React.ComponentType<any> | null
  NativeCalendarDay: React.ComponentType<any> | null
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
// Month/week/day rendering constants
// ---------------------------------------------------------------------------

/** Max dots rendered in a month cell (mirrors the native month grid). */
export const MAX_MONTH_CELL_DOTS = 3
/** Max range strips rendered in a month cell. */
export const MAX_MONTH_CELL_STRIPS = 2
/** Max titled event-bar lanes per month week row (regular width only). */
export const MAX_MONTH_CELL_BARS = 3
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
