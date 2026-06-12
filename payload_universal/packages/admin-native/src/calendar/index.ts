/**
 * Calendar barrel — config-driven calendar over Payload docs.
 *
 * Screens import { CalendarView } and inject docs + sources + callbacks
 * (local-first; no expo-router or data fetching inside the package). The
 * app's native `calendar-view` module arrives via the `nativeModule` prop —
 * MonthGridFallback / DayListFallback render when it is absent.
 */
export { CalendarView } from './CalendarView'
export { MonthGridFallback } from './MonthGridFallback'
export type { MonthGridFallbackProps } from './MonthGridFallback'
export { CalendarEventRow, DayListFallback } from './DayListFallback'
export type { CalendarEventRowProps, DayListFallbackProps } from './DayListFallback'
export { WeekStrip } from './WeekStrip'
export type { WeekStripProps } from './WeekStrip'
export {
  calendarEventDocId,
  collectionHasCalendarDateFields,
  docsToCalendarEvents,
  INTERNAL_DATE_FIELDS,
  pickDefaultSources,
} from './eventMapping'
export type { CalendarFieldLike } from './eventMapping'
export {
  addDaysToKey,
  buildEventsByDateKey,
  CALENDAR_COMPACT_WIDTH,
  CALENDAR_REGULAR_WIDTH,
  DEFAULT_CALENDAR_PALETTE,
  eventOccursOnDate,
  formatEventTimeRange,
  formatLongDate,
  formatTimeOfDay,
  formatWeekRangeLabel,
  getFirstDayOfWeek,
  isMultiDayEvent,
  MAX_EVENT_SPAN_DAYS,
  MAX_MONTH_CELL_BARS,
  MAX_MONTH_CELL_DOTS,
  MAX_MONTH_CELL_STRIPS,
  normalizeDateKey,
  parseDateKey,
  toDateKey,
  todayDateKey,
  weekKeysForDate,
  weekStartKey,
} from './types'
export type {
  CalendarDoc,
  CalendarEvent,
  CalendarMode,
  CalendarNativeModule,
  CalendarSource,
  CalendarViewProps,
} from './types'
