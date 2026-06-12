/**
 * Calendar event mapping — pure functions from Payload docs + configured
 * sources to the CalendarEvent shape shared with the native module, plus the
 * default-source heuristics that seed a collection's calendar config.
 *
 * Tolerant by design: docs with missing/invalid dates are skipped (never
 * thrown), inverted ranges swap with a console.warn, and field values may be
 * ISO strings, epoch numbers or Date instances (RxDB / REST both feed this).
 *
 * Weekday audit note: NO weekday/column math lives here — events map to
 * local 'YYYY-MM-DD' date keys only; week-column placement is owned by
 * MonthGridFallback/WeekStrip (see the (getDay()+6)%7 self-checks there).
 */
import { getByPath, getDocumentTitle } from '../utils/schemaHelpers'
import { humanizeFieldName } from '../kanban/types'
import { DEFAULT_CALENDAR_PALETTE } from './types'
import type { CalendarDoc, CalendarEvent, CalendarSource } from './types'

// ---------------------------------------------------------------------------
// docs + sources → events
// ---------------------------------------------------------------------------

/** Date-only strings ('2026-06-11') mark all-day events. */
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * ISO datetimes whose time component is exactly midnight
 * ('2026-06-11T00:00:00.000Z', '2026-06-11T00:00:00+03:00', …).
 *
 * STABLE allDay HEURISTIC (documented contract): Payload date fields with
 * `admin.date.pickerAppearance: 'dayOnly'` still store a FULL ISO datetime —
 * always at midnight. Field sources only carry field names (no admin config),
 * so day-only appearance is detected from the VALUE:
 *   raw start is date-only OR midnight-ISO,
 *   AND there is no end value (or the end is also date-only/midnight-ISO)
 *   ⇒ allDay.
 * A genuine timed event starting at exactly 00:00:00.000 with no end is the
 * accepted false positive of this heuristic.
 */
const MIDNIGHT_ISO_RE = /^\d{4}-\d{2}-\d{2}T00:00(:00(\.0+)?)?(Z|[+-]\d{2}:?\d{2})?$/

const isDayOnlyValue = (value: unknown): boolean => {
  if (typeof value !== 'string') return false
  const s = value.trim()
  return DATE_ONLY_RE.test(s) || MIDNIGHT_ISO_RE.test(s)
}

/**
 * Local midnight of a day-only value's LITERAL date part. Day-only values
 * name a calendar day, not an instant — '2026-06-11T00:00:00.000Z' parsed as
 * UTC lands on June 10 west of UTC, so allDay events snap to the literal
 * 'YYYY-MM-DD' prefix at local midnight (stable in every timezone).
 */
