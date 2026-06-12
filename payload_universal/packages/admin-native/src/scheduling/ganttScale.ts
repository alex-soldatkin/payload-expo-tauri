/**
 * Gantt scale — pure date-key <-> x-pixel mapping for the gantt timeline.
 *
 * The gantt surface is a horizontal day axis: every date key owns a fixed
 * `pxPerDay`-wide column, with x measured from an `epochKey` (the date key at
 * x = 0, normally the chart's left edge / earliest visible day). All maths is
 * whole-day and DST-immune: day indices are computed via Date.UTC on the
 * LITERAL 'YYYY-MM-DD' parts, never via local-midnight timestamp subtraction
 * (a 23/25-hour DST day would corrupt a divide-by-86400000 there).
 *
 * No React, no rendering — the gantt view (next phase) renders bars at
 * x = dayIndexFromKey(startKey, epochKey) * pxPerDay with width
 * (dayIndexFromKey(endKey, epochKey) - dayIndexFromKey(startKey, epochKey) + 1) * pxPerDay.
 */
import { addDaysToKey } from './dateKeys'

/** Milliseconds per UTC day — exact for Date.UTC arithmetic (no DST in UTC). */
const MS_PER_DAY = 86_400_000

/**
 * Default gantt density (px per day column) when the preset's
 * ganttOptions.pxPerDay is absent. ~7 columns per 360pt of width.
 */
export const DEFAULT_GANTT_PX_PER_DAY = 48

/** 'YYYY-MM-DD…' → UTC midnight timestamp of the LITERAL date, else null. */
const literalUtcMidnight = (key: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key)
  if (!m) return null
  const ts = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(ts) ? null : ts
}

/**
 * Whole-day index of `dateKey` relative to `epochKey` (both 'YYYY-MM-DD',
 * lexicographic-comparable). Negative for days before the epoch; null when
 * either key is unparseable.
 *
 * Self-check: dayIndexFromKey('2026-06-01', '2026-06-01') = 0;
 * dayIndexFromKey('2026-06-03', '2026-06-01') = 2;
 * dayIndexFromKey('2026-05-31', '2026-06-01') = -1; and across a DST change
 * (Europe: 2026-03-29 springs forward) dayIndexFromKey('2026-03-30',
 * '2026-03-28') = 2 exactly — UTC day arithmetic never sees the 23h day.
 */
export const dayIndexFromKey = (dateKey: string, epochKey: string): number | null => {
  const date = literalUtcMidnight(dateKey)
  const epoch = literalUtcMidnight(epochKey)
  if (date === null || epoch === null) return null
  return Math.round((date - epoch) / MS_PER_DAY)
}

/**
 * Date key at whole-day `dayIndex` from `epochKey` — the inverse of
 * dayIndexFromKey (negative indices step back). Invalid epochs pass through
 * unchanged (addDaysToKey semantics).
 *
 * Self-check: dateKeyFromDayIndex(2, '2026-06-01') = '2026-06-03' and
 * dayIndexFromKey(dateKeyFromDayIndex(n, e), e) === n for every valid epoch.
 */
export const dateKeyFromDayIndex = (dayIndex: number, epochKey: string): string =>
  addDaysToKey(epochKey, dayIndex)

/** A date-key <-> x mapping bound to one (epochKey, pxPerDay) pair. */
export type GanttScale = {
  /** Date key at x = 0. */
  epochKey: string
  /** Width of one day column in px (> 0). */
  pxPerDay: number
  /** x of a day column's LEFT edge. */
  xFromDayIndex: (dayIndex: number) => number
  /** Day index whose column contains pixel x (floor — left-inclusive). */
  dayIndexFromX: (x: number) => number
  /** Left edge x of `dateKey`'s column; null for unparseable keys. */
  xFromDateKey: (dateKey: string) => number | null
  /** Date key whose column contains pixel x. */
  dateKeyFromX: (x: number) => string
}

/**
 * Build a GanttScale. `pxPerDay` values <= 0 (or non-finite) fall back to
 * DEFAULT_GANTT_PX_PER_DAY — a zero scale would make dateKeyFromX divide by
 * zero and collapse every bar to x = 0.
 *
 * Self-check (epoch '2026-06-01', pxPerDay 48):
 *   xFromDateKey('2026-06-03') = 2 * 48 = 96;
 *   dateKeyFromX(95.9) → floor(95.9/48) = 1 → '2026-06-02' (column 1 spans
 *   [48, 96)); dateKeyFromX(96) → '2026-06-03'; negative x maps to days
 *   before the epoch (dateKeyFromX(-1) → floor(-1/48) = -1 → '2026-05-31').
 */
export const createGanttScale = (epochKey: string, pxPerDay: number): GanttScale => {
  const px =
    Number.isFinite(pxPerDay) && pxPerDay > 0 ? pxPerDay : DEFAULT_GANTT_PX_PER_DAY
  return {
    epochKey,
    pxPerDay: px,
    xFromDayIndex: (dayIndex) => dayIndex * px,
    dayIndexFromX: (x) => Math.floor(x / px),
    xFromDateKey: (dateKey) => {
      const idx = dayIndexFromKey(dateKey, epochKey)
      return idx === null ? null : idx * px
    },
    dateKeyFromX: (x) => dateKeyFromDayIndex(Math.floor(x / px), epochKey),
  }
}

/** An inclusive [startKey, endKey] date-key range. */
export type DateKeyRange = { startKey: string; endKey: string }

/**
 * Clamp an inclusive date-key range into inclusive bounds. Inverted inputs
 * (start after end — bad data) are normalised by swapping before clamping;
 * returns null when the range and bounds do not overlap at all. Pure string
 * comparison — zero-padded date keys order lexicographically.
 *
 * Self-check (bounds 2026-06-01..2026-06-30):
 *   {05-20..06-10} → {06-01..06-10} (left-clipped);
 *   {06-10..07-09} → {06-10..06-30} (right-clipped);
 *   {06-10..06-12} → unchanged (inside);
 *   {07-01..07-05} → null (disjoint);
 *   {06-12..06-10} → swapped to {06-10..06-12} first, then clamped.
 */
export const clampDateRange = (
  range: DateKeyRange,
  bounds: DateKeyRange,
): DateKeyRange | null => {
  let { startKey, endKey } = range
  if (endKey < startKey) [startKey, endKey] = [endKey, startKey]
  let { startKey: minKey, endKey: maxKey } = bounds
  if (maxKey < minKey) [minKey, maxKey] = [maxKey, minKey]
  if (endKey < minKey || startKey > maxKey) return null
  return {
    startKey: startKey < minKey ? minKey : startKey,
    endKey: endKey > maxKey ? maxKey : endKey,
  }
}
