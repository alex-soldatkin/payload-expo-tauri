// ---------------------------------------------------------------------------
// Value normalization + content preparation
// ---------------------------------------------------------------------------
import type { TableNode } from '../TableEditor'
import { htmlToLexical, lexicalToHtml } from './converters'
import type { ContentBlock, PreparedContent } from './types'

export const escapeInlineText = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Serialized form of the value, used to detect external changes. */
export const serializeValue = (v: unknown): string => {
  try {
    return JSON.stringify(v ?? null) ?? 'null'
  } catch {
    return 'null'
  }
}

/**
 * Normalize the richText form value into one of three shapes:
 * - Lexical JSON object ({ root: ... }) — normal Payload shape
 * - JSON string of the above — some sync/storage layers stringify
 * - raw HTML string ('<'-prefixed) — already editor-shaped, used directly
 * - any other string — treated as plain text (escaped into a paragraph)
 */
export function normalizeRichTextValue(
  raw: unknown,
):
  | { kind: 'lexical'; state: any }
  | { kind: 'html'; html: string }
  | { kind: 'empty' } {
  if (raw == null) return { kind: 'empty' }

  if (typeof raw === 'object') {
    return 'root' in (raw as Record<string, unknown>)
      ? { kind: 'lexical', state: raw }
      : { kind: 'empty' }
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed.length === 0) return { kind: 'empty' }
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed === 'object' && 'root' in parsed) {
          return { kind: 'lexical', state: parsed }
        }
      } catch { /* fall through to string handling */ }
    }
    if (trimmed.startsWith('<')) return { kind: 'html', html: trimmed }
    return {
      kind: 'html',
      html: `<p>${escapeInlineText(trimmed).replace(/\n/g, '<br>')}</p>`,
    }
  }

  return { kind: 'empty' }
}

/** Split a Lexical state into text blocks + extracted table blocks. */
export function splitBlocks(state: unknown): { blocks: ContentBlock[]; tables: TableNode[] } {
  if (!state || typeof state !== 'object' || !('root' in (state as any))) {
    return { blocks: [{ type: 'text', nodes: [] }], tables: [] }
  }
  const root = (state as any).root
  const children: any[] = root?.children ?? []
  const blocks: ContentBlock[] = []
  const tables: TableNode[] = []
  let textBuf: any[] = []

  for (const child of children) {
    if (child.type === 'table') {
      if (textBuf.length > 0) {
        blocks.push({ type: 'text', nodes: [...textBuf] })
        textBuf = []
      }
      blocks.push({ type: 'table', index: tables.length, node: child })
      tables.push(child)
    } else {
      textBuf.push(child)
    }
  }
  if (textBuf.length > 0 || blocks.length === 0) {
    blocks.push({ type: 'text', nodes: textBuf })
  }

  return { blocks, tables }
}

/** Derive blocks, tables and (unwrapped) editor HTML from any value shape. */
export function prepareContent(raw: unknown): PreparedContent {
  const norm = normalizeRichTextValue(raw)

  if (norm.kind === 'empty') {
    return { blocks: [{ type: 'text', nodes: [] }], tables: [], html: '' }
  }

  if (norm.kind === 'html') {
    let state: unknown = null
    try {
      state = htmlToLexical(norm.html)
    } catch { state = null }
    const { blocks, tables } = splitBlocks(state)
    // No tables → safe to feed the raw HTML to the editor directly.
    if (tables.length === 0) return { blocks, tables, html: norm.html }
    // Tables can't render inline — fall through and regenerate text-only HTML.
    return prepareFromLexicalState(state)
  }

  return prepareFromLexicalState(norm.state)
}

export function prepareFromLexicalState(state: unknown): PreparedContent {
  const { blocks, tables } = splitBlocks(state)
  const textNodes = blocks
    .filter((b): b is { type: 'text'; nodes: any[] } => b.type === 'text')
    .flatMap((b) => b.nodes)

  let html = ''
  if (textNodes.length > 0) {
    const fakeState = {
      root: { type: 'root', children: textNodes, direction: 'ltr', format: '', indent: 0, version: 1 },
    }
    try {
      html = lexicalToHtml(fakeState)
    } catch { html = '' }
  }
  return { blocks, tables, html }
}
