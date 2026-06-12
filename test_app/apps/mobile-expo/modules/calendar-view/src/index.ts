import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core'
import * as React from 'react'
import { Platform, View, type ViewStyle } from 'react-native'

/**
 * Native iOS calendar views for the Payload admin:
 * - `NativeCalendarDay` — CalendarKit-backed day timeline (horizontal swipe
 *   changes the day; `allDay` events render in the native all-day header
 *   row, where taps fire `onPressEvent` like timeline taps).
 * - `NativeCalendarMonth` is permanently `null`: the HorizonCalendar-backed
 *   month grid was removed because CalendarKit and HorizonCalendar both
 *   export an ObjC-visible `DayView` class, and Xcode's generated `.Swift`
 *   compatibility submodules collide in any compilation that loads both
 *   modules ("'DayView' has different definitions in different modules" —
 *   EAS builds 001040f7/26700d0c/3decfce6; header suppression and modulemap
 *   stripping both fail because Xcode regenerates the product modulemap).
 *   Month mode renders admin-native's feature-complete JS MonthGridFallback
 *   (titled spanning bars, chips, "+N more", dots on compact) instead.
 *
 * iOS-only: on Android / web / Expo Go `isNativeCalendarAvailable` is `false`
 * and the day component renders an empty `View` — callers must check the
 * flag and provide their own JS fallback.
 */

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
  /** ISO date — highlighted day. */
  selectedDate?: string
  /**
   * Apple-Calendar-style titled event bars in the day cells (default `true`).
   * Pass `false` on compact width (iPhone-class) to keep the dots + range
   * strips presentation. Optional and backward-compatible — older native
   * builds without the prop keep their existing presentation.
   */
  showEventBars?: boolean
  onSelectDate: (e: { nativeEvent: { date: string } }) => void
  onChangeVisibleMonth?: (e: { nativeEvent: { year: number; month: number } }) => void
  style?: ViewStyle
}

export type NativeCalendarDayProps = {
  events: CalendarEvent[]
  /** ISO date — the day shown by the timeline. */
  date: string
  onPressEvent: (e: { nativeEvent: { id: string } }) => void
  /** Fired when a horizontal swipe moves to another day. */
  onChangeDate?: (e: { nativeEvent: { date: string } }) => void
  style?: ViewStyle
}

let NativeDayView: React.ComponentType<NativeCalendarDayProps> | null = null

if (Platform.OS === 'ios') {
  try {
    // Throws when the native module isn't installed (e.g. Expo Go or a dev
    // client built before this module existed).
    requireNativeModule('CalendarView')
    NativeDayView = requireNativeViewManager<NativeCalendarDayProps>(
      'CalendarView',
      'CalendarDayView',
    )
  } catch {
    NativeDayView = null
  }
}

export const isNativeCalendarAvailable: boolean = NativeDayView != null

/**
 * Always null — the native month grid was removed (DayView ObjC collision,
 * see module header). Consumers fall through to their JS month grid.
 */
export const NativeCalendarMonth: React.ComponentType<NativeCalendarMonthProps> | null = null

/** CalendarKit DayView timeline. */
export function NativeCalendarDay(props: NativeCalendarDayProps): React.JSX.Element {
  if (!NativeDayView) {
    return React.createElement(View, { style: props.style })
  }
  return React.createElement(NativeDayView, props)
}
