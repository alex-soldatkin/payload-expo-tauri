/**
 * Convert react-native-enriched HTML back to Payload Lexical JSON format.
 *
 * Zero external dependencies -- uses a simple regex-based parser since
 * enriched produces clean, predictable HTML with a known subset of tags.
 */

import { convertSingleBlock, convertTopLevelImg } from './block'
import { convertInlineNodes, isBlockElement } from './inline'
import { paragraphNode } from './nodeBuilders'
import { buildTree, tokenise, unwrapDocumentContainers } from './tokenizer'
import type { HtmlElement, HtmlNode, LexicalAnyNode, LexicalEditorState } from './types'

// Re-export the full type surface so `from './htmlToLexical'` resolves
// identically to the old single-file module.
export type {
  HtmlElement,
  HtmlNode,
  HtmlText,
  LexicalAnyNode,
  LexicalAutoLinkNode,
  LexicalEditorState,
  LexicalElementNodeBase,
  LexicalHeadingNode,
  LexicalHorizontalRuleNode,
  LexicalLinebreakNode,
  LexicalLinkNode,
  LexicalListItemNode,
  LexicalListNode,
  LexicalParagraphNode,
  LexicalQuoteNode,
  LexicalRelationshipNode,
  LexicalTabNode,
  LexicalTableCellNode,
  LexicalTableNode,
  LexicalTableRowNode,
  LexicalTextNode,
  LexicalUploadNode,
  Token,
} from './types'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert react-native-enriched HTML to a Payload Lexical editor state JSON
 * object.
 *
 * Returns null for empty / null / undefined input.
 */
export function htmlToLexical(html: string): LexicalEditorState | null {
  if (!html || typeof html !== 'string') return null

  const trimmed = html.trim()
  if (trimmed.length === 0) return null

  // Tokenise and build tree, then strip document containers (<html>/<body>)
  // so block-level conversion sees the actual content nodes.
  const tokens = tokenise(trimmed)
  const tree = unwrapDocumentContainers(buildTree(tokens))

  if (tree.length === 0) return null

  // Check for top-level images that should be handled specially
  const processed: HtmlNode[] = []
  for (const node of tree) {
    if (node.kind === 'element' && node.tag === 'img') {
      // Mark for special handling below
      processed.push(node)
    } else {
      processed.push(node)
    }
  }

  // Convert to Lexical block nodes
  const blockNodes: LexicalAnyNode[] = []
  const pendingInline: HtmlNode[] = []

  function flushInline() {
    if (pendingInline.length === 0) return
    const inlineNodes = convertInlineNodes(pendingInline, 0)
    if (inlineNodes.length > 0) {
      blockNodes.push(paragraphNode(inlineNodes))
    }
    pendingInline.length = 0
  }

  for (const node of processed) {
    if (node.kind === 'text') {
      if (node.text.trim().length === 0 && pendingInline.length === 0) continue
      pendingInline.push(node)
      continue
    }

    if (node.kind === 'element' && node.tag === 'img') {
      flushInline()
      blockNodes.push(convertTopLevelImg(node))
      continue
    }

    if (!isBlockElement(node)) {
      pendingInline.push(node)
      continue
    }

    flushInline()

    const converted = convertSingleBlock(node as HtmlElement)
    if (converted) {
      if (Array.isArray(converted)) {
        blockNodes.push(...converted)
      } else {
        blockNodes.push(converted)
      }
    }
  }

  flushInline()

  if (blockNodes.length === 0) return null

  return {
    root: {
      type: 'root',
      children: blockNodes,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}
