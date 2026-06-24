import React from 'react'
import { Text, TextInput, View } from 'react-native'

import type { ClientRichTextField, FieldComponentProps } from '../../../types'
import { getFieldDescription, getFieldLabel } from '../../../utils/schemaHelpers'
import { useListColors } from '../../../hooks/useListColors'
import { FieldShell } from '../../shared'
import { richTextToPlain } from '../richTextToPlain'
import { styles } from '../styles'

// ---------------------------------------------------------------------------
// Plain-text fallback (when react-native-enriched is not installed)
// ---------------------------------------------------------------------------

export const RichTextFieldFallback: React.FC<FieldComponentProps<ClientRichTextField>> = ({
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
