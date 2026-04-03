/**
 * Convert Payload Lexical JSON editor state to react-native-enriched compatible HTML.
 *
 * Zero external dependencies -- safe for React Native.
 * Handles the standard Lexical node types that Payload produces.
 */

// ---------------------------------------------------------------------------
// Text format bitfield (mirrors Payload's nodeFormat.ts)
// ---------------------------------------------------------------------------
const IS_BOLD = 1
const IS_ITALIC = 1 << 1
const IS_STRIKETHROUGH = 1 << 2
const IS_UNDERLINE = 1 << 3
const IS_CODE = 1 << 4
const IS_SUBSCRIPT = 1 << 5
const IS_SUPERSCRIPT = 1 << 6
// IS_HIGHLIGHT = 1 << 7 -- no enriched equivalent, ignored

// ---------------------------------------------------------------------------
// Lightweight types for the subset of Lexical JSON we handle
// ---------------------------------------------------------------------------
export interface LexicalTextNode {
  type: 'text'
  text: string
  format: number
  detail?: number
  mode?: string
  style?: string
  version?: number
}

export interface LexicalLinebreakNode {
  type: 'linebreak'
  version?: number
}

export interface LexicalTabNode {
  type: 'tab'
  version?: number
}

export interface LexicalElementNode {
  type: string
  children: LexicalNode[]
  direction?: string
  format?: string | number
  indent?: number
  version?: number
  // heading
  tag?: string
  // list
  listType?: 'bullet' | 'number' | 'check'
  // listitem
  value?: number
  checked?: boolean
  // link / autolink
  fields?: {
    url?: string
    linkType?: string
    newTab?: boolean
    doc?: { relationTo?: string; value?: Record<string, unknown> | string | number } | null
    alt?: string
    [key: string]: unknown
  }
  // relationship
  relationTo?: string
  // upload
  id?: string
}

export interface LexicalUploadNode {
  type: 'upload'
  relationTo?: string
  value?: Record<string, unknown> | string | number
  fields?: { alt?: string; [key: string]: unknown }
  id?: string
  version?: number
  format?: string | number
}

export interface LexicalRelationshipNode {
  type: 'relationship'
  relationTo: string
  value: Record<string, unknown> | string | number
  version?: number
  format?: string | number
}

export type LexicalNode =
  | LexicalTextNode
  | LexicalLinebreakNode
  | LexicalTabNode
  | LexicalElementNode
  | LexicalUploadNode
  | LexicalRelationshipNode

export interface LexicalEditorState {
  root: {
    type: 'root'
    children: LexicalNode[]
    version?: number
    direction?: string
    format?: string
    indent?: number
  }
}

// ---------------------------------------------------------------------------
// HTML entity escaping
// ---------------------------------------------------------------------------
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------
// Format a text node: wrap content with inline tags based on the bitfield
// ---------------------------------------------------------------------------
function formatText(text: string, format: number): string {
  let result = escapeHtml(text)

  if (format & IS_BOLD) result = `<b>${result}</b>`
  if (format & IS_ITALIC) result = `<i>${result}</i>`
  if (format & IS_STRIKETHROUGH) result = `<s>${result}</s>`
  if (format & IS_UNDERLINE) result = `<u>${result}</u>`
  if (format & IS_CODE) result = `<code>${result}</code>`
  if (format & IS_SUBSCRIPT) result = `<sub>${result}</sub>`
  if (format & IS_SUPERSCRIPT) result = `<sup>${result}</sup>`

  return result
}

// ---------------------------------------------------------------------------
// Resolve the best URL from a link/upload node
// ---------------------------------------------------------------------------
function resolveLinkUrl(fields: LexicalElementNode['fields']): string {
  if (!fields) return '#'
  if (fields.linkType === 'internal' && fields.doc) {
    const doc = fields.doc
    if (typeof doc.value === 'object' && doc.value !== null) {
      // Populated doc -- try common URL fields
      const v = doc.value as Record<string, unknown>
      if (typeof v.url === 'string') return v.url
      if (typeof v.slug === 'string') return `/${doc.relationTo}/${v.slug}`
      if (v.id != null) return `/${doc.relationTo}/${String(v.id)}`
    }
    return '#'
  }
  return fields.url ?? '#'
}

