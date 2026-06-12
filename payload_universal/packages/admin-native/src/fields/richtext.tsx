/**
 * RichText field — full EnrichedTextInput integration with formatting toolbar.
 *
 * Uses react-native-enriched for native rich text editing on iOS/Android.
 * Converts between Payload's Lexical JSON and enriched's HTML format.
 * Falls back to a plain-text TextInput when react-native-enriched is absent.
 *
 * Flow:
 *   1. Mount: lexicalToHtml(value) → wrapEditorHtml(...) → defaultValue on
 *      EnrichedTextInput. The <html>...</html> wrapper is REQUIRED: both
 *      native implementations only parse HTML when the string starts with
 *      <html> and ends with </html> — bare fragments are inserted as plain
 *      text (raw HTML source shows up in the editor).
 *   2. Live: onChangeState feeds the RichTextToolbar active-state indicators
 *   3. Blur/save: ref.getHTML() → htmlToLexical(html) → onChange(lexicalJson)
 *   4. External updates (WS sync / form reset): the editor is uncontrolled,
 *      so late-arriving values are pushed via ref.setValue — only when they
 *      didn't originate from this editor's own onChange round-trip
 *      (lastFormValueRef pattern, mirroring inputs/textBridge.ts) and the
 *      editor isn't focused.
 *
 * Value normalization: the form value may arrive as a Lexical JSON object
 * (normal Payload shape), a JSON-stringified editor state, or a raw HTML /
 * plain-text string — all are accepted (see normalizeRichTextValue).
 *
 * Markdown shortcuts (Notion-style):
 *   - Typing `# ` / `## ` / `### ` toggles headings
 *   - `- ` or `* ` toggles unordered list; `1. ` toggles ordered list
 *   - `> ` toggles blockquote; ``` `` ` ``` + newline toggles code block
 *   - `[] ` / `[ ] ` toggles unchecked checkbox; `[x] ` toggles checked
 *   - After toggling, the markdown prefix is removed from the HTML content
 *
 * Image support:
 *   - Toolbar ImagePlus button / context menu: ActionSheet → camera or library
 *   - onPasteImages handles pasted images from clipboard
 *   - Images are inserted via ref.setImage(uri, w, h)
 *   - Optional background upload via local-db uploadQueue
 *
 * Mention support:
 *   - mentionIndicators={['@']} triggers mention lifecycle events
 *   - MentionPicker queries all user-facing collections from local RxDB
 *   - Selection calls ref.setMention('@', title, { collection, id })
 *
 * Link support:
 *   - Toolbar Link button opens Alert.prompt for URL entry
 *   - onLinkDetected populates existing URL; onChangeSelection tracks range
 */
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { ActionSheetIOS, Alert, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeSyntheticEvent } from 'react-native'

import type { ClientRichTextField, FieldComponentProps } from '../types'
import { defaultTheme as t } from '../theme'
import { getFieldDescription, getFieldLabel } from '../utils/schemaHelpers'
import { FieldShell } from './shared'
import { RichTextToolbar, type StyleState } from './RichTextToolbar'
import { MentionPicker } from './MentionPicker'
import { TableEditor, createEmptyTable, type TableNode } from './TableEditor'
import { useListColors } from '../hooks/useListColors'

// Optional: GlassView for the editor container (iOS 26+)
let EditorGlassView: React.ComponentType<any> | null = null
let editorGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  EditorGlassView = glassModule.GlassView
  editorGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch { /* not available */ }

// Optional: expo-image-picker for inline image insertion
let ImagePicker: typeof import('expo-image-picker') | null = null
try {
  ImagePicker = require('expo-image-picker')
} catch { /* not available */ }

// Optional: local-db upload queue for background image uploads
let _useLocalDB: (() => any) | null = null
try {
  _useLocalDB = require('@payload-universal/local-db').useLocalDB
} catch { /* local-db not available */ }

// ---------------------------------------------------------------------------
// Optional EnrichedTextInput — try/catch for graceful fallback
// ---------------------------------------------------------------------------

let EnrichedTextInput: any = null

