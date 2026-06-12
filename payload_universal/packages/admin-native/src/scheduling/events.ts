/**
 * Scheduling event helpers — pure occurrence / bucketing / formatting
 * functions over ScheduleEvent, shared by the calendar fallbacks today and
 * the gantt view next. No rendering, no React.
 *
 * Formatting uses Intl with safe fallbacks — Hermes ships Intl.
 */
import { isoToDate, parseDateKey, toDateKey } from './dateKeys'
import { MAX_EVENT_SPAN_DAYS } from './types'
import type { ScheduleEvent } from './types'

// ---------------------------------------------------------------------------
// Pure event helpers
// ---------------------------------------------------------------------------

/** True when the event has an end on a different (local) day than its start. */
export const isMultiDayEvent = (event: ScheduleEvent): boolean => {
  if (!event.end) return false
  const start = isoToDate(event.start)
  const end = isoToDate(event.end)
  if (!start || !end) return false
  return toDateKey(start) !== toDateKey(end)
}

/** True when the event overlaps the given local date key (inclusive). */
export const eventOccursOnDate = (event: ScheduleEvent, dateKey: string): boolean => {
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
  events: ScheduleEvent[],
): Map<string, ScheduleEvent[]> => {
  const map = new Map<string, ScheduleEvent[]>()
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

const pad2 = (n: number): string => String(n).padStart(2, '0')

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
export const formatEventTimeRange = (event: ScheduleEvent): string => {
  if (event.allDay) return 'All day'
  const start = isoToDate(event.start)
  if (!start) return ''
  const startTime = formatTimeOfDay(start)
  const end = event.end ? isoToDate(event.end) : null
  if (!end) return startTime
  if (toDateKey(start) === toDateKey(end)) return `${startTime} – ${formatTimeOfDay(end)}`
  return `${formatShortDate(start)}, ${startTime} – ${formatShortDate(end)}, ${formatTimeOfDay(end)}`
}
