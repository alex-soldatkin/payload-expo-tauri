// ---------------------------------------------------------------------------
// Where ⇄ filter-group conversion — view presets & payload-query-presets
// ---------------------------------------------------------------------------
import type { ClientField } from '../../types'
import { getFieldLabel } from '../../utils/schemaHelpers'
import { getOperatorsForFieldType } from '../../utils/filterOperators'

import type { ActiveFilter, FilterCondition, WhereClause } from './types'
import { groupFilters } from './groups'

/**
 * Serialize structured filters to a Payload `where` object (presets persist
 * this verbatim). Mirrors the hook's `whereQuery` serialization minus the
 * free-text search clause:
 *   - no filters        → undefined
 *   - one group, 1 cond → flat clause
 *   - one group, n cond → `{ and: [...] }`
 *   - multiple groups   → `{ or: [{ and: [...] }] }`
 */
export const filtersToWhere = (filters: ActiveFilter[]): WhereClause | undefined => {
  const filterGroups = groupFilters(filters)
  const toClause = (f: ActiveFilter): WhereClause => ({ [f.field]: { [f.operator]: f.value } })
  if (filterGroups.length === 0) return undefined
  if (filterGroups.length === 1) {
    const clauses = filterGroups[0].map(toClause)
    return clauses.length === 1 ? clauses[0] : { and: clauses }
  }
  return { or: filterGroups.map((g) => ({ and: g.map(toClause) })) }
}

/** Operators the on-device evaluator (`matchesWhere`) understands. */
const LOCAL_OPERATORS = new Set([
  'exists',
  'equals',
  'not_equals',
  'contains',
  'like',
  'not_like',
  'in',
  'not_in',
  'greater_than',
  'greater_than_equal',
  'less_than',
  'less_than_equal',
])

/**
 * Parse a Payload `where` object back into the OR-group filter model.
 *
 * Handles the canonical query-preset shape (`{ or: [{ and: [...] }] }` —
 * the server's transformWhereQuery output), the flat AND shape, and single
 * clauses. Conditions are returned in groups for `setFilterGroups`.
 *
 * `unsupported` lists conditions the result cannot faithfully express or
 * that the local evaluator cannot run (`field op` strings):
 *   - operators outside the local evaluator's set (geo `near`/`within`/…) —
 *     the condition is still INCLUDED (matchesWhere passes unknown operators
 *     through, REST queries would honour them) so callers can surface the
 *     limitation inline;
 *   - `or` arrays nested deeper than the top level (not representable in the
 *     two-level group model) — these are SKIPPED.
 *
 * Pass `fields` to resolve human-readable field/operator labels for chips.
 */
export const whereToFilterGroups = (
  where: WhereClause | null | undefined,
  fields?: ClientField[],
): { groups: FilterCondition[][]; unsupported: string[] } => {
  const unsupported: string[] = []
  if (!where || typeof where !== 'object' || Array.isArray(where)) {
    return { groups: [], unsupported }
  }

  const fieldByName = new Map<string, ClientField>()
  for (const f of fields ?? []) {
    if (f.name) fieldByName.set(f.name, f)
  }

  const conditionFor = (fieldName: string, operator: string, value: unknown): FilterCondition => {
    const field = fieldByName.get(fieldName)
    const opLabel = field
      ? getOperatorsForFieldType(field.type).find((o) => o.value === operator)?.label
      : undefined
    if (!LOCAL_OPERATORS.has(operator)) unsupported.push(`${fieldName} ${operator}`)
    return {
      field: fieldName,
      fieldLabel: field ? getFieldLabel(field) : fieldName,
      operator,
      operatorLabel: opLabel ?? operator.replace(/_/g, ' '),
      value,
    }
  }

  /** Flatten a clause (recursing nested `and`) into one AND-group. */
  const parseInto = (clause: WhereClause, group: FilterCondition[]): void => {
    for (const [key, val] of Object.entries(clause)) {
      if (key === 'and' && Array.isArray(val)) {
        for (const c of val as unknown[]) {
          if (c && typeof c === 'object' && !Array.isArray(c)) parseInto(c as WhereClause, group)
        }
        continue
      }
      if (key === 'or' && Array.isArray(val)) {
        const arr = (val as unknown[]).filter(
          (c): c is WhereClause => Boolean(c) && typeof c === 'object' && !Array.isArray(c),
        )
        // A single-entry `or` is just its entry; anything wider can't be
        // expressed inside a group — skip it and report.
        if (arr.length === 1) parseInto(arr[0], group)
        else if (arr.length > 1) unsupported.push('(nested or)')
        continue
      }
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const [op, condValue] of Object.entries(val as Record<string, unknown>)) {
          group.push(conditionFor(key, op, condValue))
        }
      }
    }
  }

  const groups: FilterCondition[][] = []
  const entries = Object.entries(where)
  const isTopLevelOr = entries.length === 1 && entries[0][0] === 'or' && Array.isArray(entries[0][1])

  if (isTopLevelOr) {
    for (const clause of entries[0][1] as unknown[]) {
      if (!clause || typeof clause !== 'object' || Array.isArray(clause)) continue
      const group: FilterCondition[] = []
      parseInto(clause as WhereClause, group)
      if (group.length > 0) groups.push(group)
    }
  } else {
    const group: FilterCondition[] = []
    parseInto(where, group)
    if (group.length > 0) groups.push(group)
  }

  return { groups, unsupported }
}
