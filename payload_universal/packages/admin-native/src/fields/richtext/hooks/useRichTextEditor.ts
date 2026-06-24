import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Keyboard } from 'react-native'
import type { NativeSyntheticEvent } from 'react-native'

import type { ClientRichTextField, FieldComponentProps } from '../../../types'
import { defaultTheme as t } from '../../../theme'
import { useListColors } from '../../../hooks/useListColors'
import type { StyleState } from '../../RichTextToolbar'
import type { TableNode } from '../../TableEditor'
import { _useLocalDB } from '../optional'
import { htmlToLexical, wrapEditorHtml } from '../converters'
import { prepareContent, serializeValue } from '../content'
import { useDebouncedCallback } from '../useDebouncedCallback'
import type { ContentBlock, EditorRef, PreparedContent } from '../types'
import { useRichTextActions } from './useRichTextActions'

/**
 * Owns all state, refs, effects, and event handlers for the enriched
 * RichText editor. Returns everything the render needs; the JSX stays thin.
 */
export function useRichTextEditor({
  field,
  value,
  onChange,
  disabled,
}: Pick<FieldComponentProps<ClientRichTextField>, 'field' | 'value' | 'onChange' | 'disabled'>) {
  const editorRef = useRef<EditorRef | null>(null)
  const { dark: isDarkScheme, colors: rtColors } = useListColors()
  const [focused, setFocused] = useState(false)
  const [styleState, setStyleState] = useState<StyleState | null>(null)

  // Selection tracking for setLink / removeLink
  const selectionRef = useRef<{ start: number; end: number; text: string }>({
    start: 0,
    end: 0,
    text: '',
  })

  // Link detection for editing existing links
  const [currentLink, setCurrentLink] = useState<{
    url: string; text: string; start: number; end: number
  } | null>(null)

  // Previous text for markdown shortcut detection
  const prevTextRef = useRef('')

  // Optional local-db for upload queue
  const localDB = _useLocalDB ? _useLocalDB() : null

  // ---------- Normalize value → text blocks, table blocks, editor HTML ----------
  const initialContent = useMemo(() => prepareContent(value), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Mutable so external value arrivals can refresh the table-merge layout.
  const contentBlocksRef = useRef<ContentBlock[]>(initialContent.blocks)

  // Table state — mutable array of TableNode
  const [tables, setTables] = useState<TableNode[]>(initialContent.tables)

  // HTML (unwrapped) for the editor at mount
  const defaultHtml = initialContent.html

  // Serialized form value as last produced BY this editor (or accepted from
  // outside) — mirrors the lastFormValueRef pattern in inputs/textBridge.ts.
  const lastFormValueRef = useRef(serializeValue(value))
  const focusedRef = useRef(false)

  // ---------- External value arrival (uncontrolled editor) ----------
  // EnrichedTextInput only reads `defaultValue` at mount. When a synced doc
  // updates the form value AFTER mount, push it in via ref.setValue — but
  // never for our own onChange round-trips, and never while the user types.
  React.useEffect(() => {
    const incoming = serializeValue(value)
    if (incoming === lastFormValueRef.current) return

    // Compare at the editor-HTML level too: a re-shaped echo of the same
    // content (key reordering, server normalization) must not reset the editor.
    let prev: PreparedContent | null = null
    try {
      prev = prepareContent(JSON.parse(lastFormValueRef.current))
    } catch { prev = null }
    lastFormValueRef.current = incoming

    const next = prepareContent(value)
    if (
      prev &&
      next.html === prev.html &&
      serializeValue(next.tables) === serializeValue(prev.tables)
    ) {
      return
    }

    // Don't clobber active typing — the editor's content wins on next save.
    if (focusedRef.current) return

    contentBlocksRef.current = next.blocks
    setTables(next.tables)
    prevTextRef.current = ''
    editorRef.current?.setValue(wrapEditorHtml(next.html))
  }, [value])

  // ---------- Merge text + tables back into one Lexical state ----------
  const mergeAndSave = useCallback(async () => {
    if (!editorRef.current) return
    try {
      const html = await editorRef.current.getHTML()
      const lexical = htmlToLexical(html) as any
      if (!lexical?.root?.children) return

      // Rebuild the children array interleaving text and tables
      const textNodes = lexical.root.children
      const merged: any[] = []
      let textIdx = 0

      for (const block of contentBlocksRef.current) {
        if (block.type === 'table') {
          // Insert all accumulated text nodes before this table
          // (we approximate: text blocks map to the original order)
          merged.push(tables[block.index])
        } else {
          // Push text nodes from the parsed HTML
          // Each text block corresponds to a chunk of non-table nodes
          while (textIdx < textNodes.length) {
            const node = textNodes[textIdx]
            textIdx++
            merged.push(node)
            // If we've consumed enough text nodes for this block, break
            // Simple heuristic: consume the same number as the original block had
            if (textIdx >= textNodes.length ||
                (block.nodes.length > 0 && merged.filter(n => n.type !== 'table').length >= block.nodes.length)) break
          }
        }
      }
      // Append any remaining text nodes
      while (textIdx < textNodes.length) {
        merged.push(textNodes[textIdx++])
      }

      const nextValue = { root: { ...lexical.root, children: merged } }
      // Record what we push so the external-sync effect ignores the round-trip.
      lastFormValueRef.current = serializeValue(nextValue)
      onChange(nextValue)
    } catch { /* ignore */ }
  }, [onChange, tables])

  // ---------- Debounced onChange sync ----------
  const debouncedSync = useDebouncedCallback(async () => {
    await mergeAndSave()
  }, 600)

  // ---------- Markdown shortcuts (Notion-style) ----------

  const handleChangeText = useCallback(
    (e: NativeSyntheticEvent<{ value: string }>) => {
      const text = e.nativeEvent.value
      const prev = prevTextRef.current
      prevTextRef.current = text

      // Only check when exactly one character was added (space or newline trigger)
      if (text.length !== prev.length + 1) return
      const lastChar = text[text.length - 1]
      if (lastChar !== ' ' && lastChar !== '\n') return

      // Find the start of the current line
      const cursorPos = text.length - 1 // position of the space/newline just typed
      const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1
      const line = text.slice(lineStart, cursorPos) // text before the trigger char

      // Match markdown patterns
      let matched = false
      if (line === '#') { editorRef.current?.toggleH1(); matched = true }
      else if (line === '##') { editorRef.current?.toggleH2(); matched = true }
      else if (line === '###') { editorRef.current?.toggleH3(); matched = true }
      else if (line === '-' || line === '*') { editorRef.current?.toggleUnorderedList(); matched = true }
      else if (line === '1.') { editorRef.current?.toggleOrderedList(); matched = true }
      else if (line === '>') { editorRef.current?.toggleBlockQuote(); matched = true }
      else if (line === '[]' || line === '[ ]') { editorRef.current?.toggleCheckboxList(false); matched = true }
      else if (line === '[x]' || line === '[X]') { editorRef.current?.toggleCheckboxList(true); matched = true }
      else if (line === '```' && lastChar === '\n') { editorRef.current?.toggleCodeBlock(); matched = true }

      if (matched) {
        // Remove the markdown prefix from the HTML content after toggle takes effect
        const prefix = line + (lastChar === ' ' ? ' ' : '\n')
        requestAnimationFrame(async () => {
          try {
            if (!editorRef.current) return
            const html = await editorRef.current.getHTML()
            // The prefix text is now inside the formatted element (e.g. <h1># text</h1>).
            // Remove the first occurrence of the prefix (plain text, not HTML-escaped).
            const cleaned = html.replace(line, '')
            if (cleaned !== html) {
              editorRef.current.setValue(cleaned)
            }
          } catch { /* ignore */ }
        })
      }

      // Trigger debounced sync
      debouncedSync()
    },
    [debouncedSync],
  )

  // ---------- Event handlers ----------

  const handleBlur = useCallback(async () => {
    focusedRef.current = false
    setFocused(false)
    await mergeAndSave()
  }, [mergeAndSave])

  const handleFocus = useCallback(() => {
    focusedRef.current = true
    setFocused(true)
  }, [])

  // Dismiss keyboard when tapping outside — subscribe to keyboard hide event
  // so EnrichedTextInput (native Fabric) properly syncs its focused state
  React.useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (editorRef.current) {
        editorRef.current.blur()
        focusedRef.current = false
        setFocused(false)
      }
    })
    return () => sub.remove()
  }, [])

  const handleChangeState = useCallback(
    (e: NativeSyntheticEvent<StyleState>) => setStyleState(e.nativeEvent),
    [],
  )

  const handleChangeSelection = useCallback(
    (e: NativeSyntheticEvent<{ start: number; end: number; text: string }>) => {
      selectionRef.current = e.nativeEvent
      // Clear link context when cursor leaves a link
      if (!styleState?.link.isActive) setCurrentLink(null)
    },
    [styleState],
  )

  const handleLinkDetected = useCallback(
    (e: { text: string; url: string; start: number; end: number }) => {
      setCurrentLink(e)
    },
    [],
  )

  // ---------- Insertion + link actions (image, paste, table, link) ----------

  const {
    handleInsertImage,
    handlePasteImages,
    handleInsertTable,
    handleTableChange,
    handleInsertLink,
  } = useRichTextActions({
    editorRef,
    contentBlocksRef,
    selectionRef,
    localDB,
    tables,
    setTables,
    currentLink,
    setCurrentLink,
    debouncedSync,
  })

  // ---------- Mention state ----------

  const [mentionVisible, setMentionVisible] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')

  const handleStartMention = useCallback((_indicator: string) => {
    setMentionVisible(true)
    setMentionSearch('')
  }, [])

  const handleChangeMention = useCallback(
    (e: { indicator: string; text: string }) => setMentionSearch(e.text),
    [],
  )

  const handleEndMention = useCallback((_indicator: string) => {
    setMentionVisible(false)
    setMentionSearch('')
  }, [])

  const handleInsertMention = useCallback(() => {
    // Programmatically start a mention via the ref
    editorRef.current?.startMention('@')
  }, [])

  const handleSelectMention = useCallback(
    (doc: { id: string; title: string; collection: string }) => {
      editorRef.current?.setMention('@', doc.title, {
        collection: doc.collection,
        id: doc.id,
      })
      setMentionVisible(false)
    },
    [],
  )

  const handleDismissMention = useCallback(() => {
    setMentionVisible(false)
    setMentionSearch('')
  }, [])

  const isDisabled = disabled || field.admin?.readOnly

  // HtmlStyle customization matching app theme — follows the system scheme
  const htmlStyle = useMemo(
    () => ({
      h1: { fontSize: 28, bold: true },
      h2: { fontSize: 22, bold: true },
      h3: { fontSize: 18, bold: true },
      blockquote: { borderColor: rtColors.border, borderWidth: 3, gapWidth: 12 },
      codeblock: { backgroundColor: '#1e1e2e', color: '#cdd6f4', borderRadius: 8 },
      code: {
        backgroundColor: isDarkScheme ? 'rgba(255,255,255,0.12)' : '#f0f0f0',
        color: isDarkScheme ? '#f38ba8' : '#e11d48',
      },
      a: { color: isDarkScheme ? '#6db2ff' : t.colors.primary },
      mention: {
        '@': {
          color: isDarkScheme ? '#6db2ff' : t.colors.primary,
          backgroundColor: isDarkScheme ? 'rgba(10,132,255,0.20)' : `${t.colors.primary}20`,
          textDecorationLine: 'none' as const,
        },
      },
    }),
    [isDarkScheme, rtColors],
  )

  return {
    editorRef,
    rtColors,
    focused,
    styleState,
    tables,
    defaultHtml,
    isDisabled,
    htmlStyle,
    mentionVisible,
    mentionSearch,
    handleChangeText,
    handleInsertImage,
    handlePasteImages,
    handleInsertTable,
    handleTableChange,
    handleBlur,
    handleFocus,
    handleChangeState,
    handleChangeSelection,
    handleLinkDetected,
    handleInsertLink,
    handleStartMention,
    handleChangeMention,
    handleEndMention,
    handleInsertMention,
    handleSelectMention,
    handleDismissMention,
  }
}
