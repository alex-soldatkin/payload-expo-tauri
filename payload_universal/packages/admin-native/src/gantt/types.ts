/**
 * Gantt chart — public types, rendering constants and pure helpers.
 *
 * Injection-friendly (mirrors the kanban/calendar modules): the chart never
 * imports expo-router and never fetches data. The screen supplies
 * already-filtered docs, the configured ScheduleSources (same
 * {id,label,startField,endField?,color,hidden?} entries as the calendar /
 * the server view-presets ganttSources field) and the press/preview/update
 * callbacks; date edits land in `onUpdateDates` and the screen patches the
 * fields via a local-first mutation.
 *
 * Everything view-agnostic (doc→event mapping, date-key math, the
 * date<->x GanttScale) comes from ../scheduling — NOTHING is duplicated
 * here. This file only adds the gantt-specific row/lane model on top.
 */
import { getDocumentTitle } from '../utils/schemaHelpers'
import {
  addDaysToKey,
  dayIndexFromKey,
  docsToScheduleEvents,
  isoToDate,
  scheduleEventDocId,
  toDateKey,
} from '../scheduling'
import type {
  DateKeyRange,
  ScheduleDoc,
  ScheduleEvent,
  ScheduleSource,
} from '../scheduling'

// ---------------------------------------------------------------------------
// Public prop contract
// ---------------------------------------------------------------------------

export type GanttChartProps = {
  /** Already-filtered docs from the screen (local-first — no fetching here). */
  docs: ScheduleDoc[]
  /**
   * Date sources — one bar per doc per visible source (`hidden` sources are
   * skipped). Sources WITHOUT an `endField` produce point events rendered as
   * 16pt diamonds (shiftable, not resizable).
   */
  sources: ScheduleSource[]
  /** Field used as the row/bar title (getDocumentTitle fallback chain). */
  useAsTitle?: string
  /** Tap on a bar body (or a frozen-column title row) → open the doc. */
  onPressBar: (doc: ScheduleDoc) => void
  /**
   * Long-press a bar body and release WITHOUT moving (< 8pt of travel —
   * the kanban static-hold disambiguation) → the screen presents its JS
   * preview sheet. Screens must NOT wrap bars in native long-press peek
   * triggers (ScrollablePreview.Trigger): a raw UIKit recognizer would claim
   * the press before the JS long-press that powers drag-or-peek ever fires.
   */
  onPreviewDoc?: (doc: ScheduleDoc) => void
  /**
   * EDIT callback — fired once per completed drag (handle resize or body
   * shift), with day-snapped ISO datetimes that preserve the original
   * wall-clock time of day. The screen patches `source.startField` /
   * `source.endField` (point sources: write only the start). Bars derive
   * PURELY from `docs`, so optimistic UI and failure spring-back are the
   * screen's job via its local-first write + re-render. Rejections are
   * swallowed by the chart — surface errors in the screen (e.g. a toast).
   */
  onUpdateDates: (
    doc: ScheduleDoc,
    source: ScheduleSource,
    next: { start: string; end: string },
  ) => Promise<void> | void
  /** Docs with a patch in flight — their bars render dimmed and non-editable. */
  readOnlyDocIds?: string[]
  /**
   * Day column width in px. Default GANTT_CHART_DEFAULT_PX_PER_DAY (28 — a
   * phone-friendly density; the preset-level fallback constant
   * DEFAULT_GANTT_PX_PER_DAY in ../scheduling stays 48 for wide screens).
   */
  pxPerDay?: number
}

/** Which part of a bar a drag is editing. */
export type GanttDragMode = 'body' | 'left' | 'right'

// ---------------------------------------------------------------------------
// Rendering constants
// ---------------------------------------------------------------------------

/**
 * Component-level pxPerDay default (~13 day columns per phone width). The
 * scheduling module's DEFAULT_GANTT_PX_PER_DAY (48) remains the documented
 * fallback for the server preset's ganttOptions.pxPerDay — screens pass the
 * preset value through and this constant only applies when the prop is absent.
 */
export const GANTT_CHART_DEFAULT_PX_PER_DAY = 28
/** Frozen title column width (absolute overlay on the left). */
export const GANTT_TITLE_COLUMN_WIDTH = 150
/** Sticky time-axis header height (month band + day ticks). */
export const GANTT_AXIS_HEIGHT = 46
/** Bar height within a lane. */
export const GANTT_BAR_HEIGHT = 24
/** Vertical gap between lanes in a row. */
export const GANTT_LANE_GAP = 4
/** Vertical padding above/below a row's lanes. */
export const GANTT_ROW_VERTICAL_PADDING = 7
/** Row height for 0/1-lane rows. */
export const GANTT_MIN_ROW_HEIGHT = GANTT_BAR_HEIGHT + GANTT_ROW_VERTICAL_PADDING * 2
/** Point-event diamond size. */
export const GANTT_POINT_SIZE = 16
/** Resize-handle hit-zone width (left/right ends of a bar). */
export const GANTT_HANDLE_WIDTH = 20
/** Bars at/above this width render their title text. */
export const GANTT_BAR_MIN_TITLE_WIDTH = 48
/** Regular-width breakpoint (iPad-class): visible grip affordance on handles. */
export const GANTT_REGULAR_WIDTH = 768
/** Long-press duration (ms) before a bar-body drag/peek arms. */
export const GANTT_BODY_HOLD_MS = 200
/**
 * Max finger travel (pt) for an armed body hold to count as STATIC on release
 * (open preview) rather than a shift — the kanban press disambiguation.
 */
