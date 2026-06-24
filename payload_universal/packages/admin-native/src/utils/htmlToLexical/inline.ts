// ---------------------------------------------------------------------------
// Convert inline HTML nodes to Lexical nodes
// ---------------------------------------------------------------------------
import {
  IS_BOLD,
  IS_CODE,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_UNDERLINE,
} from './format'
import { linebreakNode, linkNode, relationshipNode, textNode } from './nodeBuilders'
import { unescapeHtml } from './tokenizer'
import type { HtmlNode, LexicalAnyNode } from './types'

/** Inline formatting tags mapped to their format bit */
const INLINE_FORMAT_TAGS: Record<string, number> = {
  b: IS_BOLD,
  strong: IS_BOLD,
  i: IS_ITALIC,
  em: IS_ITALIC,
  s: IS_STRIKETHROUGH,
  strike: IS_STRIKETHROUGH,
  del: IS_STRIKETHROUGH,
  u: IS_UNDERLINE,
  code: IS_CODE,
  sub: IS_SUBSCRIPT,
  sup: IS_SUPERSCRIPT,
}

/** Tags that produce block-level Lexical nodes */
export const BLOCK_TAGS = new Set([
  'p',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote',
  'ul', 'ol',
  'li',
  'hr',
  'codeblock',
  'div',
  'table', 'tbody', 'thead', 'tr', 'td', 'th',
])

/**
 * Collect inline content into text nodes, applying the given inherited format.
 * Returns an array of LexicalAnyNode (text, linebreak, link, mention etc.).
 */
export function convertInlineNodes(nodes: HtmlNode[], inheritedFormat: number): LexicalAnyNode[] {
  const result: LexicalAnyNode[] = []

  for (const node of nodes) {
    if (node.kind === 'text') {
      const text = unescapeHtml(node.text)
      if (text.length > 0) {
        result.push(textNode(text, inheritedFormat))
      }
      continue
    }

    // Element
    const el = node
    const tag = el.tag

    // Self-closing / void tags
    if (tag === 'br') {
      result.push(linebreakNode())
      continue
    }

    if (tag === 'img') {
      // Inside inline context, treat image as text fallback
      const alt = el.attrs.alt || el.attrs.src || ''
      if (alt) {
        result.push(textNode(unescapeHtml(alt), inheritedFormat))
      }
      continue
    }

    // Links
    if (tag === 'a') {
      const href = el.attrs.href ?? ''
      const linkChildren = convertInlineNodes(el.children, inheritedFormat)
      if (linkChildren.length === 0) {
        linkChildren.push(textNode(href, 0))
      }
      result.push(linkNode(unescapeHtml(href), linkChildren))
      continue
    }

    // Mention (relationship)
    if (tag === 'mention') {
      const dataPayload = el.attrs['data-payload']
      if (dataPayload) {
        try {
          const parsed = JSON.parse(unescapeHtml(dataPayload))
          if (parsed.collection && parsed.id != null) {
            result.push(relationshipNode(parsed.collection, parsed.id))
            continue
          }
        } catch {
          // Fall through to text extraction
        }
      }
      // Fallback: extract text content
      const innerText = extractText(el.children)
      if (innerText) result.push(textNode(innerText, inheritedFormat))
      continue
    }

    // Inline formatting tags
    if (tag in INLINE_FORMAT_TAGS) {
      const formatBit = INLINE_FORMAT_TAGS[tag]
      const innerNodes = convertInlineNodes(el.children, inheritedFormat | formatBit)
      result.push(...innerNodes)
      continue
    }

    // Span or other unknown inline elements -- pass through children
    const innerNodes = convertInlineNodes(el.children, inheritedFormat)
    result.push(...innerNodes)
  }

  return result
}

/**
 * Extract plain text from HTML nodes (for fallback purposes).
 */
export function extractText(nodes: HtmlNode[]): string {
  let text = ''
  for (const node of nodes) {
    if (node.kind === 'text') {
      text += unescapeHtml(node.text)
    } else {
      text += extractText(node.children)
    }
  }
  return text
}

/**
 * Determine whether an HTML node is a block-level element.
 */
export function isBlockElement(node: HtmlNode): boolean {
  return node.kind === 'element' && BLOCK_TAGS.has(node.tag)
}
