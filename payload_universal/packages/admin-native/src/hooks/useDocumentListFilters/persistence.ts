// ---------------------------------------------------------------------------
// Persistence — optional AsyncStorage, same pattern as DocumentList's
// `list_sort:` / `list_page_size:` keys.
// ---------------------------------------------------------------------------
import type { PersistedFilter, PersistedFiltersV2 } from './types'

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem?: (key: string) => Promise<void>
}
let AsyncStorage: AsyncStorageLike | null = null
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default
} catch {
  /* @react-native-async-storage/async-storage not installed — filters not persisted */
}

export { AsyncStorage }

export const FILTERS_KEY_PREFIX = 'list_filters:'
export const FILTERS_SHAPE_VERSION = 2

const isValidPersistedFilter = (f: unknown): f is PersistedFilter => {
  if (!f || typeof f !== 'object') return false
  const o = f as Record<string, unknown>
  return typeof o.field === 'string' && typeof o.operator === 'string' && 'value' in o
}

/**
 * Parse a persisted value, accepting both shapes:
 *  - v2: `{ v: 2, groups: PersistedFilter[][] }`
 *  - legacy (v1): flat `ActiveFilter[]` array → one single group
 * Returns groups of validated condition payloads (without ids).
 */
export const parsePersistedFilters = (raw: string): PersistedFilter[][] | null => {
  try {
    const parsed: unknown = JSON.parse(raw)
    // Legacy flat shape — a plain array of filters (one AND group)
    if (Array.isArray(parsed)) {
      const flat = parsed.filter(isValidPersistedFilter)
      return flat.length > 0 ? [flat] : []
    }
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as PersistedFiltersV2).groups)) {
      return (parsed as PersistedFiltersV2).groups
        .filter(Array.isArray)
        .map((g) => (g as unknown[]).filter(isValidPersistedFilter))
        .filter((g) => g.length > 0)
    }
  } catch {
    /* corrupt entry — ignore */
  }
  return null
}
