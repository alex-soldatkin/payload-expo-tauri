// Enumerates the fields a user may filter on, reusing the column model's
// displayable-field pass and layering in the meta columns (updatedAt/createdAt,
// plus _status when the collection has drafts). Kept React-free.
import type { DisplayField } from '../columns'
import type { SchemaField } from '../../../form/types'

/** Field types that make sense as filter targets (scalar-ish). */
const FILTERABLE_TYPES = new Set([
  'text', 'textarea', 'email', 'number', 'checkbox', 'date', 'select', 'radio',
])

export type FilterField = {
  key: string
  label: string
  type: string
  field?: SchemaField
}

/**
 * Filterable fields for a collection: the displayable root fields whose type is
 * filterable, followed by the synthetic meta columns. `_status` only appears
 * when the collection has drafts.
 */
export function filterableFields(displayable: DisplayField[], hasDrafts: boolean): FilterField[] {
  const out: FilterField[] = []
  for (const d of displayable) {
    if (!FILTERABLE_TYPES.has(d.type)) continue
    out.push({ key: d.key, label: d.label, type: d.type, field: d.field })
  }
  out.push({ key: 'updatedAt', label: 'Updated', type: 'date' })
  out.push({ key: 'createdAt', label: 'Created', type: 'date' })
  if (hasDrafts) out.push({ key: '_status', label: 'Status', type: 'select' })
  return out
}

export function findFilterField(fields: FilterField[], key: string): FilterField | undefined {
  return fields.find((f) => f.key === key)
}

/** A chip/label-friendly rendering of a rule's value. */
export function displayValue(type: string, op: string, value: unknown): string {
  if (op === 'exists') return value === true || value === 'true' ? 'true' : 'false'
  if (value == null || value === '') return '∅'
  if (type === 'checkbox') return value === true || value === 'true' ? 'true' : 'false'
  return String(value)
}
