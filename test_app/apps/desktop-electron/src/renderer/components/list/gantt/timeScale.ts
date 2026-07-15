// Pure time-domain + tick math for the gantt view. Kept free of React so it is
// trivially testable. The visible domain spans the earliest start to the latest
// end across all scheduled docs, padded a week on each side; with no dated docs
// it falls back to the current calendar month. Days map to a fixed pixel width
// so a bar's offset/length is pure arithmetic. Ticks are week starts (Monday) as
// gridlines plus month labels at each month boundary.

/** Fixed horizontal pixels per day — the whole timeline scales off this. */
export const DAY_WIDTH = 24

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}/

/**
 * Parse a raw field value to a Date at LOCAL midnight of the day it names.
 * Day-only strings ('YYYY-MM-DD…') snap to their literal date part (matching
 * the calendar's day-only handling so a value never slips a day west of UTC);
 * numbers / Date / full ISO datetimes read their local calendar day. Returns
 * null when unparseable.
 */
export function valueToDay(value: unknown): Date | null {
  let d: Date | null = null
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return null
    const m = DATE_ONLY_RE.exec(s)
    if (m) {
      const [y, mo, day] = m[0].split('-').map(Number)
      return new Date(y, mo - 1, day)
    }
    const parsed = new Date(s)
    d = Number.isNaN(parsed.getTime()) ? null : parsed
  } else if (typeof value === 'number') {
    const parsed = new Date(value)
    d = Number.isNaN(parsed.getTime()) ? null : parsed
  } else if (value instanceof Date) {
    d = Number.isNaN(value.getTime()) ? null : value
  }
  if (!d) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Whole days between two local-midnight days (b - a), rounded. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

/** A day shifted by whole days, preserving local midnight. */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** The Monday on or before `d` (local). */
export function weekStart(d: Date): Date {
  const dow = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
  return addDays(d, -dow)
}

export type TimeDomain = {
  /** Local-midnight day the timeline starts on (inclusive). */
  start: Date
  /** Local-midnight day the timeline ends on (inclusive). */
  end: Date
  /** Total day columns rendered (end - start + 1). */
  days: number
  /** Full timeline width in px (days * DAY_WIDTH). */
  width: number
}

/**
 * The visible domain: min(start) → max(end) across docs that have BOTH dates,
 * padded 1 week on each side. With no scheduled docs, falls back to the current
 * calendar month (also padded a week) so the axis is never empty.
 */
export function computeDomain(
  docs: Record<string, unknown>[],
  startField: string,
  endField: string,
): TimeDomain {
  let min: Date | null = null
  let max: Date | null = null
  for (const doc of docs) {
    const s = valueToDay(doc[startField])
    const e = valueToDay(doc[endField])
    if (!s || !e) continue
    const lo = s.getTime() <= e.getTime() ? s : e
    const hi = s.getTime() <= e.getTime() ? e : s
    if (!min || lo.getTime() < min.getTime()) min = lo
    if (!max || hi.getTime() > max.getTime()) max = hi
  }

  if (!min || !max) {
    // Fallback: current month.
    const now = new Date()
    min = new Date(now.getFullYear(), now.getMonth(), 1)
    max = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  }

  const start = addDays(min, -7)
  const end = addDays(max, 7)
  const days = daysBetween(start, end) + 1
  return { start, end, days, width: days * DAY_WIDTH }
}

/** Pixel x-offset from the domain start for a given day. */
export function dayToX(domain: TimeDomain, day: Date): number {
  return daysBetween(domain.start, day) * DAY_WIDTH
}

export type WeekTick = { x: number; date: Date }
export type MonthTick = { x: number; label: string }

/** Vertical gridlines at each week start (Monday) within the domain. */
export function weekTicks(domain: TimeDomain): WeekTick[] {
  const ticks: WeekTick[] = []
  let d = weekStart(domain.start)
  if (d.getTime() < domain.start.getTime()) d = addDays(d, 7)
  for (; d.getTime() <= domain.end.getTime(); d = addDays(d, 7)) {
    ticks.push({ x: dayToX(domain, d), date: new Date(d) })
  }
  return ticks
}

/** Month labels positioned at the first visible day of each month. */
export function monthTicks(domain: TimeDomain): MonthTick[] {
  const ticks: MonthTick[] = []
  let d = new Date(domain.start.getFullYear(), domain.start.getMonth(), 1)
  if (d.getTime() < domain.start.getTime()) {
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  }
  for (; d.getTime() <= domain.end.getTime(); d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    ticks.push({
      x: dayToX(domain, d),
      label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
    })
  }
  return ticks
}

/** X-offset of today's local day within the domain, or null when off-axis. */
export function todayX(domain: TimeDomain): number | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (today.getTime() < domain.start.getTime() || today.getTime() > domain.end.getTime()) {
    return null
  }
  return dayToX(domain, today)
}
