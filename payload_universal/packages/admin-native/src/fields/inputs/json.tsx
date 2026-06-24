/**
 * JSON field (stacked — monospaced with a live validity indicator +
 * pretty-print). Stores the parsed object when valid; keeps the raw string
 * (and surfaces the error via the indicator) while invalid.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

import type { ClientJSONField, FieldComponentProps } from '../../types'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { FieldShell } from '../shared'
import { useInputColors } from './colors'
import { styles } from './styles'

const deriveJsonText = (value: unknown): string =>
  typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2) ?? ''

type JsonValidity = { valid: boolean; message?: string } | null

const checkJson = (text: string): JsonValidity => {
  if (!text.trim()) return null
  try {
    JSON.parse(text)
    return { valid: true }
  } catch (e) {
    return { valid: false, message: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

export const JSONField: React.FC<FieldComponentProps<ClientJSONField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const c = useInputColors()
  const [text, setText] = useState(() => deriveJsonText(value))
  const [validity, setValidity] = useState<JsonValidity>(() => checkJson(deriveJsonText(value)))
  const lastEmittedRef = useRef<unknown>(value)

  // External value change (reset / load) — re-derive the editor text.
  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value
      setText(deriveJsonText(value))
    }
  }, [value])

  // Debounced validity check.
  useEffect(() => {
    const handle = setTimeout(() => setValidity(checkJson(text)), 350)
    return () => clearTimeout(handle)
  }, [text])

  // Store the parsed object when valid; keep the raw string (and surface the
  // error via the indicator) while invalid.
  const handleChange = (raw: string) => {
    setText(raw)
    try {
      const parsed = JSON.parse(raw)
      lastEmittedRef.current = parsed
      onChange(parsed)
    } catch {
      lastEmittedRef.current = raw
      onChange(raw)
    }
  }

  const isEditable = !disabled && !field.admin?.readOnly
  const canPrettify = validity?.valid === true && isEditable

  const prettify = () => {
    try {
      const parsed = JSON.parse(text)
      const pretty = JSON.stringify(parsed, null, 2)
      setText(pretty)
      lastEmittedRef.current = parsed
      onChange(parsed)
    } catch {
      // indicator is already surfacing the parse error
    }
  }

  const dotColor = validity == null ? c.textPlaceholder : validity.valid ? c.success : c.error

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      <TextInput
        style={[styles.jsonInput, { color: c.text, backgroundColor: c.fill }, disabled && styles.disabled]}
        value={text}
        onChangeText={handleChange}
        placeholder="{}"
        placeholderTextColor={c.textPlaceholder}
        editable={isEditable}
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />
      <View style={styles.jsonToolbar}>
        <View style={[styles.jsonDot, { backgroundColor: dotColor }]} />
        <Text
          numberOfLines={1}
          style={[styles.jsonStatus, { color: validity?.valid === false ? c.error : c.textMuted }]}
        >
          {validity == null ? 'Empty' : validity.valid ? 'Valid JSON' : validity.message}
        </Text>
        {canPrettify && (
          <Pressable onPress={prettify} hitSlop={8}>
            <Text style={[styles.jsonFormatButton, { color: c.accent }]}>Format</Text>
          </Pressable>
        )}
      </View>
    </FieldShell>
  )
}
