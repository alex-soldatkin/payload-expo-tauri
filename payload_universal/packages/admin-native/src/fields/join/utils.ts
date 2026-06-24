/**
 * JoinField helpers — column defaults, cell/column formatting, value parsing.
 */
import type { PaginatedDocs } from '../../types'

/** Default columns when none specified in config. */
export const DEFAULT_COLUMNS = ['id', 'createdAt', 'updatedAt']

/** Column width constraints. */
export const COLUMN_MIN_WIDTH = 120
export const COLUMN_MAX_WIDTH = 220

/** Best-effort display value for a cell. */
export const formatCellValue = (val: unknown): string => {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    // Populated relationship — show title/name/email/id
    return String(obj.title ?? obj.name ?? obj.email ?? obj.id ?? JSON.stringify(val))
  }
  // ISO date → readable format
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    try {
      return new Date(val).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return val }
  }
  return String(val)
}

/** Parse pre-populated join value (Payload sends paginated docs for join fields). */
export const parseJoinValue = (value: unknown): PaginatedDocs | null => {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (Array.isArray(v.docs)) return v as unknown as PaginatedDocs
  return null
}

/** Pretty-print a column name: 'createdAt' → 'Created At'. */
export const formatColumnName = (col: string): string =>
  col.charAt(0).toUpperCase() + col.slice(1).replace(/([A-Z])/g, ' $1')
