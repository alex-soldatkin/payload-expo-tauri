// Per-collection list preferences (columns / sort / page size / filters)
// persisted to settings.json via the desktop bridge under a single `listConfig`
// key:
//   listConfig: Record<slug, {
//     columns?; sort?; pageSize?;
//     activeFilters?: FilterRule[][];        // OR-groups, re-applied on mount
//     presets?: { name; groups: FilterRule[][] }[];  // named local presets
//   }>
// Read once on mount (async, race-guarded); write-through shallow-merges the
// whole listConfig object back so unrelated slugs are preserved.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FilterGroups, FilterPreset } from './filters/types'

export type ListViewMode = 'table' | 'board' | 'calendar'

export type ListConfigEntry = {
  columns?: string[]
  sort?: string
  pageSize?: number
  /** Active OR-group filters, re-applied when the collection re-opens. */
  activeFilters?: FilterGroups
  /** Named filter presets saved locally for this collection. */
  presets?: FilterPreset[]
  /** Table (default) vs. property-driven Kanban board / calendar (issue #25). */
  viewMode?: ListViewMode
  /** Field name backing the board's columns (a board-eligible select/radio). */
  boardField?: string
  /** Field name backing the calendar's day buckets (a top-level date field). */
  calendarField?: string
}

type ListConfigMap = Record<string, ListConfigEntry>

const SETTINGS_KEY = 'listConfig'

function readMap(settings: Record<string, unknown>): ListConfigMap {
  const raw = settings[SETTINGS_KEY]
  return raw && typeof raw === 'object' ? (raw as ListConfigMap) : {}
}

export function useListConfig(slug: string): {
  config: ListConfigEntry
  ready: boolean
  update: (patch: ListConfigEntry) => void
} {
  const [config, setConfig] = useState<ListConfigEntry>({})
  const [ready, setReady] = useState(false)
  // Keep the last full map in a ref so write-through can shallow-merge without
  // re-reading settings on every change.
  const mapRef = useRef<ListConfigMap>({})

  useEffect(() => {
    let cancelled = false
    setReady(false)
    window.payloadDesktop
      .getSettings()
      .then((settings) => {
        if (cancelled) return
        const map = readMap(settings)
        mapRef.current = map
        setConfig(map[slug] ?? {})
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        mapRef.current = {}
        setConfig({})
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const update = useCallback(
    (patch: ListConfigEntry) => {
      setConfig((prev) => {
        const next = { ...prev, ...patch }
        // Read-merge-write at WRITE time: holding the whole map from mount and
        // writing it back resurrects stale entries — a long-lived instance
        // would clobber changes made by other panes (or manual edits) for
        // every OTHER slug. Only this slug's entry is ours to overwrite.
        void window.payloadDesktop
          .getSettings()
          .then((settings) => {
            const freshMap = readMap(settings)
            mapRef.current = { ...freshMap, [slug]: next }
            return window.payloadDesktop.setSettings({ [SETTINGS_KEY]: mapRef.current })
          })
          .catch(() => {})
        return next
      })
    },
    [slug],
  )

  return { config, ready, update }
}
