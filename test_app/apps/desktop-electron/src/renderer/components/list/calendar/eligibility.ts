// Calendar eligibility — which top-level fields can drive a month calendar.
// Mirrors the mobile `collectionHasScheduleDateFields` rule (eventMapping):
// a top-level 'date' field (ANY pickerAppearance) that is not Payload auth /
// timestamp bookkeeping. Nested fields (inside rows/tabs/groups/arrays) are
// out of scope for this slice, exactly like the board's top-level-only rule.
import type { SchemaField } from '../../../form/types'
import { flattenTransparent } from '../flattenTransparent'

/**
 * Payload auth-expiry + timestamp date fields that are storage bookkeeping,
 * not content dates — excluded so e.g. Users never offers a calendar of
 * `resetPasswordExpiration`/`lockUntil`. Matched by EXACT top-level name
 * (mirrors admin-native's INTERNAL_DATE_FIELDS).
 */
const INTERNAL_DATE_FIELDS: ReadonlySet<string> = new Set([
  'resetPasswordExpiration',
  'resetPasswordToken',
  'lockUntil',
  'createdAt',
  'updatedAt',
  'deletedAt',
])

/** A field can back the calendar iff it's a top-level, visible, real date field. */
export function isCalendarEligible(field: SchemaField): boolean {
  if (!field.name || field.admin?.hidden || field.admin?.disabled) return false
  if (field.type !== 'date') return false
  return !INTERNAL_DATE_FIELDS.has(field.name)
}

/** Top-level content date fields (any pickerAppearance) that can back a calendar. */
export function eligibleDateFields(rootFields: SchemaField[]): SchemaField[] {
  return flattenTransparent(rootFields).filter(isCalendarEligible)
}
