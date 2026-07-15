// Filter model for the desktop list engine (issue #20 remainder — the desktop
// translation of the mobile FilterBottomSheet). Mirrors the mobile v2 OR-group
// shape: conditions AND *within* a group, groups OR *across* each other.
//
// The op set is deliberately narrower than mobile's: only the operators the
// RxDB Mango→SQL layer can push down (equals/not_equals/greater_than/less_than/
// in/exists) plus `contains`, which SQL cannot express and is handled as a
// client-side post-filter (see toSelector.ts).

export type FilterOp =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'in'
  | 'exists'

export type FilterRule = {
  field: string
  op: FilterOp
  value: unknown
}

/** OR-groups: `groups[i]` ANDs together; the groups OR together. */
export type FilterGroups = FilterRule[][]

/** A named, locally-persisted preset for one collection slug. */
export type FilterPreset = {
  name: string
  groups: FilterGroups
}

export const OPERATOR_LABELS: Record<FilterOp, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  greater_than: 'is greater than',
  less_than: 'is less than',
  contains: 'contains',
  in: 'is one of',
  exists: 'exists',
}

/** Operators offered per field type (subset of mobile's WhereBuilder parity). */
export function operatorsForType(type: string): FilterOp[] {
  switch (type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'code':
    case 'richText':
    case 'json':
      return ['equals', 'not_equals', 'contains', 'in', 'exists']
    case 'number':
    case 'date':
      return ['equals', 'not_equals', 'greater_than', 'less_than', 'in', 'exists']
    case 'checkbox':
      return ['equals', 'not_equals', 'exists']
    case 'select':
    case 'radio':
    case 'relationship':
    case 'upload':
      return ['equals', 'not_equals', 'in', 'exists']
    default:
      return ['equals', 'not_equals', 'exists']
  }
}

/** `in`/`contains`/`exists` take a special value shape; the rest are scalar. */
export function isListOperator(op: FilterOp): boolean {
  return op === 'in'
}
