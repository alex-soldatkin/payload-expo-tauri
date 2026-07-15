// Board eligibility — which top-level fields can drive a Kanban board.
// Mirrors the mobile `isEligibleStatusField` rule (useBoardViews): a plain
// 'select' or 'radio' field with options, NOT hasMany, not hidden. Nested
// fields (inside tabs/groups/arrays) are out of scope for slice one.
import type { SchemaField } from '../../../form/types'
import { flattenTransparent } from '../flattenTransparent'

/** A field is board-eligible iff it's a top-level single-value option field. */
export function isBoardEligible(field: SchemaField): boolean {
  if (!field.name || field.admin?.hidden) return false
  if (field.hasMany) return false
  const hasOptions = Array.isArray(field.options) && field.options.length > 0
  if (!hasOptions) return false
  return field.type === 'select' || field.type === 'radio'
}

/** Top-level select/radio fields with options that can back a Kanban board. */
export function eligibleBoardFields(rootFields: SchemaField[]): SchemaField[] {
  return flattenTransparent(rootFields).filter(isBoardEligible)
}
