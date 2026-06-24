/**
 * MonthGridFallback — prop + domain types (grid math + lane layout).
 */
import type { CalendarEvent } from '../../scheduling'

export type MonthGridFallbackProps = {
  /** Merged event list (multi-day events bucket onto every covered day). */
  events: CalendarEvent[]
  /** 'YYYY-MM-DD' — highlighted cell; also seeds the visible month. */
  selectedDate: string
  onSelectDate: (iso: string) => void
  /** Fires after chevron/swipe month changes (month is 1-12). */
  onChangeVisibleMonth?: (visible: { year: number; month: number }) => void
  /**
   * Regular-width density: titled spanning bars (multi-day) + labelled chips
   * (single-day) per week row instead of dots/strips. Default false (dots).
   */
  showEventBars?: boolean
  /**
   * iPad-class layout: the grid card stretches to fill the available height —
   * week rows flex evenly (with hairline separators, Apple Calendar style),
   * the weekday header row stays pinned. Default false (intrinsic height).
   */
  fillHeight?: boolean
}

export type VisibleMonth = { year: number; month: number }

/** An event with its covered local date-key span (end clamps to >= start). */
export type EventSpan = { event: CalendarEvent; startKey: string; endKey: string }

/** One placed bar/chip within a week row. Columns are 0-6 (clamped). */
export type WeekBarSegment = {
  event: CalendarEvent
  lane: number
  startCol: number
  endCol: number
  /** Range continues from an earlier week row → square leading edge. */
  continuesBefore: boolean
  /** Range continues into a later week row → square trailing edge. */
  continuesAfter: boolean
  /** Multi-day → solid spanning bar; single-day → tinted labelled chip. */
  multiDay: boolean
}