/** Matches the EnrichedTextInputInstance ref from react-native-enriched */
type EditorRef = {
  focus: () => void
  blur: () => void
  getHTML: () => Promise<string>
  setValue: (value: string) => void
  setSelection: (start: number, end: number) => void
  toggleBold: () => void
  toggleItalic: () => void
  toggleUnderline: () => void
  toggleStrikeThrough: () => void
  toggleInlineCode: () => void
  toggleH1: () => void
  toggleH2: () => void
  toggleH3: () => void
  toggleBlockQuote: () => void
  toggleCodeBlock: () => void
  toggleOrderedList: () => void
  toggleUnorderedList: () => void
  toggleCheckboxList: (checked: boolean) => void
  setLink: (start: number, end: number, text: string, url: string) => void
  removeLink: (start: number, end: number) => void
  startMention: (indicator: string) => void
  setMention: (indicator: string, text: string, attributes?: Record<string, string>) => void
  setImage: (src: string, width: number, height: number) => void
}

let enrichedAvailable = false
try {
  // react-native-enriched uses codegenNativeComponent('EnrichedTextInputView',
  // { interfaceOnly: true }). Two problems prevent it from working out of the box:
  //
  // 1. The Codegen Babel plugin (@react-native/babel-plugin-codegen) should
  //    transform this into an inline JS view config at bundle time, but it
  //    crashed on RN 0.83 + @babel/traverse 7.29 (SDK 55 canary era).
  //
  // 2. The fallback codegenNativeComponent function calls requireNativeComponent
  //    → getNativeComponentAttributes → UIManager.getViewManagerConfig. In
  //    Bridgeless mode, getViewManagerConfig returns null for interfaceOnly
  //    components (no Paper ViewManager). The lazy view config callback then
  //    returns null → invariant violation at render time.
  //
  // Fix: patch UIManager.getViewManagerConfig to return a valid config for
  // EnrichedTextInputView. Metro's singleton resolver (metro.config.js) ensures
  // all react-native/* imports resolve to one copy, so this patch is seen by
  // both the registration and the renderer.
  //
  // RN 0.85 / SDK 56 (2026-06-12): kept intentionally. Even if the babel
  // codegen crash (#1) is fixed in 0.85, the Bridgeless null-view-config
  // fallback (#2) is a runtime path that only an on-device repro can rule
  // out. The patch is additive (only intercepts EnrichedTextInputView) and
  // harmless when the codegen transform works. Re-test removal on a new
  // SDK 56 dev build before deleting.
  const { UIManager } = require('react-native')
  const origGetConfig = UIManager.getViewManagerConfig
  if (origGetConfig) {
    UIManager.getViewManagerConfig = (name: string) => {
      if (name === 'EnrichedTextInputView') {
        return {
          Commands: {
            focus: 0, blur: 1, setValue: 2, setSelection: 3,
            toggleBold: 4, toggleItalic: 5, toggleUnderline: 6,
            toggleStrikeThrough: 7, toggleInlineCode: 8,
            toggleH1: 9, toggleH2: 10, toggleH3: 11, toggleH4: 12,
            toggleH5: 13, toggleH6: 14, toggleCodeBlock: 15,
            toggleBlockQuote: 16, toggleOrderedList: 17,
            toggleUnorderedList: 18, toggleCheckboxList: 19,
            addLink: 20, removeLink: 21, addImage: 22,
            startMention: 23, addMention: 24, requestHTML: 25,
          },
          NativeProps: {
            autoFocus: 'boolean', editable: 'boolean', defaultValue: 'string',
            placeholder: 'string', placeholderTextColor: 'Color',
            mentionIndicators: 'Array', cursorColor: 'Color',
            selectionColor: 'Color', autoCapitalize: 'string',
            htmlStyle: 'Map', scrollEnabled: 'boolean', linkRegex: 'Map',
            contextMenuItems: 'Array', returnKeyType: 'string',
            returnKeyLabel: 'string', submitBehavior: 'string',
            color: 'Color', fontSize: 'float', lineHeight: 'float',
            fontFamily: 'string', fontWeight: 'string', fontStyle: 'string',
            isOnChangeHtmlSet: 'boolean', isOnChangeTextSet: 'boolean',
            androidExperimentalSynchronousEvents: 'boolean',
            useHtmlNormalizer: 'boolean',
          },
        }
      }
      return origGetConfig.call(UIManager, name)
    }
  }

  const enrichedModule = require('react-native-enriched')
  EnrichedTextInput = enrichedModule.EnrichedTextInput
  enrichedAvailable = !!EnrichedTextInput
} catch (e) {
  console.log('[richtext] react-native-enriched not available:', String(e).slice(0, 120))
}

