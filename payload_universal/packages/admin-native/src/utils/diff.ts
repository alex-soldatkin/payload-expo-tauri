/**
 * diff.ts — dependency-free diff helpers for the version comparison view.
 *
 *   - diffWords:          word-level LCS diff between two strings, returning
 *                          same/add/del segments for inline rendering
 *   - deepEqual:          stable deep equality (key-order insensitive,
 *                          arrays element-wise, Dates by timestamp)
 *   - extractLexicalText: plain-text extraction from a Payload Lexical
 *                          editor-state JSON tree (blocks joined by newlines)
 *   - getRelationLabel:   readable label for relationship/upload values
 *   - prettyJson:         stable pretty-printer for json field values
 */

// ---------------------------------------------------------------------------
// Word-level LCS diff
// ---------------------------------------------------------------------------

export type DiffSegment = {
  type: 'same' | 'add' | 'del'
  text: string
}

/**
 * Safety valve for the O(n*m) LCS table. Above this cell count (after
 * common prefix/suffix trimming) the middle is emitted as one del + one add
 * instead of an exact diff, keeping the UI thread responsive on huge texts.
 */
const MAX_LCS_CELLS = 250_000

/** Split into word + whitespace tokens (whitespace preserved as tokens). */
const tokenize = (s: string): string[] =>
  s.length === 0 ? [] : s.split(/(\s+)/).filter((t) => t.length > 0)

/**
 * Word-level diff between two strings using a longest-common-subsequence
 * walk. Returns merged segments in document order; whitespace-only "same"
 * gaps between two segments of the same change type are folded into them
 * so deleted/added phrases highlight as a single run.
 */
export const diffWords = (oldText: string, newText: string): DiffSegment[] => {
  if (oldText === newText) {
    return oldText.length > 0 ? [{ type: 'same', text: oldText }] : []
  }

  const a = tokenize(oldText)
  const b = tokenize(newText)

  const segments: DiffSegment[] = []
  const push = (type: DiffSegment['type'], text: string): void => {
    if (text.length === 0) return
    const last = segments[segments.length - 1]
    if (last && last.type === type) {
      last.text += text
    } else {
      segments.push({ type, text })
    }
  }

  // Trim common prefix/suffix so the DP table only covers the changed middle.
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  push('same', a.slice(0, start).join(''))

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const n = midA.length
  const m = midB.length

  if (n === 0) {
    push('add', midB.join(''))
  } else if (m === 0) {
    push('del', midA.join(''))
  } else if (n * m > MAX_LCS_CELLS) {
    // Too large for an exact diff — replace the whole middle.
    push('del', midA.join(''))
    push('add', midB.join(''))
  } else {
    // LCS lengths table, dp[i][j] = LCS length of midA[i..] vs midB[j..].
    const w = m + 1
    const dp = new Uint32Array((n + 1) * w)
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] =
          midA[i] === midB[j]
            ? dp[(i + 1) * w + (j + 1)] + 1
            : Math.max(dp[(i + 1) * w + j], dp[i * w + (j + 1)])
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        push('same', midA[i])
        i++
        j++
      } else if (dp[(i + 1) * w + j] >= dp[i * w + (j + 1)]) {
        push('del', midA[i])
        i++
      } else {
        push('add', midB[j])
        j++
      }
    }
    while (i < n) {
      push('del', midA[i])
      i++
    }
    while (j < m) {
      push('add', midB[j])
      j++
    }
  }

  push('same', a.slice(endA).join(''))

  // Fold whitespace-only "same" gaps flanked by the same change type
  // ("hello █world█ █again█" → "hello █world again█").
  for (let k = 1; k < segments.length - 1; k++) {
    const seg = segments[k]
    const prev = segments[k - 1]
    const next = segments[k + 1]
    if (
      seg.type === 'same' &&
      /^\s+$/.test(seg.text) &&
      prev.type === next.type &&
      prev.type !== 'same'
    ) {
      prev.text += seg.text + next.text
      segments.splice(k, 2)
      k--
    }
  }

  return segments
}

// ---------------------------------------------------------------------------
// Stable deep equality
// ---------------------------------------------------------------------------

