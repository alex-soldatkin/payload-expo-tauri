/**
 * Converts RxDB Mango query selectors to SQL WHERE clauses.
 *
 * Handles common operators natively in SQL for indexed, efficient queries.
 * Falls back gracefully for complex operators ($regex, $elemMatch, etc.)
 * by flagging the result so the caller can apply a JS post-filter.
 */

// ------------------------------------------------------------------ types

export type SQLWhereResult = {
  /** SQL WHERE clause (without the "WHERE" keyword). Empty string = no conditions. */
  where: string
  /** Positional parameters for the WHERE clause placeholders. */
  params: SQLParam[]
  /** When true the SQL result is a superset — caller must JS-filter the rows. */
  needsPostFilter: boolean
}

export type SQLParam = string | number | null

// ------------------------------------------------------------------ helpers

/** Operators we cannot (or choose not to) express in SQL. */
const JS_ONLY_OPS = new Set([
  '$regex',
  '$options',
  '$elemMatch',
  '$type',
  '$mod',
  '$size',
  '$not',
])

/**
 * Map a Mango field path to its SQL column expression.
 *
 * Dedicated columns are used for the primary key and RxDB meta-fields so
 * that the SQLite query planner can use their indexes.  Everything else
 * goes through `json_extract(data, '$.field')`.
 */
export function fieldToSQL(field: string, primaryPath: string): string {
  if (field === primaryPath || field === 'id') return 'id'
  if (field === '_deleted') return 'deleted'
  if (field === '_meta.lwt') return 'lastWriteTime'
  if (field === '_rev') return 'revision'
  return `json_extract(data, '$.${field}')`
}

/** Convert a JS value to a SQLite-safe parameter (booleans → 0/1). */
function toParam(v: unknown): SQLParam {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'number') return v
  return String(v)
}

// --------------------------------------------------------- selector → SQL

/**
 * Recursively convert a Mango selector object into a SQL WHERE clause.
 */
export function mangoSelectorToSQL(
  selector: Record<string, unknown>,
  primaryPath: string,
): SQLWhereResult {
  const parts: string[] = []
  const params: SQLParam[] = []
  let needsPostFilter = false

  for (const [key, value] of Object.entries(selector)) {
    // ---- logical combinators ----

    if (key === '$and') {
      const subs = (value as Record<string, unknown>[]).map((s) =>
        mangoSelectorToSQL(s, primaryPath),
      )
      const clauses = subs.map((s) => s.where).filter(Boolean)
      if (clauses.length) {
        parts.push(`(${clauses.join(' AND ')})`)
        subs.forEach((s) => params.push(...s.params))
      }
      if (subs.some((s) => s.needsPostFilter)) needsPostFilter = true
      continue
    }

    if (key === '$or') {
      const subs = (value as Record<string, unknown>[]).map((s) =>
        mangoSelectorToSQL(s, primaryPath),
      )
      const clauses = subs.map((s) => s.where).filter(Boolean)
      if (clauses.length) {
        parts.push(`(${clauses.join(' OR ')})`)
        subs.forEach((s) => params.push(...s.params))
      }
      if (subs.some((s) => s.needsPostFilter)) needsPostFilter = true
      continue
    }

    if (key === '$nor') {
      const subs = (value as Record<string, unknown>[]).map((s) =>
        mangoSelectorToSQL(s, primaryPath),
      )
      const clauses = subs.map((s) => s.where).filter(Boolean)
      if (clauses.length) {
        parts.push(`NOT (${clauses.join(' OR ')})`)
        subs.forEach((s) => params.push(...s.params))
      }
      if (subs.some((s) => s.needsPostFilter)) needsPostFilter = true
      continue
    }

    // ---- field-level conditions ----

    const col = fieldToSQL(key, primaryPath)

    // Null / undefined equality
    if (value === null || value === undefined) {
      parts.push(`${col} IS NULL`)
      continue
    }

    // Direct value (not an operator object) → implicit $eq
    if (typeof value !== 'object' || Array.isArray(value)) {
      parts.push(`${col} = ?`)
      params.push(toParam(value))
      continue
    }

    // Operator object  { $gt: 5, $lt: 10, … }
    for (const [op, opVal] of Object.entries(value as Record<string, unknown>)) {
      if (JS_ONLY_OPS.has(op)) {
        needsPostFilter = true
        continue
      }

      switch (op) {
        case '$eq':
          if (opVal === null) {
            parts.push(`${col} IS NULL`)
          } else {
            parts.push(`${col} = ?`)
            params.push(toParam(opVal))
          }
          break

        case '$ne':
          if (opVal === null) {
            parts.push(`${col} IS NOT NULL`)
          } else {
            parts.push(`${col} != ?`)
            params.push(toParam(opVal))
          }
          break

        case '$gt':
          parts.push(`${col} > ?`)
          params.push(toParam(opVal))
          break

        case '$gte':
          parts.push(`${col} >= ?`)
          params.push(toParam(opVal))
          break

        case '$lt':
          parts.push(`${col} < ?`)
          params.push(toParam(opVal))
          break

        case '$lte':
          parts.push(`${col} <= ?`)
          params.push(toParam(opVal))
          break

        case '$in': {
          const arr = opVal as unknown[]
          if (arr.length === 0) {
            parts.push('0') // always false
          } else {
            parts.push(`${col} IN (${arr.map(() => '?').join(', ')})`)
            arr.forEach((v) => params.push(toParam(v)))
          }
          break
        }

        case '$nin': {
          const arr = opVal as unknown[]
          if (arr.length > 0) {
            parts.push(`${col} NOT IN (${arr.map(() => '?').join(', ')})`)
            arr.forEach((v) => params.push(toParam(v)))
          }
          break
        }

        case '$exists':
          parts.push(opVal ? `${col} IS NOT NULL` : `${col} IS NULL`)
          break

        default:
          // Unknown / unsupported operator → JS fallback
          needsPostFilter = true
          break
      }
    }
  }

  return {
    where: parts.length > 0 ? parts.join(' AND ') : '',
    params,
    needsPostFilter,
  }
}

// ----------------------------------------------------------- sort → SQL

/**
 * Convert a Mango sort array to a SQL ORDER BY clause (without the keyword).
 */
export function mangoSortToSQL(
  sort: Array<Record<string, 'asc' | 'desc'>>,
  primaryPath: string,
): string {
  if (!sort || sort.length === 0) return ''

  return sort
    .map((part) => {
      const [field, dir] = Object.entries(part)[0]
      return `${fieldToSQL(field, primaryPath)} ${dir.toUpperCase()}`
    })
    .join(', ')
}
