/**
 * Scheduling — shared, view-agnostic event/source contracts + palette.
 *
 * The single home for everything the calendar AND gantt views share: the
 * ScheduleEvent/ScheduleSource shapes, the doc→event mapping, date-key math
 * and the default palette. Rendering-specific bits (month-cell caps, width
 * breakpoints, CalendarViewProps) stay in calendar/types.ts; gantt rendering
 * will keep its own equivalents.
 *
 * Naming compat: this module grew out of calendar/ — the Calendar* names
 * (CalendarEvent/CalendarSource/CalendarDoc, docsToCalendarEvents, …) are
 * preserved as exact aliases so existing imports keep working unchanged.
 */
import { DEFAULT_KANBAN_PALETTE } from '../kanban/types'

// ---------------------------------------------------------------------------
// Public contracts
// ---------------------------------------------------------------------------

/** A Payload doc as stored in RxDB / returned by the REST API. */
export type ScheduleDoc = Record<string, unknown>
/** Compat alias — the calendar's original name for ScheduleDoc. */
export type CalendarDoc = ScheduleDoc

/**
 * Local mirror of the app's `calendar-view` native module event shape
 * (admin-native cannot import from the app's modules/ directory — the FIXED
 * JS contract is duplicated here and must stay in sync). The gantt view
 * consumes the same shape: start/end ISO datetimes map to bar extents.
 */
export type ScheduleEvent = {
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
/** Compat alias — the calendar's original name for ScheduleEvent. */
export type CalendarEvent = ScheduleEvent

/**
 * One date(-range) mapping from doc fields to schedule events — the shared
 * config entry shape behind the server `view-presets` calendarSources AND
 * ganttSources fields: { id, label, startField, endField?, color, hidden? }.
 */
export type ScheduleSource = {
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
/** Compat alias — the calendar's original name for ScheduleSource. */
export type CalendarSource = ScheduleSource

// ---------------------------------------------------------------------------
// Palette + limits
// ---------------------------------------------------------------------------

/** Stable pleasant palette — shared with the kanban board (iOS system hues). */
export const DEFAULT_SCHEDULE_PALETTE: readonly string[] = DEFAULT_KANBAN_PALETTE
/** Compat alias — the calendar's original name for DEFAULT_SCHEDULE_PALETTE. */
export const DEFAULT_CALENDAR_PALETTE: readonly string[] = DEFAULT_SCHEDULE_PALETTE

/** Cap multi-day expansion so bad data can't explode the date buckets. */
export const MAX_EVENT_SPAN_DAYS = 62
