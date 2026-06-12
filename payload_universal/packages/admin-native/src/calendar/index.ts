/**
 * Calendar barrel — config-driven calendar over Payload docs.
 *
 * Screens import { CalendarView } and inject docs + sources + callbacks
 * (local-first; no expo-router or data fetching inside the package). The
 * app's native `calendar-view` module arrives via the `nativeModule` prop —
 * MonthGridFallback / DayListFallback render when it is absent.
 *
 * The view-agnostic source/event layer moved to ../scheduling (shared with
 * the gantt view); every name it grew out of is re-exported here unchanged,
 * so existing `from './calendar'` / main-barrel imports keep working.
 */
export { CalendarView } from './CalendarView'
export { MonthGridFallback } from './MonthGridFallback'
export type { MonthGridFallbackProps } from './MonthGridFallback'
export { CalendarEventRow, DayListFallback } from './DayListFallback'
export type { CalendarEventRowProps, DayListFallbackProps } from './DayListFallback'
export { WeekStrip } from './WeekStrip'
export type { WeekStripProps } from './WeekStrip'
// Shared scheduling layer — re-exported under the original calendar names.
export {
  calendarEventDocId,
  collectionHasCalendarDateFields,
  docsToCalendarEvents,
  INTERNAL_DATE_FIELDS,
  pickDefaultSources,
} from '../scheduling'
export type { CalendarFieldLike } from '../scheduling'
export {
  addDaysToKey,
  buildEventsByDateKey,
  DEFAULT_CALENDAR_PALETTE,
  eventOccursOnDate,
  formatEventTimeRange,
  formatLongDate,
  formatTimeOfDay,
  formatWeekRangeLabel,
  getFirstDayOfWeek,
  isMultiDayEvent,
  MAX_EVENT_SPAN_DAYS,
  normalizeDateKey,
  parseDateKey,
  toDateKey,
  todayDateKey,
  weekKeysForDate,
  weekStartKey,
} from '../scheduling'
export type { CalendarDoc, CalendarEvent, CalendarSource } from '../scheduling'
// Month/week/day rendering-specific types + constants.
export {
  CALENDAR_COMPACT_WIDTH,
  CALENDAR_REGULAR_WIDTH,
  MAX_MONTH_CELL_BARS,
  MAX_MONTH_CELL_DOTS,
  MAX_MONTH_CELL_STRIPS,
} from './types'
export type { CalendarMode, CalendarNativeModule, CalendarViewProps } from './types'
