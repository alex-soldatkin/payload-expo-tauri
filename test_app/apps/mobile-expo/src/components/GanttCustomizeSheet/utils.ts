/**
 * GanttCustomizeSheet — pure helpers (id dedup + palette fallback).
 */
import { DEFAULT_CALENDAR_PALETTE, type CalendarSource } from '@payload-universal/admin-native'

/** Stable unique ids — Sortable requires them; server presets may not. */
export const ensureUniqueIds = (sources: CalendarSource[]): CalendarSource[] => {
  const seen = new Set<string>()
  return sources.map((source) => {
    let id = source.id
    let n = 2
    while (seen.has(id)) id = `${source.id}-${n++}`
    seen.add(id)
    return id === source.id ? source : { ...source, id }
  })
}

/** First palette colour not used by the given sources (cycled fallback). */
export const nextPaletteColor = (sources: CalendarSource[]): string => {
  const used = new Set(sources.map((s) => s.color.toLowerCase()))
  const free = DEFAULT_CALENDAR_PALETTE.find((hex) => !used.has(hex.toLowerCase()))
  return free ?? DEFAULT_CALENDAR_PALETTE[sources.length % DEFAULT_CALENDAR_PALETTE.length]
}
