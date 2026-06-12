/**
 * Per-collection calendar view configuration, persisted in AsyncStorage
 * ('calendar_config:{slug}') — mirrors useKanbanConfig.
 *
 * The CalendarConfig shape deliberately mirrors the server `view-presets`
 * collection fields so the Presets flow can lift a local config 1:1:
 *
 *   server.calendarSources     = config.sources   (resolved — never null on lift)
 *   server.calendarDefaultMode = config.defaultMode
 *
 * `sources: null` means "not customised yet" — the screen falls back to
 * pickDefaultSources(dateFields) so new date fields keep appearing until the
 * user explicitly saves a source list.
 */
import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CalendarMode, CalendarSource } from '@payload-universal/admin-native'

const CALENDAR_CONFIG_KEY_PREFIX = 'calendar_config:'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalendarConfig = {
  /** Configured date sources. null = derive via pickDefaultSources. */
  sources: CalendarSource[] | null
  /** Mode the calendar opens in. */
  defaultMode: CalendarMode
}

export const DEFAULT_CALENDAR_CONFIG: CalendarConfig = {
  sources: null,
  defaultMode: 'month',
}

// ---------------------------------------------------------------------------
// Parsing / sanitising (AsyncStorage + server json fields may be stale,
// corrupt or hand-edited — validate the documented source convention)
// ---------------------------------------------------------------------------

/**
 * Validate an unknown value against the calendar source convention:
 * array of { id, label, startField, endField?, color } (all strings) plus an
 * optional `hidden` boolean (customize-sheet visibility toggle — only an
 * explicit `true` survives; anything else means visible).
 * Invalid entries are dropped, duplicate ids are suffixed ('-2', '-3', …) —
 * legend toggles and drag-reorder both key on the id. A non-array / empty
 * result returns null. Shared with useViewPresets for the server
 * `calendarSources` json field.
 */
export const sanitizeCalendarSources = (raw: unknown): CalendarSource[] | null => {
  if (!Array.isArray(raw)) return null
  const out: CalendarSource[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (entry == null || typeof entry !== 'object') continue
    const obj = entry as Record<string, unknown>
    if (
      typeof obj.id !== 'string' || !obj.id ||
      typeof obj.startField !== 'string' || !obj.startField ||
      typeof obj.color !== 'string' || !obj.color
    ) {
      continue
    }
    let id = obj.id
    let n = 2
    while (seen.has(id)) id = `${obj.id}-${n++}`
    seen.add(id)
    out.push({
      id,
      label: typeof obj.label === 'string' && obj.label ? obj.label : obj.id,
      startField: obj.startField,
      ...(typeof obj.endField === 'string' && obj.endField ? { endField: obj.endField } : {}),
      color: obj.color,
      ...(obj.hidden === true ? { hidden: true } : {}),
    })
  }
  return out.length > 0 ? out : null
}

/** 'month' | 'week' | 'day' with a 'month' fallback for anything unrecognised. */
export const sanitizeCalendarMode = (raw: unknown): CalendarMode =>
  raw === 'day' || raw === 'week' ? raw : 'month'

const sanitizeConfig = (raw: unknown): CalendarConfig => {
  if (raw == null || typeof raw !== 'object') return DEFAULT_CALENDAR_CONFIG
  const obj = raw as Record<string, unknown>
  return {
    sources: sanitizeCalendarSources(obj.sources),
    defaultMode: sanitizeCalendarMode(obj.defaultMode),
  }
}

// ---------------------------------------------------------------------------
// useCalendarConfig
// ---------------------------------------------------------------------------

export type UseCalendarConfigResult = {
  config: CalendarConfig
  /** False until the AsyncStorage read for the current slug settles. */
  loaded: boolean
  /** Replace the whole config (persists). */
  setConfig: (next: CalendarConfig) => void
  /** Shallow-merge a partial config (persists). */
  updateConfig: (partial: Partial<CalendarConfig>) => void
  /** Reset to defaults (persists the reset). */
  resetConfig: () => void
}

export function useCalendarConfig(slug: string): UseCalendarConfigResult {
  const [config, setConfigState] = useState<CalendarConfig>(DEFAULT_CALENDAR_CONFIG)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Reset while the new collection's entry loads so a previous collection's
    // config never leaks across slugs.
    setConfigState(DEFAULT_CALENDAR_CONFIG)
    setLoaded(false)
    AsyncStorage.getItem(CALENDAR_CONFIG_KEY_PREFIX + slug)
      .then((val) => {
        if (cancelled) return
        if (val) {
          try {
            setConfigState(sanitizeConfig(JSON.parse(val)))
          } catch {
            /* corrupt entry — keep defaults */
          }
        }
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const persist = useCallback(
    (next: CalendarConfig) => {
      AsyncStorage.setItem(CALENDAR_CONFIG_KEY_PREFIX + slug, JSON.stringify(next)).catch(() => {})
    },
    [slug],
  )

  const setConfig = useCallback(
    (next: CalendarConfig) => {
      setConfigState(next)
      persist(next)
    },
    [persist],
  )

  const updateConfig = useCallback(
    (partial: Partial<CalendarConfig>) => {
      setConfigState((prev) => {
        const next = { ...prev, ...partial }
        persist(next)
        return next
      })
    },
    [persist],
  )

  const resetConfig = useCallback(() => setConfig(DEFAULT_CALENDAR_CONFIG), [setConfig])

  return { config, loaded, setConfig, updateConfig, resetConfig }
}
