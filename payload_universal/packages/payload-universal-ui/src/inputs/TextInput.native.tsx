/**
 * TextInput — Native implementation.
 * Wraps React Native TextInput with FieldShell styling.
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
  name?: string
  type?: string
  autoComplete?: string
  className?: string
  style?: any
}

export const TextInput: React.FC<Props> = ({
  value = '',
  onChange,
  onChangeText,
  path,
  label,
  placeholder,
  required,
  disabled,
  readOnly,
  error,
  description,
  name,
  type,
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
      style={styles.input}
      placeholderTextColor={t.colors.textPlaceholder}
      secureTextEntry={type === 'password'}
      keyboardType={type === 'email' ? 'email-address' : type === 'number' ? 'numeric' : 'default'}
      autoCapitalize={type === 'email' ? 'none' : 'sentences'}
    />
  )

  if (label) {
    return (
      <FieldShell label={label} required={required} error={error} description={description}>
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
    flex: 1,
    paddingVertical: 0,
  },
})
