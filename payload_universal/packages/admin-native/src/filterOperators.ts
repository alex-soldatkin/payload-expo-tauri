/**
 * Maps Payload field types to their available filter operators.
 * Used by FilterBottomSheet to build the operator picker.
 */

export type FilterOperator = {
  value: string
  label: string
}

const TEXT_OPS: FilterOperator[] = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'like', label: 'is like' },
  { value: 'exists', label: 'exists' },
]

const NUMBER_OPS: FilterOperator[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'greater_than_equal', label: 'is at least' },
  { value: 'less_than', label: 'is less than' },
  { value: 'less_than_equal', label: 'is at most' },
  { value: 'exists', label: 'exists' },
]

const DATE_OPS: FilterOperator[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'greater_than', label: 'is after' },
  { value: 'greater_than_equal', label: 'is on or after' },
  { value: 'less_than', label: 'is before' },
  { value: 'less_than_equal', label: 'is on or before' },
  { value: 'exists', label: 'exists' },
]

const SELECT_OPS: FilterOperator[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'in', label: 'is one of' },
  { value: 'not_in', label: 'is not one of' },
  { value: 'exists', label: 'exists' },
]

const BOOL_OPS: FilterOperator[] = [
  { value: 'equals', label: 'equals' },
  { value: 'exists', label: 'exists' },
]

const REL_OPS: FilterOperator[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'in', label: 'is one of' },
  { value: 'not_in', label: 'is not one of' },
  { value: 'exists', label: 'exists' },
]

const operatorMap: Record<string, FilterOperator[]> = {
  text: TEXT_OPS,
  email: TEXT_OPS,
  textarea: TEXT_OPS,
  code: TEXT_OPS,
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

export const isFieldFilterable = (field: { type: string; name?: string; admin?: { hidden?: boolean } }): boolean =>
  Boolean(field.name) && !field.admin?.hidden && FILTERABLE_TYPES.has(field.type)
