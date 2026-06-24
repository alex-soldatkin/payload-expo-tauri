// ---------------------------------------------------------------------------
// HTML tokeniser + tree builder
// ---------------------------------------------------------------------------
import type { HtmlElement, HtmlNode, Token } from './types'

// ---------------------------------------------------------------------------
// HTML entity un-escaping
// ---------------------------------------------------------------------------
export function unescapeHtml(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

/**
 * Parse an attribute string like `href="..." data-type="checkbox" checked`
 * into a Record<string, string>.
 */
function parseAttrs(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  // Match: name="value", name='value', or bare name
  const re = /([a-zA-Z_][\w\-:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(attrStr)) !== null) {
    const key = m[1]
    const val = m[2] ?? m[3] ?? m[4] ?? ''
    attrs[key] = val
  }
  return attrs
}

export function tokenise(html: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < html.length) {
    if (html[pos] === '<') {
      // Find closing >
      const end = html.indexOf('>', pos)
      if (end === -1) {
        // Malformed -- treat rest as text
        tokens.push({ kind: 'text', text: html.slice(pos) })
        break
      }

      const raw = html.slice(pos + 1, end).trim()

      if (raw.startsWith('/')) {
        // Closing tag: </tag>
        const tag = raw.slice(1).trim().split(/\s/)[0].toLowerCase()
        tokens.push({ kind: 'close', tag })
      } else if (raw.endsWith('/')) {
        // Self-closing: <br />, <hr />, <img ... />
        const parts = raw.slice(0, -1).trim()
        const spaceIdx = parts.search(/\s/)
        const tag = (spaceIdx === -1 ? parts : parts.slice(0, spaceIdx)).toLowerCase()
        const attrStr = spaceIdx === -1 ? '' : parts.slice(spaceIdx)
        tokens.push({ kind: 'self-closing', tag, attrs: parseAttrs(attrStr) })
      } else if (raw.startsWith('!')) {
        // Comment or doctype -- skip
      } else {
        // Opening tag
        const spaceIdx = raw.search(/\s/)
        const tag = (spaceIdx === -1 ? raw : raw.slice(0, spaceIdx)).toLowerCase()
        const attrStr = spaceIdx === -1 ? '' : raw.slice(spaceIdx)
        tokens.push({ kind: 'open', tag, attrs: parseAttrs(attrStr) })
      }

      pos = end + 1
    } else {
      // Text content
      const nextTag = html.indexOf('<', pos)
      const text = nextTag === -1 ? html.slice(pos) : html.slice(pos, nextTag)
      if (text.length > 0) {
        tokens.push({ kind: 'text', text })
      }
      pos = nextTag === -1 ? html.length : nextTag
    }
  }

  return tokens
}

/** Tags that are self-closing (void) in HTML */
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link'])

/**
 * Build a simple tree from the flat token list.
 */
export function buildTree(tokens: Token[]): HtmlNode[] {
  const root: HtmlNode[] = []
  const stack: HtmlElement[] = []

  function current(): HtmlNode[] {
    return stack.length > 0 ? stack[stack.length - 1].children : root
  }

  for (const token of tokens) {
    switch (token.kind) {
      case 'text':
        current().push({ kind: 'text', text: token.text! })
        break

      case 'self-closing':
        current().push({
          kind: 'element',
          tag: token.tag!,
          attrs: token.attrs ?? {},
          children: [],
        })
        break

      case 'open': {
        const el: HtmlElement = {
          kind: 'element',
          tag: token.tag!,
          attrs: token.attrs ?? {},
          children: [],
        }
        current().push(el)
        if (!VOID_TAGS.has(token.tag!)) {
          stack.push(el)
        }
        break
      }

      case 'close': {
        // Pop stack back to the matching open tag (tolerant of mismatches)
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tag === token.tag) {
            stack.splice(i)
            break
          }
        }
        break
      }
    }
  }

  return root
}

/**
 * Document-level container tags that carry no meaning of their own.
 *
 * react-native-enriched's `getHTML()` wraps its output in `<html>...</html>`
 * (and pasted/external HTML may carry `<body>`). These must be unwrapped
 * BEFORE block conversion: they aren't in BLOCK_TAGS, so without unwrapping
 * the whole document is treated as one inline run — block structure is
 * flattened into a single paragraph and inter-tag newlines become literal
 * "\n" text nodes.
 */
const DOCUMENT_CONTAINER_TAGS = new Set(['html', 'body'])

export function unwrapDocumentContainers(nodes: HtmlNode[]): HtmlNode[] {
  const result: HtmlNode[] = []
  for (const node of nodes) {
    if (node.kind === 'element') {
      if (node.tag === 'head') continue // metadata, never content
      if (DOCUMENT_CONTAINER_TAGS.has(node.tag)) {
        result.push(...unwrapDocumentContainers(node.children))
        continue
      }
    }
    result.push(node)
  }
  return result
}
