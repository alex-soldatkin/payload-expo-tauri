/**
 * useCalendarEvents — docs → events derivation, the doc lookup + press
 * handler, the native-tier gate, the selectedDate contract guard, and the
 * selected-day / all-day / timed event splits.
 *
 * Pure data layer (no JSX): the component owns rendering, this owns the
 * memoised event maths and the native-timeline date guard.
 */
import { useCallback, useMemo, useRef } from 'react'

import {
  calendarEventDocId,
  dayIndexFromKey,
  docsToCalendarEvents,
  eventOccursOnDate,
  normalizeDateKey,
} from '../../../scheduling'
import type { CalendarDoc, CalendarEvent, CalendarSource } from '../../../scheduling'
import type { CalendarNativeModule } from '../../types'

export type UseCalendarEvents = {
  /** Full colour-coded event list across the currently-visible sources. */
  events: CalendarEvent[]
  /** id → doc lookup (string-keyed; null/undefined ids skipped). */
  docById: Map<string, CalendarDoc>
  /** Resolve an event id to its doc and fire onPressDoc. */
  handlePressEventId: (eventId: string) => void
  /** Native-timeline onChangeDate guard (accepts adjacent-day user swipes). */
  handleNativeTimelineDate: (raw: string) => void
  /** True when the screen injected a usable native calendar module. */
  nativeAvailable: boolean
  NativeMonth: CalendarNativeModule['NativeCalendarMonth']
  NativeDay: CalendarNativeModule['NativeCalendarDay']
  /** Events occurring on the selected date (month-mode day list). */
  selectedDayEvents: CalendarEvent[]
  /** Selected-day all-day events (fallback-tier all-day strip). */
  allDayEvents: CalendarEvent[]
  /** Timed events only (fallback timeline). */
  timedEvents: CalendarEvent[]
}

export function useCalendarEvents({
  docs,
  visibleSources,
  useAsTitle,
  selectedDate,
  onChangeSelectedDate,
  onPressDoc,
  nativeModule,
}: {
  docs: CalendarDoc[]
  visibleSources: CalendarSource[]
  useAsTitle?: string
  selectedDate: string
  onChangeSelectedDate: (iso: string) => void
  onPressDoc: (doc: CalendarDoc) => void
  nativeModule?: CalendarNativeModule
}): UseCalendarEvents {
  // ── Docs → events ─────────────────────────────────────────────────────
  const events = useMemo(
    () => docsToCalendarEvents(docs, visibleSources, useAsTitle),
    [docs, visibleSources, useAsTitle],
  )

  const docById = useMemo(() => {
    const map = new Map<string, CalendarDoc>()
    for (const doc of docs) {
      if (doc.id !== null && doc.id !== undefined) map.set(String(doc.id), doc)
    }
    return map
  }, [docs])

  const handlePressEventId = useCallback(
    (eventId: string) => {
      const doc = docById.get(calendarEventDocId(eventId))
      if (doc) onPressDoc(doc)
    },
    [docById, onPressDoc],
  )

  // ── selectedDate contract guard (week/day timeline) ────────────────────
  // types.ts: selectedDate is screen-seeded with todayDateKey() and NEVER
  // event-derived; every mode entry (segmented switch, preset apply, Today)
  // must inherit the CURRENT selection. The native CalendarKit timeline is
  // the ONLY surface that can PUSH a date into the selection without a user
  // tap (didMoveTo → onChangeDate) — and a USER page swipe always lands on a
  // day ADJACENT to the current selection (UIPageViewController emits one
  // didMoveTo per completed single-page transition). Anything else — mount-
  // time echoes from module builds whose internal DayViewState initialised
  // before/without the `date` prop (observed: entering week mode jumped the
  // selection to the first event's week, e.g. Products' Aug 2 release dates
  // clobbering a June 13 selection) — is rejected here so week mode can
  // never re-seed the selection from event data. The ref tracks the latest
  // accepted key synchronously so fast multi-page swipes (emissions arriving
  // before the prop round-trip) still chain ±1 moves correctly.
  const selectedDateRef = useRef(selectedDate)
  selectedDateRef.current = selectedDate
  const handleNativeTimelineDate = useCallback(
    (raw: string) => {
      const next = normalizeDateKey(raw)
      const current = selectedDateRef.current
      if (next === current) return // controlled-prop echo — no-op
      const distance = dayIndexFromKey(next, current)
      if (distance === null || Math.abs(distance) !== 1) return // not a user swipe
      selectedDateRef.current = next
      onChangeSelectedDate(next)
    },
    [onChangeSelectedDate],
  )

  // ── Native tier gate (screen-injected module; never imported here) ────
  const nativeAvailable = Boolean(nativeModule?.isNativeCalendarAvailable)
  const NativeMonth = nativeAvailable ? nativeModule!.NativeCalendarMonth : null
  const NativeDay = nativeAvailable ? nativeModule!.NativeCalendarDay : null

  // ── Selected-day rows (month mode, below the grid) ────────────────────
  const selectedDayEvents = useMemo(
    () => events.filter((ev) => eventOccursOnDate(ev, selectedDate)),
    [events, selectedDate],
  )

  // ── All-day split (week/day timeline) — the JS all-day strip owns these
  // in the FALLBACK tier only; the native tier passes them through and
  // trusts CalendarKit's all-day row (never both) ────────────────────────
  const allDayEvents = useMemo(
    () => selectedDayEvents.filter((ev) => Boolean(ev.allDay)),
    [selectedDayEvents],
  )
  const timedEvents = useMemo(() => events.filter((ev) => !ev.allDay), [events])

  return {
    events,
    docById,
    handlePressEventId,
    handleNativeTimelineDate,
    nativeAvailable,
    NativeMonth,
    NativeDay,
    selectedDayEvents,
    allDayEvents,
    timedEvents,
  }
}
