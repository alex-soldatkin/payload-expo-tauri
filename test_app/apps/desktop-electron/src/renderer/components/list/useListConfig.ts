// Per-collection list preferences (columns / sort / page size) persisted to
// settings.json via the desktop bridge under a single `listConfig` key:
//   listConfig: Record<slug, { columns?: string[]; sort?: string; pageSize?: number }>
// Read once on mount (async, race-guarded); write-through shallow-merges the
// whole listConfig object back so unrelated slugs are preserved.
import { useCallback, useEffect, useRef, useState } from 'react'

export type ListConfigEntry = {
  columns?: string[]
  sort?: string
  pageSize?: number
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
        const nextMap = { ...mapRef.current, [slug]: next }
        mapRef.current = nextMap
        // Fire-and-forget; the merge on the main side is a shallow overwrite of
        // the whole listConfig key, which is exactly the map we hold here.
        void window.payloadDesktop.setSettings({ [SETTINGS_KEY]: nextMap })
        return next
      })
    },
    [slug],
  )

  return { config, ready, update }
}
