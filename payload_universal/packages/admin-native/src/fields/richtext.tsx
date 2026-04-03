/**
 * RichText field — full EnrichedTextInput integration with formatting toolbar.
 *
 * Uses react-native-enriched for native rich text editing on iOS/Android.
 * Converts between Payload's Lexical JSON and enriched's HTML format.
 * Falls back to a plain-text TextInput when react-native-enriched is absent.
 *
 * Flow:
 *   1. Mount: lexicalToHtml(value) → set as defaultValue on EnrichedTextInput
 *   2. Live: onChangeState feeds the RichTextToolbar active-state indicators
 *   3. Blur/save: ref.getHTML() → htmlToLexical(html) → onChange(lexicalJson)
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
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeSyntheticEvent } from 'react-native'

import type { ClientRichTextField, FieldComponentProps } from '../types'
import { defaultTheme as t } from '../theme'
import { getFieldDescription, getFieldLabel } from '../utils/schemaHelpers'
import { FieldShell } from './shared'
import { RichTextToolbar, type StyleState } from './RichTextToolbar'
import { MentionPicker } from './MentionPicker'

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
  // { interfaceOnly: true }). The Codegen Babel plugin should transform this
  // into an inline JS view config, but it crashes on RN 0.83 + @babel/traverse
  // 7.29. The fallback codegenNativeComponent function works IF all react-native
  // deep imports (codegenNativeComponent, requireNativeComponent, ViewConfigRegistry)
  // resolve to the SAME physical copy. Metro's singleton resolver in metro.config.js
  // ensures this by pinning 'react-native' and 'react-native/*' to the app's copy.
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

try {
  const mod = require('../utils/lexicalToHtml')
  lexicalToHtml = mod.lexicalToHtml ?? mod.default ?? lexicalToHtml
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

  // ---------- Convert initial value once ----------
  const defaultHtml = useMemo(() => {
    if (!value) return ''
    try { return lexicalToHtml(value) } catch { return '' }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Debounced onChange sync ----------
  const debouncedSync = useDebouncedCallback(async () => {
    if (!editorRef.current) return
    try {
      const html = await editorRef.current.getHTML()
      const lexical = htmlToLexical(html)
      if (lexical) onChange(lexical)
    } catch { /* ignore */ }
  }, 600)

  // ---------- Event handlers ----------

  const handleBlur = useCallback(async () => {
    setFocused(false)
    if (!editorRef.current) return
    try {
      const html = await editorRef.current.getHTML()
      const lexical = htmlToLexical(html)
      if (lexical) onChange(lexical)
    } catch { /* ignore */ }
  }, [onChange])

  const handleFocus = useCallback(() => setFocused(true), [])

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

  // HtmlStyle customization matching app theme
  const htmlStyle = useMemo(
    () => ({
      h1: { fontSize: 28, bold: true },
      h2: { fontSize: 22, bold: true },
      h3: { fontSize: 18, bold: true },
      blockquote: { borderColor: t.colors.border, borderWidth: 3, gapWidth: 12 },
      codeblock: { backgroundColor: '#1e1e2e', color: '#cdd6f4', borderRadius: 8 },
      code: { backgroundColor: '#f0f0f0', color: '#e11d48' },
      a: { color: t.colors.primary },
      mention: {
        '@': {
          color: t.colors.primary,
          backgroundColor: `${t.colors.primary}20`,
          textDecorationLine: 'none' as const,
        },
      },
    }),
    [],
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
        onInsertMention={handleInsertMention}
        visible={focused}
      />

      <View
        style={[
          styles.editorContainer,
          isDisabled && styles.editorDisabled,
          error && styles.editorError,
        ]}
      >
        <EnrichedTextInput
          ref={editorRef}
          defaultValue={defaultHtml}
          placeholder="Start writing..."
          placeholderTextColor={t.colors.textPlaceholder}
          editable={!isDisabled}
          scrollEnabled
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeState={handleChangeState}
          onChangeSelection={handleChangeSelection}
          onLinkDetected={handleLinkDetected}
          mentionIndicators={['@']}
          onStartMention={handleStartMention}
          onChangeMention={handleChangeMention}
          onEndMention={handleEndMention}
          htmlStyle={htmlStyle}
          style={styles.editor}
          contextMenuItems={[
            {
              text: 'Mention Document',
              onPress: () => editorRef.current?.startMention('@'),
              visible: true,
            },
          ]}
        />
      </View>

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
  if (typeof value === 'string') return value
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
  const plainText = richTextToPlain(value)
  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
      layout="stacked"
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Rich Text (plain-text editing mode)</Text>
      </View>
      <TextInput
        style={[
          styles.fallbackInput,
          disabled && styles.editorDisabled,
          error && styles.editorError,
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
        placeholderTextColor={t.colors.textPlaceholder}
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
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.surface,
    minHeight: 160,
    overflow: 'hidden',
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
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    fontSize: t.fontSize.md,
    color: t.colors.text,
    backgroundColor: t.colors.surface,
    minHeight: 140,
  },
})
