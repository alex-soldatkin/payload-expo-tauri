/**
 * Scheduling barrel — the shared, view-agnostic source/event layer behind
 * every scheduling surface (calendar month/week/day today, gantt next).
 *
 * Pure data + math only: ScheduleEvent/ScheduleSource contracts, doc→event
 * mapping, default-source heuristics, local date-key utilities, week math and
 * the gantt date<->x scale. No React components, no rendering constants —
 * those live in calendar/ (and the gantt module next).
 *
 * Compat: the Calendar* names this module grew out of (CalendarEvent,
 * CalendarSource, docsToCalendarEvents, …) are re-exported as exact aliases;
 * calendar/index.ts re-exports them so app imports never changed.
 */

// Contracts + palette
export {
  DEFAULT_CALENDAR_PALETTE,
  DEFAULT_SCHEDULE_PALETTE,
  MAX_EVENT_SPAN_DAYS,
} from './types'
export type {
  CalendarDoc,
  CalendarEvent,
  CalendarSource,
  ScheduleDoc,
  ScheduleEvent,
  ScheduleSource,
} from './types'

// Local date-key + week math
export {
  addDaysToKey,
  getFirstDayOfWeek,
  isoToDate,
  normalizeDateKey,
  parseDateKey,
  toDateKey,
  todayDateKey,
  weekKeysForDate,
  weekStartKey,
} from './dateKeys'

// docs + sources → events, default-source heuristics
export {
  calendarEventDocId,
  collectionHasCalendarDateFields,
  collectionHasScheduleDateFields,
  docsToCalendarEvents,
  docsToScheduleEvents,
  INTERNAL_DATE_FIELDS,
  pickDefaultSources,
  scheduleEventDocId,
} from './eventMapping'
export type { CalendarFieldLike, ScheduleFieldLike } from './eventMapping'

// Pure event occurrence / bucketing / formatting helpers
export {
  buildEventsByDateKey,
  eventOccursOnDate,
  formatEventTimeRange,
  formatLongDate,
  formatTimeOfDay,
  formatWeekRangeLabel,
  isMultiDayEvent,
} from './events'

// Gantt date<->x scale + range clamping
export {
  clampDateRange,
  createGanttScale,
  dateKeyFromDayIndex,
  dayIndexFromKey,
  DEFAULT_GANTT_PX_PER_DAY,
} from './ganttScale'
export type { DateKeyRange, GanttScale } from './ganttScale'
