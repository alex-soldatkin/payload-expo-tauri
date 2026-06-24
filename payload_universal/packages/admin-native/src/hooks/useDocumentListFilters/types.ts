/**
 * Domain + persistence types for the document-list filter model.
 *
 * Web-parity OR-group model (WhereBuilder semantics): filters live in
 * OR-groups — conditions inside a group AND together, groups OR together.
 */

export type ActiveFilter = {
  id: string
  field: string
  fieldLabel: string
  operator: string
  operatorLabel: string
  value: unknown
  /** Human-readable value for chip display (e.g. relationship doc title). */
  valueLabel?: string
  /**
   * OR-group this filter belongs to (0-based, contiguous). Conditions with
   * the same groupIndex AND together; distinct groups OR together.
   * Absent ⇒ group 0 (legacy flat AND shape).
   */
  groupIndex?: number
}

/** One OR-group: a list of AND-combined conditions (web WhereBuilder row). */
export type FilterGroup = ActiveFilter[]

/**
 * A condition payload without runtime identity (no id / groupIndex) — the
 * exchange shape for presets: `whereToFilterGroups` produces groups of these
 * and `setFilterGroups` replaces the active filters with them.
 */
export type FilterCondition = Omit<ActiveFilter, 'id' | 'groupIndex'>

export type Args = {
  /** Field names to search across for free-text queries. */
  searchFields?: string[]
  /**
   * Collection slug — when provided, filter groups persist per collection
   * in AsyncStorage (`list_filters:{collection}`).
   */
  collection?: string
}

export type PersistedFilter = Omit<ActiveFilter, 'id' | 'groupIndex'>
export type PersistedFiltersV2 = { v: number; groups: PersistedFilter[][] }

/** A Payload-style `where` query object (recursive `and` / `or` arrays). */
export type WhereClause = Record<string, unknown>