// ---------------------------------------------------------------------------
// Lazy converter imports
// ---------------------------------------------------------------------------

let lexicalToHtml: (value: unknown) => string = () => ''
let htmlToLexical: (html: string) => unknown = () => ({
  root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 },
})
/** Wrap editor HTML in the <html>...</html> envelope react-native-enriched requires. */
let wrapEditorHtml: (html: string) => string = (html) => (html ? `<html>\n${html}\n</html>` : '')

try {
  const mod = require('../utils/lexicalToHtml')
  lexicalToHtml = mod.lexicalToHtml ?? mod.default ?? lexicalToHtml
  wrapEditorHtml = mod.wrapEditorHtml ?? wrapEditorHtml
} catch { /* converter not available yet */ }

try {
  const mod = require('../utils/htmlToLexical')
  htmlToLexical = mod.htmlToLexical ?? mod.default ?? htmlToLexical
} catch { /* converter not available yet */ }

// ---------------------------------------------------------------------------
// Debounce helper
// ---------------------------------------------------------------------------

function useDebouncedCallback<T extends (...args: any[]) => void>(cb: T, delay: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(cb)
  latest.current = cb
  return useCallback(
    ((...args: any[]) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => latest.current(...args), delay)
    }) as unknown as T,
    [delay],
  )
}

// ---------------------------------------------------------------------------
// Value normalization + content preparation
// ---------------------------------------------------------------------------

// EnrichedTextInput can't render <table>. We extract tables from the Lexical
// tree and render them as separate TableEditor components.
type ContentBlock =
  | { type: 'text'; nodes: any[] }
  | { type: 'table'; index: number; node: TableNode }

interface PreparedContent {
  blocks: ContentBlock[]
  tables: TableNode[]
  /** Editor HTML for the non-table content (NOT yet <html>-wrapped). */
  html: string
}

