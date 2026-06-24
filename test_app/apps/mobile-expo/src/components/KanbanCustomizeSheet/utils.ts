import { DEFAULT_KANBAN_PALETTE, normalizeOption, type ClientField } from '@payload-universal/admin-native'

import type { FieldWithOptions, OptionLike } from './types'

export const ROW_HEIGHT = 54
/** Curated quick-pick swatches (also the fallback when ColorPicker is null). */
export const SWATCHES = DEFAULT_KANBAN_PALETTE.slice(0, 8)

export const optionsOf = (field: ClientField | undefined): OptionLike[] => {
  const raw = (field as FieldWithOptions | undefined)?.options
  if (!Array.isArray(raw)) return []
  return raw.map((o) => normalizeOption(o))
}