export const GANTT_STATIC_PRESS_MAX_DIST = 8

/** Initial window padding before the earliest event (or today). */
export const GANTT_WINDOW_PAD_BEFORE_DAYS = 14
/** Initial window padding after the latest event (or today). */
export const GANTT_WINDOW_PAD_AFTER_DAYS = 30
/** Days appended to a window edge when scroll nears it. */
export const GANTT_EXTEND_DAYS = 60
/** Edge proximity (in day columns) that triggers a window extension. */
export const GANTT_EXTEND_THRESHOLD_DAYS = 7
/**
 * The AUTO-derived window never reaches further than this many days from
 * today in either direction — one corrupt far-future date must not inflate
 * the timeline (and its per-day axis ticks) to decades. Events beyond the
 * cap stay reachable through edge-scroll extensions.
 */
export const GANTT_MAX_AUTO_WINDOW_DAYS = 366

// ---------------------------------------------------------------------------
// Row / lane model (pure)
// ---------------------------------------------------------------------------

/** One placed bar (or point diamond) on a doc's row track. */
export type GanttBarSpec = {
  doc: ScheduleDoc
  source: ScheduleSource
  event: ScheduleEvent
  /** Local 'YYYY-MM-DD' of the bar's first day. */
  startKey: string
  /** Local 'YYYY-MM-DD' of the bar's last day (inclusive, >= startKey). */
  endKey: string
  /** Whole days covered (>= 1) — bar width = spanDays * pxPerDay. */
  spanDays: number
  /** Lane index within the row (0-based, packed first-fit). */
  lane: number
  /** Source has no endField → 16pt diamond, shiftable but not resizable. */
  point: boolean
}

/** One gantt row: a doc plus its lane-packed bars. */
export type GanttRowModel = {
  doc: ScheduleDoc
  docId: string
  title: string
  bars: GanttBarSpec[]
  laneCount: number
  /** Row track height in px (lanes + padding; min GANTT_MIN_ROW_HEIGHT). */
  height: number
}

/**
 * First-fit lane packing for one row's bars — the same greedy strategy as
 * MonthGridFallback's week-row packing (earlier start first, longer span wins
 * ties so long bars hold the top lanes), but per-DOC and without a lane cap:
 * the lane count is bounded by the number of visible sources, which is small.
 */
const packRowLanes = (bars: Array<Omit<GanttBarSpec, 'lane'>>): GanttBarSpec[] => {
  const sorted = [...bars].sort((a, b) =>
    a.startKey !== b.startKey
      ? a.startKey.localeCompare(b.startKey)
      : b.endKey.localeCompare(a.endKey),
  )
  // laneEnds[i] = last occupied endKey in lane i (keys compare lexicographic).
  const laneEnds: string[] = []
  return sorted.map((bar) => {
    let lane = laneEnds.findIndex((endKey) => endKey < bar.startKey)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(bar.endKey)
    } else {
      laneEnds[lane] = bar.endKey
    }
    return { ...bar, lane }
  })
}

/**
 * Build the row models: one row per doc (docs order preserved — the screen
 * owns sorting, e.g. the preset's ganttOptions.rowSort), bars from the SHARED
 * docsToScheduleEvents mapping over the visible (non-hidden) sources. Docs
 * without any dated event still get a row (empty track) so the chart stays
 * aligned with the screen's list. Docs without an id are skipped (they can't
 * round-trip through the event id `{docId}::{sourceId}` contract).
 */