const escapeInlineText = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Serialized form of the value, used to detect external changes. */
const serializeValue = (v: unknown): string => {
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
function normalizeRichTextValue(
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
function splitBlocks(state: unknown): { blocks: ContentBlock[]; tables: TableNode[] } {
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
function prepareContent(raw: unknown): PreparedContent {
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

function prepareFromLexicalState(state: unknown): PreparedContent {
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

// ---------------------------------------------------------------------------
// EnrichedTextInput-powered RichText field
// ---------------------------------------------------------------------------

const RichTextFieldEnriched: React.FC<FieldComponentProps<ClientRichTextField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
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

  // ---------- Image insertion ----------

  const handleInsertImage = useCallback(() => {
    if (!ImagePicker) {
      Alert.alert('Unavailable', 'Image picker is not available on this device.')
      return
    }

    const insertImage = async (asset: { uri: string; width: number; height: number; fileName?: string | null; mimeType?: string | null }) => {
      editorRef.current?.setImage(asset.uri, asset.width || 300, asset.height || 200)

      // Queue background upload if local-db is available
      if (localDB?.uploadQueue) {
        try {
          await localDB.uploadQueue.enqueue({
            localUri: asset.uri,
            fileName: asset.fileName || `image-${Date.now()}.jpg`,
            mimeType: asset.mimeType || 'image/jpeg',
            targetCollection: 'media',
          })
        } catch { /* queue not available */ }
      }

      debouncedSync()
    }

    const pickFromLibrary = async () => {
      try {
        const { status } = await ImagePicker!.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Permission to access media library was denied.')
          return
        }
        const result = await ImagePicker!.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        })
        if (result.canceled || !result.assets?.[0]) return
        const asset = result.assets[0]
        await insertImage(asset)
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to pick image')
      }
    }

    const takePhoto = async () => {
      try {
        const { status } = await ImagePicker!.requestCameraPermissionsAsync()
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Permission to access camera was denied.')
          return
        }
        const result = await ImagePicker!.launchCameraAsync({ quality: 0.8 })
        if (result.canceled || !result.assets?.[0]) return
        const asset = result.assets[0]
        await insertImage(asset)
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to take photo')
      }
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Take Photo', 'Choose from Library', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) takePhoto()
          else if (buttonIndex === 1) pickFromLibrary()
        },
      )
    } else {
      // Android: use Alert as action sheet
      Alert.alert('Insert Image', '', [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ])
    }
  }, [localDB, debouncedSync])

  // ---------- Paste images handler ----------

  const handlePasteImages = useCallback(
    (e: NativeSyntheticEvent<{ images: Array<{ uri: string; width: number; height: number }> }>) => {
      const images = e.nativeEvent.images
      if (!images?.length) return
      for (const img of images) {
        editorRef.current?.setImage(img.uri, img.width || 300, img.height || 200)

        // Queue background upload
        if (localDB?.uploadQueue) {
          localDB.uploadQueue.enqueue({
            localUri: img.uri,
            fileName: `paste-${Date.now()}.jpg`,
            mimeType: 'image/jpeg',
            targetCollection: 'media',
          }).catch(() => {})
        }
      }
      debouncedSync()
    },
    [localDB, debouncedSync],
  )

  // ---------- Table insertion ----------

  const handleInsertTable = useCallback(() => {
    Alert.prompt(
      'Insert Table',
      'Enter rows × columns (e.g. 3x4):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Insert',
          onPress: (input?: string) => {
            const match = input?.match(/(\d+)\s*[x×X]\s*(\d+)/)
            if (!match) return
            const rows = Math.max(1, Math.min(20, parseInt(match[1], 10)))
            const cols = Math.max(1, Math.min(10, parseInt(match[2], 10)))
            const newTable = createEmptyTable(rows, cols)
            setTables((prev) => [...prev, newTable])
            // Add a table block at the end of the content blocks
            contentBlocksRef.current.push({ type: 'table', index: tables.length, node: newTable })
            debouncedSync()
          },
        },
      ],
      'plain-text',
      '3x3',
    )
  }, [tables, debouncedSync])

  const handleTableChange = useCallback((index: number, newData: TableNode) => {
    setTables((prev) => {
      const next = [...prev]
      next[index] = newData
      return next
    })
    debouncedSync()
  }, [debouncedSync])

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

  // ---------- Toolbar: Link insertion ----------

  const handleInsertLink = useCallback(() => {
    const sel = selectionRef.current
    const existingUrl = currentLink?.url ?? ''

    if (Platform.OS === 'ios') {
      Alert.prompt(
        currentLink ? 'Edit Link' : 'Insert Link',
        'Enter the URL:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: currentLink ? 'Update' : 'Insert',
            onPress: (url?: string) => {
              if (!url || !editorRef.current) return
              if (currentLink) {
                editorRef.current.setLink(
                  currentLink.start, currentLink.end, currentLink.text, url,
                )
              } else {
                const text = sel.text || url
                editorRef.current.setLink(sel.start, sel.end, text, url)
              }
            },
          },
          ...(currentLink
            ? [{
                text: 'Remove',
                style: 'destructive' as const,
                onPress: () => {
                  if (currentLink && editorRef.current) {
                    editorRef.current.removeLink(currentLink.start, currentLink.end)
                  }
                  setCurrentLink(null)
                },
              }]
            : []),
        ],
        'plain-text',
        existingUrl || 'https://',
      )
    } else {
      // Android: simple prompt fallback
      Alert.alert('Insert Link', 'Enter URL', [
        { text: 'Cancel' },
        {
          text: 'OK',
          onPress: () => {
            const url = existingUrl || 'https://'
            const text = sel.text || url
            editorRef.current?.setLink(sel.start, sel.end, text, url)
          },
        },
      ])
    }
  }, [currentLink])

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

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
      layout="stacked"
    >
      <RichTextToolbar
        styleState={styleState}
        onToggleBold={() => editorRef.current?.toggleBold()}
        onToggleItalic={() => editorRef.current?.toggleItalic()}
        onToggleUnderline={() => editorRef.current?.toggleUnderline()}
        onToggleStrikeThrough={() => editorRef.current?.toggleStrikeThrough()}
        onToggleInlineCode={() => editorRef.current?.toggleInlineCode()}
        onToggleH1={() => editorRef.current?.toggleH1()}
        onToggleH2={() => editorRef.current?.toggleH2()}
        onToggleH3={() => editorRef.current?.toggleH3()}
        onToggleBlockQuote={() => editorRef.current?.toggleBlockQuote()}
        onToggleCodeBlock={() => editorRef.current?.toggleCodeBlock()}
        onToggleOrderedList={() => editorRef.current?.toggleOrderedList()}
        onToggleUnorderedList={() => editorRef.current?.toggleUnorderedList()}
        onToggleCheckboxList={() => editorRef.current?.toggleCheckboxList(false)}
        onInsertLink={handleInsertLink}
        onInsertImage={handleInsertImage}
        onInsertTable={handleInsertTable}
        onInsertMention={handleInsertMention}
        visible={focused}
      />

      {(() => {
        const editorElement = (
          <EnrichedTextInput
            ref={editorRef}
            defaultValue={wrapEditorHtml(defaultHtml)}
            placeholder="Start writing..."
            placeholderTextColor={rtColors.textPlaceholder}
            editable={!isDisabled}
            scrollEnabled
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChangeText={handleChangeText}
            onChangeState={handleChangeState}
            onChangeSelection={handleChangeSelection}
            onLinkDetected={handleLinkDetected}
            onPasteImages={handlePasteImages}
            mentionIndicators={['@']}
            onStartMention={handleStartMention}
            onChangeMention={handleChangeMention}
            onEndMention={handleEndMention}
            htmlStyle={htmlStyle}
            style={[styles.editor, { color: rtColors.text }]}
            contextMenuItems={[
              // Inline formatting — appear in text selection context menu
              { text: 'Bold', onPress: () => editorRef.current?.toggleBold(), visible: true },
              { text: 'Italic', onPress: () => editorRef.current?.toggleItalic(), visible: true },
              { text: 'Underline', onPress: () => editorRef.current?.toggleUnderline(), visible: true },
              { text: 'Strikethrough', onPress: () => editorRef.current?.toggleStrikeThrough(), visible: true },
              { text: 'Code', onPress: () => editorRef.current?.toggleInlineCode(), visible: true },
              // Block formatting
              { text: 'Heading 1', onPress: () => editorRef.current?.toggleH1(), visible: true },
              { text: 'Heading 2', onPress: () => editorRef.current?.toggleH2(), visible: true },
              { text: 'Heading 3', onPress: () => editorRef.current?.toggleH3(), visible: true },
              { text: 'Quote', onPress: () => editorRef.current?.toggleBlockQuote(), visible: true },
              { text: 'Code Block', onPress: () => editorRef.current?.toggleCodeBlock(), visible: true },
              { text: 'Bullet List', onPress: () => editorRef.current?.toggleUnorderedList(), visible: true },
              { text: 'Numbered List', onPress: () => editorRef.current?.toggleOrderedList(), visible: true },
              { text: 'Checklist', onPress: () => editorRef.current?.toggleCheckboxList(false), visible: true },
              // Insert actions
              { text: 'Insert Link', onPress: () => handleInsertLink(), visible: true },
              { text: 'Insert Image', onPress: () => handleInsertImage(), visible: true },
              { text: 'Insert Table', onPress: () => handleInsertTable(), visible: true },
              { text: 'Mention Document', onPress: () => editorRef.current?.startMention('@'), visible: true },
            ]}
          />
        )

        if (editorGlassAvailable && EditorGlassView) {
          const Glass = EditorGlassView as React.ComponentType<any>
          return (
            <Glass
              style={[
                styles.editorContainerGlass,
                isDisabled && styles.editorDisabled,
                error && styles.editorError,
              ]}
              glassEffectStyle="regular"
            >
              {editorElement}
            </Glass>
          )
        }

        return (
          <View
            style={[
              styles.editorContainer,
              { backgroundColor: rtColors.card },
              isDisabled && [styles.editorDisabled, { backgroundColor: rtColors.pressed }],
            ]}
          >
            {editorElement}
          </View>
        )
      })()}

      {/* Render tables as separate native grid editors */}
      {tables.map((table, i) => (
        <View key={`table-${i}`} style={styles.tableWrapper}>
          <TableEditor
            data={table}
            onChange={(newData) => handleTableChange(i, newData)}
            disabled={isDisabled}
          />
        </View>
      ))}

      <MentionPicker
        visible={mentionVisible}
        searchText={mentionSearch}
        onSelect={handleSelectMention}
        onDismiss={handleDismissMention}
      />
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Error boundary — catches native view registration failures at render time
// and falls back to plain-text gracefully (e.g. Expo Go without native code).
// ---------------------------------------------------------------------------

class RichTextErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch() { /* logged by React */ }
  render() { return this.state.hasError ? this.props.fallback : this.props.children }
}

// ---------------------------------------------------------------------------
// Plain-text fallback (when react-native-enriched is not installed)
// ---------------------------------------------------------------------------

const richTextToPlain = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    // JSON-stringified Lexical state → recurse into the parsed object
    if (trimmed.startsWith('{')) {
      try {
        return richTextToPlain(JSON.parse(trimmed))
      } catch { /* fall through */ }
    }
    // HTML string → strip tags for plain-text editing
    if (trimmed.startsWith('<')) {
      return trimmed
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|h[1-6]|li|blockquote|div|tr)>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }
    return value
  }
  if (typeof value === 'object' && 'root' in (value as Record<string, unknown>)) {
    const extract = (node: unknown): string => {
      if (node == null) return ''
      if (typeof node === 'string') return node
      const n = node as Record<string, unknown>
      if (typeof n.text === 'string') return n.text
      if (Array.isArray(n.children)) return n.children.map(extract).join('\n')
      return ''
    }
    return extract((value as Record<string, unknown>).root)
  }
  if (Array.isArray(value)) {
    const extract = (node: unknown): string => {
      if (node == null) return ''
      const n = node as Record<string, unknown>
      if (typeof n.text === 'string') return n.text
      if (Array.isArray(n.children)) return n.children.map(extract).join('')
      return ''
    }
    return value.map(extract).join('\n')
  }
  return JSON.stringify(value, null, 2)
}

