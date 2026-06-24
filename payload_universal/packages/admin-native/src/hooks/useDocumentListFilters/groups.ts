// ---------------------------------------------------------------------------
// Group helpers
// ---------------------------------------------------------------------------
import type { ActiveFilter, FilterGroup } from './types'

let nextId = 0
export const genId = () => `filter-${++nextId}`

/** Re-pack group indexes so they are contiguous and start at 0. */
export const normalizeGroupIndexes = (list: ActiveFilter[]): ActiveFilter[] => {
  const order = Array.from(new Set(list.map((f) => f.groupIndex ?? 0))).sort((a, b) => a - b)
  const remap = new Map(order.map((gi, i) => [gi, i]))
  // Stable sort keeps insertion order within each group
  return [...list]
    .sort((a, b) => remap.get(a.groupIndex ?? 0)! - remap.get(b.groupIndex ?? 0)!)
    .map((f) => ({ ...f, groupIndex: remap.get(f.groupIndex ?? 0)! }))
}

export const groupFilters = (list: ActiveFilter[]): FilterGroup[] => {
  const groups: FilterGroup[] = []
  for (const f of list) {
    const gi = f.groupIndex ?? 0
    if (!groups[gi]) groups[gi] = []
    groups[gi].push(f)
  }
  return groups.filter((g) => g && g.length > 0)
}

export const maxGroupIndex = (list: ActiveFilter[]): number =>
  list.reduce((max, f) => Math.max(max, f.groupIndex ?? 0), -1)
