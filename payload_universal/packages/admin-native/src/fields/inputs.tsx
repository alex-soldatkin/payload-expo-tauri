/**
 * TextInput-based field components: text, email, number, textarea, code, json, point.
 * Each maps a Payload field type to a native TextInput with the appropriate keyboard config.
 */
import React from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import type {
  ClientCodeField,
  ClientEmailField,
  ClientJSONField,
  ClientNumberField,
  ClientPointField,
  ClientTextField,
  ClientTextareaField,
  FieldComponentProps,
} from '../types'
import { defaultTheme as t } from '../theme'
import { getFieldDescription, getFieldLabel } from '../schemaHelpers'
import { FieldShell } from './shared'

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export const TextField: React.FC<FieldComponentProps<ClientTextField>> = ({
  field, value, onChange, disabled, error,
}) => (
  <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
    <TextInput
      style={[styles.input, disabled && styles.disabled, error && styles.inputError]}
      value={value != null ? String(value) : ''}
      onChangeText={(v) => onChange(v)}
      placeholder={field.admin?.placeholder}
      placeholderTextColor={t.colors.textPlaceholder}
      editable={!disabled && !field.admin?.readOnly}
      maxLength={field.maxLength}
      autoCapitalize="none"
    />
  </FieldShell>
)

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export const EmailField: React.FC<FieldComponentProps<ClientEmailField>> = ({
  field, value, onChange, disabled, error,
}) => (
  <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
    <TextInput
      style={[styles.input, disabled && styles.disabled, error && styles.inputError]}
      value={value != null ? String(value) : ''}
      onChangeText={(v) => onChange(v)}
      placeholder={field.admin?.placeholder || 'email@example.com'}
      placeholderTextColor={t.colors.textPlaceholder}
      editable={!disabled && !field.admin?.readOnly}
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
      textContentType="emailAddress"
    />
  </FieldShell>
)

// ---------------------------------------------------------------------------
// Number
// ---------------------------------------------------------------------------

export const NumberField: React.FC<FieldComponentProps<ClientNumberField>> = ({
  field, value, onChange, disabled, error,
}) => (
  <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
    <TextInput
      style={[styles.input, disabled && styles.disabled, error && styles.inputError]}
      value={value != null ? String(value) : ''}
      onChangeText={(v) => {
        if (v === '' || v === '-') { onChange(v); return }
        const n = Number(v)
        onChange(Number.isNaN(n) ? value : n)
      }}
      placeholder={field.admin?.placeholder}
      placeholderTextColor={t.colors.textPlaceholder}
      editable={!disabled && !field.admin?.readOnly}
      keyboardType="decimal-pad"
      returnKeyType="done"
    />
  </FieldShell>
)

// ---------------------------------------------------------------------------
// Textarea
// ---------------------------------------------------------------------------

export const TextareaField: React.FC<FieldComponentProps<ClientTextareaField>> = ({
  field, value, onChange, disabled, error,
}) => (
  <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
    <TextInput
      style={[styles.input, styles.textarea, disabled && styles.disabled, error && styles.inputError]}
      value={value != null ? String(value) : ''}
      onChangeText={(v) => onChange(v)}
      placeholder={field.admin?.placeholder}
      placeholderTextColor={t.colors.textPlaceholder}
      editable={!disabled && !field.admin?.readOnly}
      maxLength={field.maxLength}
      multiline
      numberOfLines={5}
      textAlignVertical="top"
    />
  </FieldShell>
)

// ---------------------------------------------------------------------------
// Code
// ---------------------------------------------------------------------------

export const CodeField: React.FC<FieldComponentProps<ClientCodeField>> = ({
  field, value, onChange, disabled, error,
}) => (
  <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
    <TextInput
      style={[styles.input, styles.code, disabled && styles.disabled, error && styles.inputError]}
      value={value != null ? String(value) : ''}
      onChangeText={(v) => onChange(v)}
      placeholder={field.admin?.placeholder}
      placeholderTextColor={t.colors.textPlaceholder}
      editable={!disabled && !field.admin?.readOnly}
      multiline
      numberOfLines={8}
      textAlignVertical="top"
      autoCapitalize="none"
      autoCorrect={false}
    />
  </FieldShell>
)

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export const JSONField: React.FC<FieldComponentProps<ClientJSONField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? ''
  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <TextInput
        style={[styles.input, styles.code, disabled && styles.disabled, error && styles.inputError]}
        value={text}
        onChangeText={(v) => { try { onChange(JSON.parse(v)) } catch { onChange(v) } }}
        placeholder="{}"
        placeholderTextColor={t.colors.textPlaceholder}
        editable={!disabled && !field.admin?.readOnly}
        multiline
        numberOfLines={8}
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Point (lat/lng)
// ---------------------------------------------------------------------------

export const PointField: React.FC<FieldComponentProps<ClientPointField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const coords = Array.isArray(value) ? value : [0, 0]
  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <View style={styles.pointRow}>
        <TextInput
          style={[styles.input, styles.pointInput, disabled && styles.disabled]}
          value={String(coords[0] ?? '')}
          onChangeText={(v) => onChange([Number(v) || 0, coords[1]])}
          placeholder="Longitude"
          placeholderTextColor={t.colors.textPlaceholder}
          keyboardType="numeric"
          editable={!disabled}
        />
        <TextInput
          style={[styles.input, styles.pointInput, disabled && styles.disabled]}
          value={String(coords[1] ?? '')}
          onChangeText={(v) => onChange([coords[0], Number(v) || 0])}
          placeholder="Latitude"
          placeholderTextColor={t.colors.textPlaceholder}
          keyboardType="numeric"
          editable={!disabled}
        />
      </View>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: t.colors.border, borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm + 2,
    fontSize: t.fontSize.md, color: t.colors.text, backgroundColor: t.colors.surface,
  },
  inputError: { borderColor: t.colors.error },
  disabled: { opacity: 0.5, backgroundColor: '#f9f9f9' },
  textarea: { minHeight: 100 },
  code: { fontFamily: 'monospace', minHeight: 140, fontSize: t.fontSize.sm },
  pointRow: { flexDirection: 'row', gap: t.spacing.sm },
  pointInput: { flex: 1 },
})
