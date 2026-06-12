/**
 * Per-collection gantt view configuration, persisted in AsyncStorage
 * ('gantt_config:{slug}') — mirrors useCalendarConfig.
 *
 * The GanttConfig shape deliberately mirrors the server `view-presets`
 * collection fields so the Presets flow can lift a local config 1:1:
 *
 *   server.ganttSources = config.sources   (resolved — never null on lift)
 *   server.ganttOptions = { pxPerDay?: config.pxPerDay, rowSort?: config.rowSort }
 *                         (null fields are OMITTED on lift; absent on the
 *                          server means "client default")
 *
 * `sources: null` means "not customised yet" — the screen falls back to
 * pickDefaultSources(dateFields) so new date fields keep appearing until the
 * user explicitly saves a source list. The source entries are the SAME
 * ScheduleSource convention as calendarSources, so the calendar's sanitizer
 * is reused verbatim.
 *
 * `pxPerDay: null` means "component default" (GANTT_CHART_DEFAULT_PX_PER_DAY,
 * 28) — the screen passes `pxPerDay ?? undefined` to GanttChart.
 * `rowSort: null` means rows follow the screen's active list sort; a dot-path
 * field name (the server ganttOptions.rowSort convention) orders rows by that
 * field ascending instead.
 */
import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CalendarSource } from '@payload-universal/admin-native'

import { sanitizeCalendarSources } from '@/src/hooks/useCalendarConfig'

const GANTT_CONFIG_KEY_PREFIX = 'gantt_config:'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GanttConfig = {
  /** Configured date sources. null = derive via pickDefaultSources. */
  sources: CalendarSource[] | null
  /** Day-column width in px. null = GanttChart's component default (28). */
  pxPerDay: number | null
  /** Dot-path field rows are ordered by. null = the screen's active sort. */
  rowSort: string | null
}

export const DEFAULT_GANTT_CONFIG: GanttConfig = {
  sources: null,
  pxPerDay: null,
  rowSort: null,
}

// ---------------------------------------------------------------------------
// Parsing / sanitising (AsyncStorage + server json fields may be stale,
// corrupt or hand-edited — validate the documented conventions). The source
// sanitizer is the calendar's (identical ScheduleSource shape).
// ---------------------------------------------------------------------------

/** Finite positive number or null — anything else means "client default". */
export const sanitizeGanttPxPerDay = (raw: unknown): number | null =>
  typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null

/** Non-empty string (dot-path field name) or null. */
export const sanitizeGanttRowSort = (raw: unknown): string | null =>
  typeof raw === 'string' && raw ? raw : null

/**
 * Validate the server `ganttOptions` json convention
 * ({ pxPerDay?: number; rowSort?: string }) into the always-shaped client
 * pair. Shared with useViewPresets for preset apply/sanitise.
 */
export const sanitizeGanttOptions = (
  raw: unknown,
): { pxPerDay: number | null; rowSort: string | null } => {
  const obj =
    raw != null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    pxPerDay: sanitizeGanttPxPerDay(obj.pxPerDay),
    rowSort: sanitizeGanttRowSort(obj.rowSort),
  }
}

const sanitizeConfig = (raw: unknown): GanttConfig => {
  if (raw == null || typeof raw !== 'object') return DEFAULT_GANTT_CONFIG
  const obj = raw as Record<string, unknown>
  return {
    sources: sanitizeCalendarSources(obj.sources),
    pxPerDay: sanitizeGanttPxPerDay(obj.pxPerDay),
    rowSort: sanitizeGanttRowSort(obj.rowSort),
  }
}

// ---------------------------------------------------------------------------
// useGanttConfig
// ---------------------------------------------------------------------------

export type UseGanttConfigResult = {
  config: GanttConfig
  /** False until the AsyncStorage read for the current slug settles. */
  loaded: boolean
  /** Replace the whole config (persists). */
  setConfig: (next: GanttConfig) => void
  /** Shallow-merge a partial config (persists). */
  updateConfig: (partial: Partial<GanttConfig>) => void
  /** Reset to defaults (persists the reset). */
  resetConfig: () => void
}

export function useGanttConfig(slug: string): UseGanttConfigResult {
  const [config, setConfigState] = useState<GanttConfig>(DEFAULT_GANTT_CONFIG)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Reset while the new collection's entry loads so a previous collection's
    // config never leaks across slugs.
    setConfigState(DEFAULT_GANTT_CONFIG)
    setLoaded(false)
    AsyncStorage.getItem(GANTT_CONFIG_KEY_PREFIX + slug)
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
    (next: GanttConfig) => {
      AsyncStorage.setItem(GANTT_CONFIG_KEY_PREFIX + slug, JSON.stringify(next)).catch(() => {})
    },
    [slug],
  )

  const setConfig = useCallback(
    (next: GanttConfig) => {
      setConfigState(next)
      persist(next)
    },
    [persist],
  )

  const updateConfig = useCallback(
    (partial: Partial<GanttConfig>) => {
      setConfigState((prev) => {
        const next = { ...prev, ...partial }
        persist(next)
        return next
      })
    },
    [persist],
  )

  const resetConfig = useCallback(() => setConfig(DEFAULT_GANTT_CONFIG), [setConfig])

  return { config, loaded, setConfig, updateConfig, resetConfig }
}
