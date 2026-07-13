// Small helpers for displaying + editing generic Payload documents.

/** Keys that are server/replication-managed and never user-editable. */
const RESERVED_KEYS = new Set(['id', 'createdAt', 'updatedAt'])

/** Pick a human-ish title for a document row. */
export function docTitle(doc: Record<string, unknown>, useAsTitle?: string): string {
  const candidates = [useAsTitle, 'title', 'name', 'email', 'id'].filter(Boolean) as string[]
  for (const key of candidates) {
    const v = doc[key]
    if (typeof v === 'string' && v.trim()) return v
    if (typeof v === 'number') return String(v)
  }
  return '(untitled)'
}

/**
 * The editable subset of a document: drops id/createdAt/updatedAt and every
 * key beginning with `_` (RxDB/replication bookkeeping like _deleted,
 * _locallyModified, _rev, _meta, _attachments, _status handled server-side).
 */
export function editableFields(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    if (RESERVED_KEYS.has(key)) continue
    if (key.startsWith('_')) continue
    out[key] = value
  }
  return out
}

/** Format an ISO timestamp compactly for list rows / editor header. */
export function formatUpdatedAt(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
