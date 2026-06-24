import type { ClientField } from '../types'
import type { ListColorPalette } from '../hooks/useListColors'
import type { createStyles } from './styles'

export type Props = {
  /** Field definitions for this collection. */
  fields: ClientField[]
  /** The older version's data (comparing against). */
  versionFrom: Record<string, unknown>
  /** The newer version's data (currently viewing). */
  versionTo: Record<string, unknown>
  /** Only show fields that changed. Defaults to true. */
  modifiedOnly?: boolean
}

// ---------------------------------------------------------------------------
// Shared theme context (one StyleSheet for the whole diff tree)
// ---------------------------------------------------------------------------

export type DiffStyles = ReturnType<typeof createStyles>
export type DiffTheme = { styles: DiffStyles; colors: ListColorPalette; dark: boolean }

// ---------------------------------------------------------------------------
// Field tree walker
// ---------------------------------------------------------------------------

export type DiffEntry = {
  path: string
  label: string
  field: ClientField
  valueFrom: unknown
  valueTo: unknown
  changed: boolean
}

// ---------------------------------------------------------------------------
// Array / blocks per-row diff
// ---------------------------------------------------------------------------

export type RowRecord = Record<string, unknown>

export type RowPair = {
  key: string
  status: 'added' | 'removed' | 'changed' | 'same'
  from?: RowRecord
  to?: RowRecord
  /** 1-based row number (to-side position, or from-side for removed rows). */
  num: number
}
