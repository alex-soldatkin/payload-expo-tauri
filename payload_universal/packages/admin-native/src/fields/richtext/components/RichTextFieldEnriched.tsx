import React from 'react'
import { View } from 'react-native'

import type { ClientRichTextField, FieldComponentProps } from '../../../types'
import { getFieldDescription, getFieldLabel } from '../../../utils/schemaHelpers'
import { FieldShell } from '../../shared'
import { RichTextToolbar } from '../../RichTextToolbar'
import { MentionPicker } from '../../MentionPicker'
import { TableEditor } from '../../TableEditor'
import { EditorGlassView, editorGlassAvailable } from '../optional'
import { EnrichedTextInput } from '../enriched'
import { wrapEditorHtml } from '../converters'
import { styles } from '../styles'
import { useRichTextEditor } from '../hooks/useRichTextEditor'

// ---------------------------------------------------------------------------
// EnrichedTextInput-powered RichText field
// ---------------------------------------------------------------------------

export const RichTextFieldEnriched: React.FC<FieldComponentProps<ClientRichTextField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const {
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
  } = useRichTextEditor({ field, value, onChange, disabled })

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
