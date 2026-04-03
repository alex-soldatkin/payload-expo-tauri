/**
 * TextareaInput — Native implementation.
 * Multiline TextInput with stacked FieldShell layout.
 */
import React from 'react'
import { TextInput as RNTextInput, StyleSheet } from 'react-native'
import { FieldShell } from '@payload-universal/admin-native/fields'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Props = {
  value?: string
  onChange?: (e: { target: { value: string } }) => void
  onChangeText?: (text: string) => void
  path?: string
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  error?: string
  description?: string
  rows?: number
  className?: string
  style?: any
}

export const TextareaInput: React.FC<Props> = ({
  value = '',
  onChange,
  onChangeText,
  label,
  placeholder,
  required,
  disabled,
  readOnly,
  error,
  description,
  rows = 4,
}) => {
  const handleChange = (text: string) => {
    onChangeText?.(text)
    onChange?.({ target: { value: text } })
  }

  const content = (
    <RNTextInput
      value={String(value ?? '')}
      onChangeText={handleChange}
      placeholder={placeholder}
      editable={!disabled && !readOnly}
      multiline
      numberOfLines={rows}
      style={[styles.input, { minHeight: rows * 20 }]}
      placeholderTextColor={t.colors.textPlaceholder}
      textAlignVertical="top"
    />
  )

  if (label) {
    return (
      <FieldShell label={label} required={required} error={error} description={description} layout="stacked">
        {content}
      </FieldShell>
    )
  }

  return content
}

const styles = StyleSheet.create({
  input: {
    fontSize: t.fontSize.md,
    color: t.colors.text,
    paddingVertical: 4,
  },
})
