/**
 * Code field (stacked — monospaced with a line-number gutter and h-scroll).
 *
 * Filled rounded-8 box, NO border (row contract); the gutter's extra fill
 * stacks on the box fill for a subtly darker line-number strip. Lines never
 * wrap → gutter rows stay aligned and long lines scroll horizontally.
 */
import React, { useMemo, useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'

import type { ClientCodeField, FieldComponentProps } from '../../types'
import { defaultTheme as t } from '../../theme'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { FieldShell } from '../shared'
import { useInputColors } from './colors'
import { CODE_CHAR_WIDTH, styles } from './styles'

export const CodeField: React.FC<FieldComponentProps<ClientCodeField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const c = useInputColors()
  const [availableWidth, setAvailableWidth] = useState(0)
  const text = value != null ? String(value) : ''

  const lineCount = useMemo(() => Math.max(text.split('\n').length, 1), [text])
  const longestLine = useMemo(
    () => text.split('\n').reduce((m, line) => Math.max(m, line.length), 0),
    [text],
  )
  const gutterNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1).join('\n'),
    [lineCount],
  )
  // Wide enough that lines never wrap → gutter rows stay aligned and long
  // lines scroll horizontally.
  const contentWidth = Math.max(availableWidth, longestLine * CODE_CHAR_WIDTH + t.spacing.xl)

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      {/* Filled rounded-8 box, NO border (row contract); the gutter's extra
          fill stacks on the box fill for a subtly darker line-number strip. */}
      <View style={[styles.codeContainer, { backgroundColor: c.fill }]}>
        <Text style={[styles.codeGutter, { color: c.textPlaceholder, backgroundColor: c.fill }]}>
          {gutterNumbers}
        </Text>
        <ScrollView
          horizontal
          bounces={false}
          keyboardShouldPersistTaps="handled"
          style={styles.codeScroll}
          onLayout={(e) => {
            // Guard against fractional re-layout jitter feeding a render loop
            // (measured width → contentWidth → layout → measured width).
            const w = e.nativeEvent.layout.width
            setAvailableWidth((prev) => (Math.abs(w - prev) > 1 ? w : prev))
          }}
        >
          <TextInput
            style={[styles.codeInput, { color: c.text, width: contentWidth }, disabled && styles.disabled]}
            value={text}
            onChangeText={(v) => onChange(v)}
            placeholder={field.admin?.placeholder}
            placeholderTextColor={c.textPlaceholder}
            editable={!disabled && !field.admin?.readOnly}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </ScrollView>
      </View>
    </FieldShell>
  )
}
