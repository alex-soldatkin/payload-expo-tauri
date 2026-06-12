/**
 * Scheduling date-key utilities — pure LOCAL-time date math shared by every
 * scheduling surface (calendar month/week/day today; gantt next).
 *
 * Date keys are zero-padded 'YYYY-MM-DD' strings in LOCAL time, so
 * lexicographic order === chronological order (relied on throughout).
 */

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** Local date → 'YYYY-MM-DD'. */
export const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/**
 * 'YYYY-MM-DD' (or any ISO string starting with one) → local midnight Date.
 * Returns null for unparseable input.
 */
export const parseDateKey = (key: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(key)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Today as a local date key. */
export const todayDateKey = (): string => toDateKey(new Date())

/** Shift a date key by N days (negative = back). Invalid keys pass through. */
export const addDaysToKey = (key: string, days: number): string => {
  const d = parseDateKey(key)
  if (!d) return key
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

/**
 * Normalise a native-event date payload ('YYYY-MM-DD' or full ISO) to a
 * local date key. Prefers the literal date prefix so the native module's
 * day semantics survive timezone parsing.
 */
export const normalizeDateKey = (value: string): string => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value)
  if (m) return m[1]
  const d = parseDateKey(value)
  return d ? toDateKey(d) : value
}

/** ISO string → valid Date, else null. */
export const isoToDate = (iso: string): Date | null => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

// ---------------------------------------------------------------------------
// Week helpers (shared by the week-strip header and the month grid fallback)
// ---------------------------------------------------------------------------

/**
 * First day of week as a JS day index (0=Sun…6=Sat) from Intl.Locale
 * weekInfo when the engine exposes it; Monday default.
 */
export const getFirstDayOfWeek = (): number => {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale
    const loc: any = new (Intl as any).Locale(locale)
    const info = loc.weekInfo ?? loc.getWeekInfo?.()
    const first = info?.firstDay // 1=Mon … 7=Sun
    // Self-check: weekInfo 1 (Mon) → 1%7 = JS day 1 (Mon) ✓; weekInfo 7
    // (Sun) → 7%7 = JS day 0 (Sun) ✓ — never confuse with Sun=0 indices.
    if (typeof first === 'number' && first >= 1 && first <= 7) return first % 7
  } catch {
    /* Intl.Locale/weekInfo unavailable */
  }
  return 1
}

/**
 * Date key of the first day of the week containing `dateKey`.
 *
 * Weekday-column self-check (JS getDay() is Sun=0…Sat=6): the offset of a
 * date inside a Mon-start week (firstDayOfWeek=1) is
 *   (getDay() - 1 + 7) % 7 ≡ (getDay() + 6) % 7.
 * 2026-08-02 is a Sunday (getDay()=0) → offset (0+6)%7 = 6 → it is the LAST
 * column of a Mon-start week, and its week starts on Mon 2026-07-27.
 */
export const weekStartKey = (dateKey: string, firstDayOfWeek: number): string => {
  const d = parseDateKey(dateKey)
  if (!d) return dateKey
  const offset = (d.getDay() - firstDayOfWeek + 7) % 7
  d.setDate(d.getDate() - offset)
  return toDateKey(d)
}

/** The 7 date keys of the week containing `dateKey` (locale week start). */
export const weekKeysForDate = (dateKey: string, firstDayOfWeek: number): string[] => {
  const start = weekStartKey(dateKey, firstDayOfWeek)
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i))
}
