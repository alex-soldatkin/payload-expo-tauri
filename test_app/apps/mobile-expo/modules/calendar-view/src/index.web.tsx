// Web fallback — native calendar views are iOS-only no-ops here.
import * as React from 'react'
import type { ViewStyle } from 'react-native'

export type CalendarEvent = {
  id: string
  title: string
  /**
   * ISO datetime (or `yyyy-MM-dd`) string. A bare date-only start is treated
   * as all-day (same as `allDay: true`).
   */
  start: string
  /** ISO; absent = point event (month: dot/chip; day view: 30min block). */
  end?: string
  /** All-day: month bars span whole days; day view uses the all-day row. */
  allDay?: boolean
  /** Hex color, e.g. '#3478f6'. */
  color?: string
}

export type NativeCalendarMonthProps = {
  events: CalendarEvent[]
  selectedDate?: string
  /** Titled event bars (default true); false = compact dots presentation. */
  showEventBars?: boolean
  onSelectDate: (e: { nativeEvent: { date: string } }) => void
  onChangeVisibleMonth?: (e: { nativeEvent: { year: number; month: number } }) => void
  style?: ViewStyle
}

export type NativeCalendarDayProps = {
  events: CalendarEvent[]
  date: string
  onPressEvent: (e: { nativeEvent: { id: string } }) => void
  onChangeDate?: (e: { nativeEvent: { date: string } }) => void
  style?: ViewStyle
}

export const isNativeCalendarAvailable = false

/** Always null — matches the native entry (month grid removed; JS fallback). */
export const NativeCalendarMonth: React.ComponentType<NativeCalendarMonthProps> | null = null

export function NativeCalendarDay(_props: NativeCalendarDayProps): React.JSX.Element {
  return <></>
}
