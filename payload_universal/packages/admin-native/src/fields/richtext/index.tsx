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
import React from 'react'

import type { ClientRichTextField, FieldComponentProps } from '../../types'
import { enrichedAvailable } from './enriched'
import { RichTextErrorBoundary } from './components/RichTextErrorBoundary'
import { RichTextFieldEnriched } from './components/RichTextFieldEnriched'
import { RichTextFieldFallback } from './components/RichTextFieldFallback'

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
