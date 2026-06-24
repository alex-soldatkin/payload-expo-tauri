import type { ClientField } from '../types'
import type { ActiveFilter, FilterCondition, WhereClause } from '../hooks/useDocumentListFilters'
import type { ListColorPalette } from '../hooks/useListColors'
import type { createStyles } from './styles'

export type FilterApplyPayload = {
  /** Present when editing an existing filter (chip tap) — update in place. */
  id?: string
  field: string
  fieldLabel: string
  operator: string
  operatorLabel: string
  value: unknown
  /** Human-readable value for chip display (doc title, formatted date, …). */
  valueLabel?: string
  /**
   * Start a new OR-group with this filter (web "+ Or"). Absent/false ⇒ the
   * filter ANDs into the current group.
   */
  newGroup?: boolean
}

export type Props = {
  visible: boolean
  onClose: () => void
  fields: ClientField[]
  onApply: (filter: FilterApplyPayload) => void
  /** Pre-fill the editor with an existing filter (opens at the value step). */
  initialFilter?: ActiveFilter | null
  /**
   * All currently active filters. When provided, opening the sheet (without
   * `initialFilter`) shows the OR-group overview step: groups as glass inset
   * sections, 'OR' pill dividers, '+ Add filter' / '+ Or' actions.
   */
  activeFilters?: ActiveFilter[]
  /** Remove a filter from the overview step (✕ on a condition row). */
  onRemoveFilter?: (id: string) => void
  /**
   * Collection slug whose Payload-native query presets appear in a Presets
   * section on the overview step. Presets live in 'payload-query-presets' —
   * REST-only (local-first sync deliberately skips payload-* slugs), fetched
   * with `where[relatedCollection][equals]=<slug>`. Requires
   * `onApplyFilterGroups`. Saving posts `{ title, relatedCollection, where,
   * columns }` (columns in the web `{ accessor, active }[]` shape).
   */
  presetsCollection?: string
  /** Replace ALL active filters with a preset's parsed OR-groups. */
  onApplyFilterGroups?: (groups: FilterCondition[][]) => void
  /** Column accessors saved with a new query preset (current visible columns). */
  presetsColumns?: string[]
}

/** Minimal slice of a payload-query-presets doc the sheet works with. */
export type QueryPresetDoc = {
  id: string
  title: string
  isShared?: boolean | null
  where?: unknown
  columns?: unknown
}

export type FilterStyles = ReturnType<typeof createStyles>

export type ValueInputProps = {
  field: ClientField
  operator: string
  value: unknown
  onChange: (v: unknown, label?: string) => void
  colors: ListColorPalette
  styles: FilterStyles
}

export type { WhereClause }
