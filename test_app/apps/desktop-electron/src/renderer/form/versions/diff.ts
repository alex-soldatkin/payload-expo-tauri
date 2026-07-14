// Top-level, schema-agnostic diff of two document snapshots.
//
// A version's `version` payload and the live doc are plain records; we compare
// them key-by-key using JSON.stringify (same convention as the sync merge code)
// rather than a deep structural walk. The renderer shows the compact values.

export type DiffStatus = 'unchanged' | 'changed' | 'added' | 'removed'

export type DiffRow = {
  key: string
  status: DiffStatus
  aValue: unknown
  bValue: unknown
}

/** Keys never diffed: server bookkeeping and internal `_`-prefixed keys. */
const SKIP_KEYS = new Set(['id', 'createdAt', 'updatedAt'])

function skipKey(key: string): boolean {
  if (SKIP_KEYS.has(key)) return true
  // Drop replication/internal bookkeeping, but keep the publish state.
  if (key.startsWith('_') && key !== '_status') return true
  return false
}

/** Stable JSON compare (matches the sync merge's equality convention). */
function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Diff the union of top-level keys of `a` (this version) and `b` (current doc).
 * 'added' = present in b but not a; 'removed' = present in a but not b.
 */
export function diffDocs(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): DiffRow[] {
  const keys = new Set<string>()
  for (const k of Object.keys(a)) if (!skipKey(k)) keys.add(k)
  for (const k of Object.keys(b)) if (!skipKey(k)) keys.add(k)

  const rows: DiffRow[] = []
  for (const key of [...keys].sort()) {
    const inA = Object.prototype.hasOwnProperty.call(a, key)
    const inB = Object.prototype.hasOwnProperty.call(b, key)
    const aValue = a[key]
    const bValue = b[key]

    let status: DiffStatus
    if (inA && !inB) status = 'removed'
    else if (!inA && inB) status = 'added'
    else status = jsonEqual(aValue, bValue) ? 'unchanged' : 'changed'

    rows.push({ key, status, aValue, bValue })
  }
  return rows
}

/** Compact, human-readable rendering of a single value for a diff cell. */
export function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    return String(v)
  }
  let json: string
  try {
    json = JSON.stringify(v, null, 2) ?? String(v)
  } catch {
    return String(v)
  }
  return json.length > 400 ? `${json.slice(0, 400)}…` : json
}
