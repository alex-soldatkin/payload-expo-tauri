// Pure month-grid + date-key math for the calendar view. Kept free of React so
// it is trivially testable. All keys are LOCAL 'YYYY-MM-DD' — day-only values
// snap to their literal date part (mirrors admin-native's eventMapping so a
// '2026-06-11T00:00:00.000Z' never slips to the previous local day west of UTC).

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}/

/** Local 'YYYY-MM-DD' key for a Date. */
export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today's local date key (seed for navigation / today highlight). */
export function todayKey(): string {
  return dateKey(new Date())
}

/**
 * The LOCAL day key a raw field value falls on, or null when unparseable.
 * String values with a literal 'YYYY-MM-DD' prefix use that prefix directly
 * (day-only storage names a calendar day, not an instant); numbers / Date /
 * full ISO datetimes parse to a Date and read their local day.
 */
export function valueDayKey(value: unknown): string | null {
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return null
    const m = DATE_ONLY_RE.exec(s)
    if (m) return m[0]
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : dateKey(d)
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : dateKey(d)
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : dateKey(value)
  }
  return null
}

/** Monday-based weekday index (Mon=0 … Sun=6). */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

export type MonthCursor = { year: number; month: number } // month: 0-11

/** Cursor for the month containing `key` (or today when omitted). */
export function cursorFromKey(key: string): MonthCursor {
  const [y, m] = key.split('-').map(Number)
  return { year: y, month: (m ?? 1) - 1 }
}

/** Step a cursor by whole months, normalising year rollover. */
export function stepMonth(c: MonthCursor, delta: number): MonthCursor {
  const d = new Date(c.year, c.month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

/** Human month label, e.g. 'July 2026'. */
export function monthLabel(c: MonthCursor): string {
  return new Date(c.year, c.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export type GridDay = { key: string; day: number; inMonth: boolean }

/**
 * The 42 cells (6 rows × 7 Mon-start columns) covering the cursor's month,
 * padded with leading/trailing days from the adjacent months.
 */
export function monthGrid(c: MonthCursor): GridDay[] {
  const first = new Date(c.year, c.month, 1)
  const start = new Date(c.year, c.month, 1 - mondayIndex(first))
  const cells: GridDay[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push({ key: dateKey(d), day: d.getDate(), inMonth: d.getMonth() === c.month })
  }
  return cells
}

/** Mon-start weekday headers, locale-aware short names. */
export function weekdayLabels(): string[] {
  // 2024-01-01 is a Monday — walk 7 days for locale short names.
  const base = new Date(2024, 0, 1)
  return Array.from({ length: 7 }, (_, i) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + i).toLocaleDateString(
      undefined,
      { weekday: 'short' },
    ),
  )
}
