/**
 * Per-collection kanban board configuration + list view mode, persisted in
 * AsyncStorage.
 *
 * The KanbanConfig shape deliberately mirrors the server `view-presets`
 * collection fields (statusField / columnOrder / columnColors / cardFields)
 * so a later Presets phase can lift a local config into a ViewPreset 1:1:
 *
 *   server.statusField   = config.statusField
 *   server.columnOrder   = config.columnOrder?.filter(v => !config.hiddenColumns.includes(v))
 *   server.columnColors  = config.columnColors    // '__no_status__' key allowed
 *   server.cardFields    = config.cardFields
 *
 * `hiddenColumns` is a mobile-side extension (the server json convention has
 * no visibility concept yet) — values listed here are removed from the board
 * entirely, with the '__no_status__' sentinel hiding the trailing column.
 */
import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KANBAN_CONFIG_KEY_PREFIX = 'kanban_config:'
const VIEW_MODE_KEY_PREFIX = 'list_view_mode:'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ListViewMode = 'table' | 'kanban' | 'calendar' | 'gantt'

export type KanbanConfig = {
  /** Select/radio field driving the columns. null = first eligible field. */
  statusField: string | null
  /** Option values in display order. null = the field's natural option order. */
  columnOrder: string[] | null
  /** Option values hidden from the board ('__no_status__' = trailing column). */
  hiddenColumns: string[]
  /** Hex colour per option value (and optionally '__no_status__'). */
  columnColors: Record<string, string>
  /** Field names rendered as label:value rows on each card. */
  cardFields: string[]
}

export const DEFAULT_KANBAN_CONFIG: KanbanConfig = {
  statusField: null,
  columnOrder: null,
  hiddenColumns: [],
  columnColors: {},
  cardFields: [],
}

// ---------------------------------------------------------------------------
// Parsing / sanitising (AsyncStorage entries may be stale or corrupt)
// ---------------------------------------------------------------------------

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')

const sanitizeConfig = (raw: unknown): KanbanConfig => {
  if (raw == null || typeof raw !== 'object') return DEFAULT_KANBAN_CONFIG
  const obj = raw as Record<string, unknown>
  const colors: Record<string, string> = {}
  if (obj.columnColors != null && typeof obj.columnColors === 'object') {
    for (const [k, v] of Object.entries(obj.columnColors as Record<string, unknown>)) {
      if (typeof v === 'string') colors[k] = v
    }
  }
  return {
    statusField: typeof obj.statusField === 'string' ? obj.statusField : null,
    columnOrder: isStringArray(obj.columnOrder) ? obj.columnOrder : null,
    hiddenColumns: isStringArray(obj.hiddenColumns) ? obj.hiddenColumns : [],
    columnColors: colors,
    cardFields: isStringArray(obj.cardFields) ? obj.cardFields : [],
  }
}

// ---------------------------------------------------------------------------
// useKanbanConfig
// ---------------------------------------------------------------------------

export type UseKanbanConfigResult = {
  config: KanbanConfig
  /** False until the AsyncStorage read for the current slug settles. */
  loaded: boolean
  /** Replace the whole config (persists). */
  setConfig: (next: KanbanConfig) => void
  /** Shallow-merge a partial config (persists). */
  updateConfig: (partial: Partial<KanbanConfig>) => void
  /** Reset to defaults (persists the reset). */
  resetConfig: () => void
}

export function useKanbanConfig(slug: string): UseKanbanConfigResult {
  const [config, setConfigState] = useState<KanbanConfig>(DEFAULT_KANBAN_CONFIG)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Reset while the new collection's entry loads so a previous collection's
    // config never leaks across slugs.
    setConfigState(DEFAULT_KANBAN_CONFIG)
    setLoaded(false)
    AsyncStorage.getItem(KANBAN_CONFIG_KEY_PREFIX + slug)
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
    (next: KanbanConfig) => {
      AsyncStorage.setItem(KANBAN_CONFIG_KEY_PREFIX + slug, JSON.stringify(next)).catch(() => {})
    },
    [slug],
  )

  const setConfig = useCallback(
    (next: KanbanConfig) => {
      setConfigState(next)
      persist(next)
    },
    [persist],
  )

  const updateConfig = useCallback(
    (partial: Partial<KanbanConfig>) => {
      setConfigState((prev) => {
        const next = { ...prev, ...partial }
        persist(next)
        return next
      })
    },
    [persist],
  )

  const resetConfig = useCallback(() => setConfig(DEFAULT_KANBAN_CONFIG), [setConfig])

  return { config, loaded, setConfig, updateConfig, resetConfig }
}

// ---------------------------------------------------------------------------
// useListViewMode — persisted table/kanban/calendar/gantt selection per
// collection
// ---------------------------------------------------------------------------

export function useListViewMode(
  slug: string,
): [ListViewMode, (mode: ListViewMode) => void] {
  const [mode, setModeState] = useState<ListViewMode>('table')

  useEffect(() => {
    let cancelled = false
    setModeState('table')
    AsyncStorage.getItem(VIEW_MODE_KEY_PREFIX + slug)
      .then((val) => {
        if (cancelled) return
        if (val === 'kanban' || val === 'table' || val === 'calendar' || val === 'gantt') {
          setModeState(val)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [slug])

  const setMode = useCallback(
    (next: ListViewMode) => {
      setModeState(next)
      AsyncStorage.setItem(VIEW_MODE_KEY_PREFIX + slug, next).catch(() => {})
    },
    [slug],
  )

  return [mode, setMode]
}
