// ---------------------------------------------------------------------------
// Pure formatting helpers for the filter sheet
// ---------------------------------------------------------------------------
import type { ActiveFilter } from '../hooks/useDocumentListFilters'
import type { QueryPresetDoc, WhereClause } from './types'

export const presetWhereOf = (preset: QueryPresetDoc): WhereClause | undefined =>
  preset.where && typeof preset.where === 'object' && !Array.isArray(preset.where)
    ? (preset.where as WhereClause)
    : undefined

export const formatDateLabel = (d: Date): string =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export const truncateLabel = (s: string): string => (s.length > 28 ? s.slice(0, 28) + '…' : s)

/** Human-readable condition value for overview rows (mirrors chip display). */
export const formatFilterValue = (filter: ActiveFilter): string => {
  if (filter.valueLabel) return truncateLabel(filter.valueLabel)
  const { value } = filter
  if (value === true) return 'true'
  if (value === false) return 'false'
  if (value == null) return ''
  if (Array.isArray(value)) return truncateLabel(value.map(String).join(', '))
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return formatDateLabel(d)
  }
  return truncateLabel(s)
}

/** Best-effort display title for a relationship/upload doc row. */
export const docDisplayTitle = (doc: Record<string, unknown>, useAsTitle?: string): string => {
  if (useAsTitle && doc[useAsTitle] != null) return String(doc[useAsTitle])
  return String(doc.title ?? doc.name ?? doc.email ?? doc.filename ?? doc.id ?? '')
}
