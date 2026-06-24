import type { ClientField } from '../../../types'

/** Above this many rows, the switcher mode becomes the default. */
export const STACKED_DEFAULT_MAX = 5

/** Sub-field types whose string values can serve as a derived row title. */
export const TITLE_FIELD_TYPES = new Set(['text', 'email', 'textarea'])

/** Derive a row title from the first text-ish sub-field with a value. */
export const deriveRowTitle = (
  row: Record<string, unknown> | undefined,
  subFields: ClientField[],
): string | null => {
  if (!row) return null
  for (const sub of subFields) {
    if (!sub.name || !TITLE_FIELD_TYPES.has(sub.type)) continue
    const v = row[sub.name]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

/** Deep-clone a row for Duplicate, stripping the row `id` (server treats it as new). */
export const cloneRow = (row: Record<string, unknown>): Record<string, unknown> => {
  try {
    const cloned = JSON.parse(JSON.stringify(row ?? {})) as Record<string, unknown>
    delete cloned.id
    return cloned
  } catch {
    const { id: _id, ...rest } = row ?? {}
    return { ...rest }
  }
}
