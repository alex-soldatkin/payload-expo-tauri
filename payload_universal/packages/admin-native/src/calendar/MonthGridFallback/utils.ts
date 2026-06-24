/**
 * MonthGridFallback — pure helpers: grid math, locale labels, event-bar lane
 * layout + the bar/swipe metric constants. No React, no JSX.
 */
import { toDateKey, parseDateKey } from '../../scheduling'
import type { CalendarEvent } from '../../scheduling'
import { MAX_MONTH_CELL_BARS } from '../types'
import type { EventSpan, VisibleMonth, WeekBarSegment } from './types'

/** Swipe must travel this far horizontally to change month. */
export const SWIPE_THRESHOLD = 40

// ── Event-bar metrics (showEventBars density) ──────────────────────────────
/**
 * Day-number badge zone height at the top of a bars-mode cell — the bars
 * overlay's lane block is pinned DIRECTLY below this (Apple Calendar: number
 * row at the top, bars stacked tight beneath, flexible empty space below).
 * Tracks the real badge box: barsCell paddingTop (3) + dayBadge height (26) +
 * a 3pt breathing gap = 32.
 */
export const BAR_BADGE_AREA = 32
export const BAR_HEIGHT = 16
export const BAR_GAP = 2
/** '+N more' overflow line height below the lanes. */
export const BAR_OVERFLOW_HEIGHT = 14
/**
 * Fixed height of the bar/overflow lane block (badge zone → last lane →
 * overflow line). The overlay is pinned to this height at the TOP of the week
 * row so the bars never float into the tall iPad cell's flexible bottom
 * space — the empty space is BELOW the block, not above it.
 */
export const BARS_LANE_BLOCK_HEIGHT =
  BAR_BADGE_AREA + MAX_MONTH_CELL_BARS * (BAR_HEIGHT + BAR_GAP) + BAR_OVERFLOW_HEIGHT
export const BARS_CELL_HEIGHT = BARS_LANE_BLOCK_HEIGHT

// ---------------------------------------------------------------------------
// Locale helpers (module-level — locale doesn't change while mounted)
// ---------------------------------------------------------------------------

const FALLBACK_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Short weekday label for a JS day index via Intl (2024-01-07 was a Sunday). */
export const weekdayLabel = (jsDay: number): string => {
  try {
    return new Date(2024, 0, 7 + jsDay).toLocaleDateString(undefined, { weekday: 'short' })
  } catch {
    return FALLBACK_WEEKDAYS[jsDay] ?? ''
  }
}

export const monthTitle = (year: number, month: number): string => {
  try {
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return `${year}-${String(month).padStart(2, '0')}`
  }
}

/**
 * All cell dates for a month (1-12) as full weeks starting on firstDayOfWeek.
 *
 * Column-placement self-check (JS getDay() is Sun=0…Sat=6; Mon-start weeks
 * use firstDayOfWeek=1, so a date's column is (getDay()-1+7)%7 ≡ (getDay()+6)%7):
 *   - 2026-08-01 is a Saturday (getDay()=6) → offset (6+6)%7 = 5 → August
 *     2026's first week starts on Mon 2026-07-27;
 *   - 2026-08-02 is a Sunday (getDay()=0) → column (0+6)%7 = 6 → it renders
 *     in the LAST column of a MON…SUN header, never under TUE.
 * Days fill each week sequentially from that start, so cell column i always
 * holds weekday (firstDayOfWeek + i) % 7 — exactly the header label order
 * built in `weekdayLabels` below.
 */
export const buildMonthWeeks = (
  year: number,
  month: number,
  firstDayOfWeek: number,
): Date[][] => {
  const first = new Date(year, month - 1, 1)
  const offset = (first.getDay() - firstDayOfWeek + 7) % 7
  const cursor = new Date(year, month - 1, 1 - offset)
  const weeks: Date[][] = []
  do {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  } while (cursor.getMonth() === month - 1)
  return weeks
}

export const visibleMonthOf = (dateKey: string): VisibleMonth => {
  const d = parseDateKey(dateKey) ?? new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

// ---------------------------------------------------------------------------
// Event-bar lane layout (showEventBars density) — pure week-row packing
// ---------------------------------------------------------------------------

export const buildEventSpans = (events: CalendarEvent[]): EventSpan[] => {
  const out: EventSpan[] = []
  for (const event of events) {
    const start = new Date(event.start)
    if (Number.isNaN(start.getTime())) continue
    const startKey = toDateKey(start)
    let endKey = startKey
    if (event.end) {
      const end = new Date(event.end)
      if (!Number.isNaN(end.getTime())) endKey = toDateKey(end)
    }
    if (endKey < startKey) endKey = startKey
    out.push({ event, startKey, endKey })
  }
  // Apple-style stacking: earlier start first, longer span wins ties — long
  // bars claim the top lanes so week runs stay visually continuous.
  out.sort((a, b) =>
    a.startKey !== b.startKey
      ? a.startKey.localeCompare(b.startKey)
      : b.endKey.localeCompare(a.endKey),
  )
  return out
}

/**
 * Pack a week row's overlapping events into MAX_MONTH_CELL_BARS lanes
 * (first-fit by sorted span order). Events that don't fit add to the per-cell
 * '+N more' overflow counts instead.
 */
export const buildWeekBarLayout = (
  weekKeys: string[],
  spans: EventSpan[],
): { segments: WeekBarSegment[]; overflow: number[] } => {
  const firstKey = weekKeys[0]
  const lastKey = weekKeys[6]
  const occupied: boolean[][] = [] // [lane][col]
  const segments: WeekBarSegment[] = []
  const overflow = new Array(7).fill(0) as number[]
  for (const { event, startKey, endKey } of spans) {
    if (endKey < firstKey || startKey > lastKey) continue
    const continuesBefore = startKey < firstKey
    const continuesAfter = endKey > lastKey
    const startCol = continuesBefore ? 0 : weekKeys.indexOf(startKey)
    const endCol = continuesAfter ? 6 : weekKeys.indexOf(endKey)
    if (startCol === -1 || endCol === -1 || endCol < startCol) continue
    let lane = 0
    while (
      lane < MAX_MONTH_CELL_BARS &&
      occupied[lane]?.slice(startCol, endCol + 1).some(Boolean)
    ) {
      lane += 1
    }
    if (lane >= MAX_MONTH_CELL_BARS) {
      for (let col = startCol; col <= endCol; col += 1) overflow[col] += 1
      continue
    }
    if (!occupied[lane]) occupied[lane] = new Array(7).fill(false) as boolean[]
    for (let col = startCol; col <= endCol; col += 1) occupied[lane][col] = true
    segments.push({
      event,
      lane,
      startCol,
      endCol,
      continuesBefore,
      continuesAfter,
      multiDay: startKey !== endKey,
    })
  }
  return { segments, overflow }
}