const literalLocalMidnight = (value: unknown): Date | null => {
  if (typeof value !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** ISO string / epoch number / Date → valid Date, else null. */
const parseDateValue = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return null
    // Parse date-only strings as LOCAL midnight (new Date('YYYY-MM-DD') is
    // UTC midnight, which lands on the previous local day west of UTC).
    const m = DATE_ONLY_RE.exec(s)
    if (m) {
      const [y, mo, day] = s.split('-').map(Number)
      const d = new Date(y, mo - 1, day)
      return Number.isNaN(d.getTime()) ? null : d
    }
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * Map docs through the configured sources into a merged, chronologically
 * sorted CalendarEvent list.
 *
 *  - id: `{docId}::{sourceId}` (recover the doc with id.lastIndexOf('::')).
 *  - title: getDocumentTitle(doc, useAsTitle) fallback chain.
 *  - Missing/invalid start → the (doc, source) pair is skipped.
 *  - end before start → values swap (console.warn, never throws).
 *  - Day-only field values (date-only strings AND midnight ISO datetimes —
 *    the dayOnly pickerAppearance storage shape; see isDayOnlyValue) mark the
 *    event allDay when the end is absent or also day-only, and allDay
 *    start/end snap to the literal date at LOCAL midnight.
 */
export const docsToCalendarEvents = (
  docs: CalendarDoc[],
  sources: CalendarSource[],
  useAsTitle?: string,
): CalendarEvent[] => {
  const events: CalendarEvent[] = []
  for (const doc of docs) {
    if (doc.id === null || doc.id === undefined || doc.id === '') continue
    const docId = String(doc.id)
    const title = getDocumentTitle(doc, useAsTitle)
    for (const source of sources) {
      // Dot-path lookup — the server 'view-presets' convention allows nested
      // date fields (e.g. 'scheduling.scheduledPublish').
      const startRaw = getByPath(doc, source.startField)
      const endRaw = source.endField ? getByPath(doc, source.endField) : undefined
      let start = parseDateValue(startRaw)
      if (!start) continue
      let end = endRaw === undefined ? null : parseDateValue(endRaw)
      if (end && end.getTime() < start.getTime()) {
        console.warn(
          `[CalendarView] doc ${docId} source "${source.id}": end (${source.endField}) is before start (${source.startField}) — swapped`,
        )
        const tmp = start
        start = end
        end = tmp
      }
      const allDay =
        isDayOnlyValue(startRaw) && (end === null || isDayOnlyValue(endRaw))
      if (allDay) {
        // Day-only values name a calendar DAY — pin to the literal date at
        // local midnight so timezone parsing never shifts the day.
        start = literalLocalMidnight(startRaw) ?? start
        if (end) end = literalLocalMidnight(endRaw) ?? end
      }
      events.push({
        id: `${docId}::${source.id}`,
        title,
        start: start.toISOString(),
        ...(end ? { end: end.toISOString() } : {}),
        ...(allDay ? { allDay: true } : {}),
        color: source.color,
      })
    }
  }
  // toISOString() is fixed-width UTC → lexicographic === chronological.
  events.sort((a, b) => a.start.localeCompare(b.start))
  return events
}

/** Recover the doc id from a CalendarEvent id (`{docId}::{sourceId}`). */
export const calendarEventDocId = (eventId: string): string => {
  const idx = eventId.lastIndexOf('::')
  return idx === -1 ? eventId : eventId.slice(0, idx)
}

// ---------------------------------------------------------------------------
// Default source heuristics
// ---------------------------------------------------------------------------

/**
 * Structural subset of ClientField — pickDefaultSources accepts the package's
 * ClientField[] (or anything shaped like it) without a hard type dependency.
 */
export type CalendarFieldLike = {
  name?: string
  type: string
  label?: string | Record<string, string>
}

/**
 * Payload-internal bookkeeping fields that must NEVER become calendar
 * sources: auth collections (Users) carry `resetPasswordExpiration` /
 * `lockUntil` as plain date fields, so without this exclusion every Users
 * collection offered a meaningless calendar of password-reset expiries.
 * The salt/hash/token/loginAttempts neighbours are not date-typed today but
 * are listed for defence in depth, and `createdAt`/`updatedAt`/`deletedAt`
 * (timestamps + trash) are bookkeeping, not content dates.
 *
 * Matching is by EXACT field name (top-level — Payload defines all of these
 * at the root). A user-defined nested date like `audit.updatedAt` keeps its
 * dot-path name ('audit.updatedAt') and is deliberately NOT excluded.
 */
export const INTERNAL_DATE_FIELDS: ReadonlySet<string> = new Set([
  // Auth bookkeeping (Payload auth: true collections)
  'resetPasswordExpiration',
  'resetPasswordToken',
  'salt',
  'hash',
  'loginAttempts',
  'lockUntil',
  // Timestamps / trash bookkeeping (every collection)
  'createdAt',
  'updatedAt',
  'deletedAt',
])

/**
 * True when the collection has at least one REAL (non-internal) date field —
 * the calendar-eligibility gate. Collections whose only date fields are
 * Payload bookkeeping (e.g. Users: createdAt/updatedAt/resetPasswordExpiration/
 * lockUntil) must not offer a Calendar view at all.
 */
export const collectionHasCalendarDateFields = (fields: CalendarFieldLike[]): boolean =>
  fields.some(
    (f) => f.type === 'date' && Boolean(f.name) && !INTERNAL_DATE_FIELDS.has(f.name!),
  )

const resolveFieldLabel = (field: CalendarFieldLike): string => {
  if (typeof field.label === 'string' && field.label) return field.label
  if (field.label && typeof field.label === 'object') {
    const first = field.label.en ?? Object.values(field.label).find((v) => Boolean(v))
    if (first) return first
  }
  return humanizeFieldName(field.name ?? 'Date')
}

/** Trim leading/trailing _-/space separators left behind by prefix removal. */
const trimSeparators = (s: string): string => s.replace(/^[\s_-]+|[\s_-]+$/g, '')

/**
 * Derive a label for a (start, end) pair from the start field's name with the
 * range marker removed: 'startDate' → 'Date', 'availableFrom' → 'Available'.
 * Too-short remainders ('startsAt' → 'At') fall back to the field's label.
 */
const pairLabel = (startField: CalendarFieldLike, remainder: string): string => {
  const base = trimSeparators(remainder)
  if (base.length >= 3) return humanizeFieldName(base)
  return resolveFieldLabel(startField)
}

/**
 * Heuristic default sources from a collection's fields:
 *  - date fields with a `start`/`starts` name prefix pair with the matching
 *    `end`/`ends` date field ('startDate'+'endDate', 'startsAt'+'endsAt',
 *    'start_time'+'end_time') into range sources;
 *  - date fields with a `From`/`_from` name suffix pair with the matching
 *    `To`/`_to`;
 *  - every remaining date field becomes a single (point-event) source;
 *  - colours come from DEFAULT_CALENDAR_PALETTE by resulting source index.
 *
 * Payload bookkeeping date fields (INTERNAL_DATE_FIELDS — auth expiries,
 * timestamps) are excluded up front: they are storage internals, not content
 * dates, and previously made the Users collection offer a calendar of
 * resetPasswordExpiration/lockUntil noise.
 *
 * Source ids are the start field's name (stable across config edits).
 */
export const pickDefaultSources = (fields: CalendarFieldLike[]): CalendarSource[] => {
  const dateFields = fields.filter(
    (f): f is CalendarFieldLike & { name: string } =>
      f.type === 'date' && Boolean(f.name) && !INTERNAL_DATE_FIELDS.has(f.name!),
  )
  const byLowerName = new Map<string, CalendarFieldLike & { name: string }>()
  for (const f of dateFields) {
    if (!byLowerName.has(f.name.toLowerCase())) byLowerName.set(f.name.toLowerCase(), f)
  }

  const used = new Set<string>()
  const pending: Array<{ index: number; source: Omit<CalendarSource, 'color'> }> = []

  const findEnd = (lowerCandidate: string): (CalendarFieldLike & { name: string }) | null => {
    const match = byLowerName.get(lowerCandidate)
    return match && !used.has(match.name) ? match : null
  }

  // Pass 1 — range pairs (runs over ALL date fields first so an end field
  // declared before its start partner is still claimed by the pair).
  dateFields.forEach((field, index) => {
    if (used.has(field.name)) return
    const lower = field.name.toLowerCase()

    let endField: (CalendarFieldLike & { name: string }) | null = null
    let remainder = ''
    if (/^starts/.test(lower)) {
      // 'startsAt' → 'endsAt'
      endField = findEnd(lower.replace(/^starts/, 'ends'))
      remainder = field.name.slice('starts'.length)
    }
    if (!endField && /^start/.test(lower)) {
      // 'startDate' → 'endDate', 'start' → 'end', 'start_time' → 'end_time'
      endField = findEnd(lower.replace(/^start/, 'end'))
      remainder = field.name.slice('start'.length)
    }
    if (!endField && /from$/.test(lower)) {
      // 'availableFrom' → 'availableTo', 'valid_from' → 'valid_to'
      endField = findEnd(lower.replace(/from$/, 'to'))
      remainder = field.name.slice(0, field.name.length - 'from'.length)
    }
    if (!endField) return

    used.add(field.name)
    used.add(endField.name)
    pending.push({
      index,
      source: {
        id: field.name,
        label: pairLabel(field, remainder),
        startField: field.name,
        endField: endField.name,
      },
    })
  })

  // Pass 2 — remaining date fields become single (point-event) sources.
  dateFields.forEach((field, index) => {
    if (used.has(field.name)) return
    used.add(field.name)
    pending.push({
      index,
      source: {
        id: field.name,
        label: resolveFieldLabel(field),
        startField: field.name,
      },
    })
  })

  // Field declaration order drives both source order and palette assignment.
  pending.sort((a, b) => a.index - b.index)
  return pending.map(({ source }, i) => ({
    ...source,
    color: DEFAULT_CALENDAR_PALETTE[i % DEFAULT_CALENDAR_PALETTE.length],
  }))
}