function resolveUploadUrl(node: LexicalUploadNode): string {
  if (typeof node.value === 'object' && node.value !== null) {
    const v = node.value as Record<string, unknown>
    if (typeof v.url === 'string') return v.url
  }
  return ''
}

// ---------------------------------------------------------------------------
// Recursive node serialiser
// ---------------------------------------------------------------------------
function serializeNode(node: LexicalNode): string {
  if (!node || typeof node !== 'object') return ''

  switch (node.type) {
    // ---- Leaf nodes ----
    case 'text': {
      const t = node as LexicalTextNode
      return formatText(t.text ?? '', t.format ?? 0)
    }

    case 'linebreak':
      return '<br>'

    case 'tab':
      return '\t'

    // ---- Upload (decorator / leaf) ----
    case 'upload': {
      const u = node as LexicalUploadNode
      const url = resolveUploadUrl(u)
      if (!url) return ''

      const doc = typeof u.value === 'object' ? (u.value as Record<string, unknown>) : null
      const mimeType = doc ? String(doc.mimeType ?? '') : ''
      const isImage = mimeType.startsWith('image') || /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(url)

      if (isImage) {
        const alt = escapeHtml(String(u.fields?.alt ?? doc?.alt ?? ''))
        const width = doc?.width != null ? ` width="${doc.width}"` : ''
        const height = doc?.height != null ? ` height="${doc.height}"` : ''
        return `<img src="${escapeHtml(url)}" alt="${alt}"${width}${height} />`
      }

      const filename = doc ? String(doc.filename ?? url) : url
      return `<a href="${escapeHtml(url)}">${escapeHtml(filename)}</a>`
    }

    // ---- Relationship (decorator / leaf) ----
    case 'relationship': {
      const r = node as LexicalRelationshipNode
      const collection = r.relationTo ?? ''
      let id: string | number = ''
      let title = ''

      if (typeof r.value === 'object' && r.value !== null) {
        const v = r.value as Record<string, unknown>
        id = (v.id as string | number) ?? ''
        title = String(v.title ?? v.name ?? v.email ?? v.id ?? '')
      } else {
        id = r.value ?? ''
        title = String(id)
      }

      const payload = JSON.stringify({ collection, id })
      return `<mention indicator="@" data-payload='${escapeHtml(payload)}'>${escapeHtml(title)}</mention>`
    }

    // ---- Horizontal rule ----
    case 'horizontalrule':
      return '<hr>'

    default:
      break
  }

  // ---- Element nodes (have children) ----
  const el = node as LexicalElementNode
  const children = Array.isArray(el.children) ? el.children : []
  const inner = children.map(serializeNode).join('')

  switch (el.type) {
    case 'root':
      return inner

    case 'paragraph':
      return inner.length > 0 ? `<p>${inner}</p>` : '<br>'

    case 'heading': {
      const tag = el.tag ?? 'h1'
      return `<${tag}>${inner}</${tag}>`
    }

    case 'quote':
      // enriched expects blockquote wrapping <p>
      return `<blockquote><p>${inner}</p></blockquote>`

    case 'list': {
      if (el.listType === 'check') {
        return `<ul data-type="checkbox">${inner}</ul>`
      }
      const listTag = el.listType === 'number' ? 'ol' : 'ul'
      return `<${listTag}>${inner}</${listTag}>`
    }

    case 'listitem': {
      const checkedAttr = el.checked ? ' checked' : ''
      return `<li${checkedAttr}>${inner}</li>`
    }

    case 'link': {
      const href = escapeHtml(resolveLinkUrl(el.fields))
      return `<a href="${href}">${inner}</a>`
    }

    case 'autolink': {
      const href = escapeHtml(el.fields?.url ?? '#')
      return `<a href="${href}">${inner}</a>`
    }

    default:
      // Unknown element -- just pass children through so we don't lose content
      return inner
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a Payload Lexical editor state JSON object to react-native-enriched
 * compatible HTML.
 *
 * Returns an empty string for null / undefined / empty input.
 */
export function lexicalToHtml(editorState: unknown): string {
  if (editorState == null) return ''
  if (typeof editorState !== 'object') return ''

  const state = editorState as Partial<LexicalEditorState>
  if (!state.root || !Array.isArray(state.root.children)) return ''
  if (state.root.children.length === 0) return ''

  return state.root.children.map(serializeNode).join('')
}
