/**
 * Textarea field (stacked — multiline, auto-grows up to ~40% of the screen).
 *
 * Keeps a subtle filled rounded-8 background WITHOUT borders. Vertical padding
 * lives on a WRAPPER View, never on the TextInput itself — see TEXTAREA_V_PAD
 * for why (the measured content size must stay in the same coordinate space as
 * the applied height, or auto-grow loops).
 */
import React, { useState } from 'react'
import { TextInput, useWindowDimensions, View } from 'react-native'

import type { ClientTextareaField, FieldComponentProps } from '../../types'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { FieldShell } from '../shared'
import { useInputColors } from './colors'
import { styles, TEXTAREA_LINE_HEIGHT, TEXTAREA_V_PAD } from './styles'

export const TextareaField: React.FC<FieldComponentProps<ClientTextareaField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const c = useInputColors()
  const { height: screenHeight } = useWindowDimensions()

  const adminRows = (field.admin as { rows?: number } | undefined)?.rows
  // Bounds in TEXT-CONTENT space (padding excluded) — the same space the
  // (zero-padding) input's onContentSizeChange reports in.
  const minContentHeight = adminRows != null
    ? Math.max(44 - TEXTAREA_V_PAD * 2, adminRows * TEXTAREA_LINE_HEIGHT)
    : 100 - TEXTAREA_V_PAD * 2
  const maxContentHeight = Math.max(
    minContentHeight,
    Math.round(screenHeight * 0.4) - TEXTAREA_V_PAD * 2,
  )

  const [contentHeight, setContentHeight] = useState(minContentHeight)
  // Re-clamp at render time too — rotation can shrink maxContentHeight after
  // a larger value was stored.
  const height = Math.min(Math.max(contentHeight, minContentHeight), maxContentHeight)
  const atMax = height >= maxContentHeight

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      <View style={[styles.multilineWrapper, { backgroundColor: c.fill }]}>
        <TextInput
          style={[styles.multilineInput, { color: c.text, height }, disabled && styles.disabled]}
          value={value != null ? String(value) : ''}
          onChangeText={(v) => onChange(v)}
          onContentSizeChange={(e) => {
            // Clamp BEFORE storing (the stored value can never exceed the
            // cap), and ignore ≤2px deltas: iOS echoes bounds-derived
            // contentSize after we apply a height, Android rounds through
            // density/font padding — neither may re-trigger a set.
            const next = Math.min(
              Math.max(e.nativeEvent.contentSize.height, minContentHeight),
              maxContentHeight,
            )
            setContentHeight((prev) => (Math.abs(next - prev) > 2 ? next : prev))
          }}
          placeholder={field.admin?.placeholder}
          placeholderTextColor={c.textPlaceholder}
          editable={!disabled && !field.admin?.readOnly}
          maxLength={field.maxLength}
          multiline
          scrollEnabled={atMax}
          textAlignVertical="top"
        />
      </View>
    </FieldShell>
  )
}