const RichTextFieldFallback: React.FC<FieldComponentProps<ClientRichTextField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const { colors: fbColors } = useListColors()
  const plainText = richTextToPlain(value)
  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
      layout="stacked"
    >
      <View style={[styles.badge, { backgroundColor: fbColors.pressed }]}>
        <Text style={[styles.badgeText, { color: fbColors.textMuted }]}>Rich Text (plain-text editing mode)</Text>
      </View>
      <TextInput
        style={[
          styles.fallbackInput,
          { backgroundColor: fbColors.card, color: fbColors.text },
          disabled && [styles.editorDisabled, { backgroundColor: fbColors.pressed }],
        ]}
        value={plainText}
        onChangeText={(text) => {
          onChange({
            root: {
              type: 'root',
              children: text.split('\n').map((line) => ({
                type: 'paragraph',
                children: [{ type: 'text', text: line }],
              })),
            },
          })
        }}
        placeholder="Start writing..."
        placeholderTextColor={fbColors.textPlaceholder}
        editable={!disabled && !field.admin?.readOnly}
        multiline
        numberOfLines={8}
        textAlignVertical="top"
      />
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Exported component — picks enriched or fallback
// ---------------------------------------------------------------------------

export const RichTextField: React.FC<FieldComponentProps<ClientRichTextField>> = (props) =>
  enrichedAvailable ? (
    <RichTextErrorBoundary fallback={<RichTextFieldFallback {...props} />}>
      <RichTextFieldEnriched {...props} />
    </RichTextErrorBoundary>
  ) : (
    <RichTextFieldFallback {...props} />
  )

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  editorContainer: {
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.surface,
    minHeight: 160,
    overflow: 'hidden',
  },
  editorContainerGlass: {
    borderRadius: 14,
    minHeight: 160,
    overflow: 'hidden',
  },
  tableWrapper: {
    marginTop: t.spacing.sm,
  },
  editor: {
    flex: 1,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    fontSize: t.fontSize.md,
    color: t.colors.text,
    minHeight: 160,
  },
  editorDisabled: { opacity: 0.5, backgroundColor: '#f9f9f9' },
  editorError: { borderColor: t.colors.error },
  badge: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: t.spacing.sm,
  },
  badgeText: { fontSize: t.fontSize.xs, color: t.colors.textMuted },
  fallbackInput: {
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    fontSize: t.fontSize.md,
    color: t.colors.text,
    backgroundColor: t.colors.surface,
    minHeight: 140,
  },
})
