/**
 * Maps Payload field types to their available filter operators.
 * Used by FilterBottomSheet to build the operator picker.
 *
 * Web parity: mirrors `packages/ui/src/elements/WhereBuilder/field-types.tsx`
 * in payload-main —
 *   base       = equals, not_equals, in, not_in, exists
 *   text-like  = base + like, not_like, contains  (text/textarea/code/richText)
 *   email      = base + contains
 *   number/date= base + greater_than(_equal), less_than(_equal)
 *   select     = base                              (select/radio)
 *   rel/upload = base
 *   checkbox   = equals, not_equals, exists
 * (geo operators `near`/`within`/`intersects` are intentionally out of scope —
 * no native value input or local evaluator for them yet.)
 */

export type FilterOperator = {
  value: string
  label: string
}

const EQUALS: FilterOperator = { value: 'equals', label: 'equals' }
const NOT_EQUALS: FilterOperator = { value: 'not_equals', label: 'does not equal' }
const IN: FilterOperator = { value: 'in', label: 'is one of' }
const NOT_IN: FilterOperator = { value: 'not_in', label: 'is not one of' }
const EXISTS: FilterOperator = { value: 'exists', label: 'exists' }

/** Web WhereBuilder `base`: equality + membership + exists. */
const BASE_OPS: FilterOperator[] = [EQUALS, NOT_EQUALS, IN, NOT_IN, EXISTS]

const TEXT_OPS: FilterOperator[] = [
  { value: 'contains', label: 'contains' },
  { value: 'like', label: 'is like' },
  { value: 'not_like', label: 'is not like' },
  ...BASE_OPS,
]

const EMAIL_OPS: FilterOperator[] = [
  { value: 'contains', label: 'contains' },
  ...BASE_OPS,
]

const NUMBER_OPS: FilterOperator[] = [
  EQUALS,
  NOT_EQUALS,
  { value: 'greater_than', label: 'is greater than' },
  { value: 'greater_than_equal', label: 'is at least' },
  { value: 'less_than', label: 'is less than' },
  { value: 'less_than_equal', label: 'is at most' },
  IN,
  NOT_IN,
  EXISTS,
]

const DATE_OPS: FilterOperator[] = [
  EQUALS,
  NOT_EQUALS,
  { value: 'greater_than', label: 'is after' },
  { value: 'greater_than_equal', label: 'is on or after' },
  { value: 'less_than', label: 'is before' },
  { value: 'less_than_equal', label: 'is on or before' },
  IN,
  NOT_IN,
  EXISTS,
]

const SELECT_OPS: FilterOperator[] = [...BASE_OPS]

const BOOL_OPS: FilterOperator[] = [EQUALS, NOT_EQUALS, EXISTS]

const REL_OPS: FilterOperator[] = [...BASE_OPS]

const operatorMap: Record<string, FilterOperator[]> = {
  text: TEXT_OPS,
  email: EMAIL_OPS,
  textarea: TEXT_OPS,
  code: TEXT_OPS,
  richText: TEXT_OPS,
  json: TEXT_OPS,
  number: NUMBER_OPS,
  point: NUMBER_OPS,
  date: DATE_OPS,
  select: SELECT_OPS,
  radio: SELECT_OPS,
  checkbox: BOOL_OPS,
  relationship: REL_OPS,
  upload: REL_OPS,
}

const FILTERABLE_TYPES = new Set(Object.keys(operatorMap))

export const getOperatorsForFieldType = (type: string): FilterOperator[] =>
  operatorMap[type] ?? TEXT_OPS

export const getFilterableFieldTypes = (): string[] =>
  Array.from(FILTERABLE_TYPES)

/** Operators whose value is a list (comma-separated input / multi-select). */
export const isMultiValueOperator = (operator: string): boolean =>
  operator === 'in' || operator === 'not_in'

export const isFieldFilterable = (field: { type: string; name?: string; admin?: { hidden?: boolean } }): boolean =>
  Boolean(field.name) && !field.admin?.hidden && FILTERABLE_TYPES.has(field.type)