export const buildGanttRows = (
  docs: ScheduleDoc[],
  sources: ScheduleSource[],
  useAsTitle?: string,
): GanttRowModel[] => {
  const visibleSources = sources.filter((s) => !s.hidden)
  const sourceById = new Map(visibleSources.map((s) => [s.id, s]))

  const docsById = new Map<string, ScheduleDoc>()
  for (const doc of docs) {
    if (doc.id === null || doc.id === undefined || doc.id === '') continue
    const id = String(doc.id)
    if (!docsById.has(id)) docsById.set(id, doc)
  }

  // Shared mapping — never duplicated. Source recovery: event ids are
  // `{docId}::{sourceId}`, so the source id is the remainder after the LAST
  // '::' (scheduleEventDocId splits on the same boundary).
  const events = docsToScheduleEvents(docs, visibleSources, useAsTitle)
  const barsByDoc = new Map<string, Array<Omit<GanttBarSpec, 'lane'>>>()
  for (const event of events) {
    const docId = scheduleEventDocId(event.id)
    const doc = docsById.get(docId)
    const source = sourceById.get(event.id.slice(docId.length + 2))
    if (!doc || !source) continue
    const start = isoToDate(event.start)
    if (!start) continue
    const startKey = toDateKey(start)
    const end = event.end ? isoToDate(event.end) : null
    let endKey = end ? toDateKey(end) : startKey
    if (endKey < startKey) endKey = startKey
    const point = !source.endField
    if (point) endKey = startKey // diamonds occupy exactly the start day
    const spanDays = (dayIndexFromKey(endKey, startKey) ?? 0) + 1
    const bucket = barsByDoc.get(docId)
    const spec = { doc, source, event, startKey, endKey, spanDays, point }
    if (bucket) bucket.push(spec)
    else barsByDoc.set(docId, [spec])
  }

  const rows: GanttRowModel[] = []
  const seen = new Set<string>()
  for (const doc of docs) {
    if (doc.id === null || doc.id === undefined || doc.id === '') continue
    const docId = String(doc.id)
    if (seen.has(docId)) continue
    seen.add(docId)
    const bars = packRowLanes(barsByDoc.get(docId) ?? [])
    const laneCount = bars.reduce((max, b) => Math.max(max, b.lane + 1), 0)
    const height =
      laneCount <= 1
        ? GANTT_MIN_ROW_HEIGHT
        : GANTT_ROW_VERTICAL_PADDING * 2 +
          laneCount * GANTT_BAR_HEIGHT +
          (laneCount - 1) * GANTT_LANE_GAP
    rows.push({
      doc,
      docId,
      title: getDocumentTitle(doc, useAsTitle),
      bars,
      laneCount,
      height,
    })
  }
  return rows
}

// ---------------------------------------------------------------------------
// Window derivation (pure)
// ---------------------------------------------------------------------------

/**
 * Initial (and minimum) visible window:
 *   min(event starts, today) − GANTT_WINDOW_PAD_BEFORE_DAYS
 *   … max(event ends, today) + GANTT_WINDOW_PAD_AFTER_DAYS,
 * with the event-derived bounds clamped to ±GANTT_MAX_AUTO_WINDOW_DAYS
 * around today (bad far-out dates must not explode the timeline). The chart
 * also calls this when `docs` change to GROW the live window (never shrink —
 * shrinking would shift the contentOffset under the user).
 */
export const initialGanttWindow = (
  rows: GanttRowModel[],
  todayKey: string,
): DateKeyRange => {
  let minKey = todayKey
  let maxKey = todayKey
  for (const row of rows) {
    for (const bar of row.bars) {
      if (bar.startKey < minKey) minKey = bar.startKey
      if (bar.endKey > maxKey) maxKey = bar.endKey
    }
  }
  const floorKey = addDaysToKey(todayKey, -GANTT_MAX_AUTO_WINDOW_DAYS)
  const ceilKey = addDaysToKey(todayKey, GANTT_MAX_AUTO_WINDOW_DAYS)
  if (minKey < floorKey) minKey = floorKey
  if (maxKey > ceilKey) maxKey = ceilKey
  return {
    startKey: addDaysToKey(minKey, -GANTT_WINDOW_PAD_BEFORE_DAYS),
    endKey: addDaysToKey(maxKey, GANTT_WINDOW_PAD_AFTER_DAYS),
  }
}

// ---------------------------------------------------------------------------
// Drag → next-dates math (pure)
// ---------------------------------------------------------------------------

/**
 * Shift an ISO datetime by whole LOCAL days, preserving the wall-clock time
 * of day (setDate steps calendar days — a DST change never skews the hour
 * the way ±N*86400000 would). Returns null for unparseable input.
 */
export const shiftIsoByDays = (iso: string, days: number): string | null => {
  const d = isoToDate(iso)
  if (!d) return null
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

/**
 * The next {start, end} ISO pair for a completed drag:
 *  - 'body'  → both edges shift by deltaDays (point events too — their end
 *              mirrors the start);
 *  - 'left'  → only the start shifts (the caller clamps deltaDays so the
 *              range keeps >= 1 day);
 *  - 'right' → only the end shifts (same clamp on the caller).
 * Events without an `end` use the start as the end baseline. Returns null
 * when either ISO is unparseable (the drag is then dropped, never thrown).
 *
 * Time-of-day inversion guard: the caller's clamp works at DAY granularity,
 * but wall-clock times can still invert inside the final day (start 14:00
 * resized onto an end day whose time is 10:00) — the moved edge then snaps
 * exactly onto the anchored edge so the emitted range is never inverted.
 */
export const computeNextRange = (
  event: ScheduleEvent,
  mode: GanttDragMode,
  deltaDays: number,
): { start: string; end: string } | null => {
  const start = shiftIsoByDays(event.start, mode === 'right' ? 0 : deltaDays)
  const end = shiftIsoByDays(event.end ?? event.start, mode === 'left' ? 0 : deltaDays)
  if (!start || !end) return null
  if (end < start) {
    // toISOString() is fixed-width UTC → lexicographic === chronological.
    if (mode === 'left') return { start: end, end }
    if (mode === 'right') return { start, end: start }
  }
  return { start, end }
}
