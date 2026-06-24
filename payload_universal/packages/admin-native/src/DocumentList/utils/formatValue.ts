/**
 * DocumentList card-value formatters — the scalar display layer shared by the
 * card rows and (via formatTableCellValue) the table cells. Pure helpers.
 */
import { summariseArrayValue, titleishFromObject } from '../../DocumentListTable'

export const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/** Format a field value for display on the card. */
export const formatFieldValue = (val: unknown): string => {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  // Arrays (array/blocks fields, hasMany values) — compact summary,
  // never a raw JSON dump
  if (Array.isArray(val)) return summariseArrayValue(val)
  if (typeof val === 'object') {
    // Relationship / upload (populated object) — title-ish display value;
    // unrecognisable objects (e.g. rich-text trees) show an em dash
    // instead of a JSON dump
    return titleishFromObject(val as Record<string, unknown>) ?? '—'
  }
  const s = String(val)
  // Date-like strings — format nicely
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return formatDate(s)
  return s
}