/**
 * Deep equality that is insensitive to object key order, compares arrays
 * element-wise, and compares Dates (or Date-vs-ISO-string) by timestamp.
 * `null` and `undefined` are treated as equal (a missing field and an
 * explicit null are the same change-wise).
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false

  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : Date.parse(String(a))
    const tb = b instanceof Date ? b.getTime() : Date.parse(String(b))
    return !Number.isNaN(ta) && ta === tb
  }

  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false

  const aIsArr = Array.isArray(a)
  const bIsArr = Array.isArray(b)
  if (aIsArr !== bIsArr) return false
  if (aIsArr && bIsArr) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }

  const objA = a as Record<string, unknown>
  const objB = b as Record<string, unknown>
  const keys = new Set([...Object.keys(objA), ...Object.keys(objB)])
  for (const key of keys) {
    if (!deepEqual(objA[key], objB[key])) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Relationship / upload labels
// ---------------------------------------------------------------------------

/**
 * Resolve a relationship/upload value to a readable label instead of an
 * object dump. Handles populated docs, bare ids, polymorphic
 * `{ relationTo, value }` shapes, and hasMany arrays (joined with ", ").
 */
export const getRelationLabel = (value: unknown): string => {
  if (value == null) return ''
  if (Array.isArray(value)) {
    return value.map(getRelationLabel).filter((s) => s.length > 0).join(', ')
  }
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    // Polymorphic { relationTo, value }
    if ('relationTo' in v && 'value' in v) {
      const inner = getRelationLabel(v.value)
      const rel = v.relationTo != null ? String(v.relationTo) : ''
      return rel && inner ? `${inner} (${rel})` : inner || rel
    }
    for (const key of ['title', 'name', 'label', 'filename', 'email', 'slug']) {
      const candidate = v[key]
      if (typeof candidate === 'string' && candidate.length > 0) return candidate
    }
    if (v.id != null) return String(v.id)
    return ''
  }
  return String(value)
}

// ---------------------------------------------------------------------------
// Lexical plain-text extraction
// ---------------------------------------------------------------------------

type AnyLexicalNode = {
  type?: string
  text?: string
  children?: unknown[]
  value?: unknown
  fields?: Record<string, unknown>
}

/** Element types that render as their own line/block in plain text. */
const BLOCK_NODE_TYPES = new Set([
  'paragraph',
  'heading',
  'quote',
  'list',
  'listitem',
  'table',
  'tablerow',
  'horizontalrule',
  'block',
  'upload',
])

const lexicalNodeText = (raw: unknown): string => {
  if (raw == null || typeof raw !== 'object') return ''
  const node = raw as AnyLexicalNode

  switch (node.type) {
    case 'text':
      return typeof node.text === 'string' ? node.text : ''
    case 'linebreak':
      return '\n'
    case 'tab':
      return '\t'
    case 'horizontalrule':
      return ''
    case 'upload': {
      const v = node.value
      if (v != null && typeof v === 'object') {
        const doc = v as Record<string, unknown>
        const label = doc.filename ?? doc.alt ?? doc.title ?? doc.id
        return label != null ? String(label) : ''
      }
      return v != null ? String(v) : ''
    }
    case 'relationship':
      return getRelationLabel(node.value)
    default:
      break
  }

  const children = Array.isArray(node.children) ? node.children : []
  if (children.length === 0) return ''

  const hasBlockChildren = children.some(
    (c) =>
      c != null &&
      typeof c === 'object' &&
      BLOCK_NODE_TYPES.has((c as AnyLexicalNode).type ?? ''),
  )

  const parts = children.map(lexicalNodeText)
  if (hasBlockChildren) {
    return parts.filter((p) => p.length > 0).join('\n')
  }
  if (node.type === 'tablerow') {
    return parts.filter((p) => p.length > 0).join(' | ')
  }
  return parts.join('')
}

/**
 * Extract readable plain text from a Payload Lexical editor-state JSON
 * object. Block-level nodes are joined with newlines; inline formatting is
 * dropped. Returns '' for null/invalid input.
 */
export const extractLexicalText = (editorState: unknown): string => {
  if (editorState == null || typeof editorState !== 'object') return ''
  const root = (editorState as { root?: { children?: unknown } }).root
  if (root == null || !Array.isArray(root.children)) return ''
  return root.children
    .map(lexicalNodeText)
    .filter((s) => s.length > 0)
    .join('\n')
}

// ---------------------------------------------------------------------------
// JSON pretty-printing
// ---------------------------------------------------------------------------

/** Pretty-print a json field value (object or JSON string) for diffing. */
export const prettyJson = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2) ?? ''
  } catch {
    return String(value)
  }
}
