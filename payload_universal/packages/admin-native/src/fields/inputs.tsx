/**
 * TextInput-based field components: text, email, number, textarea, code, json, point.
 *
 * iOS 26 Mail compose style — simple fields use inline layout (label left,
 * input right). Multiline fields (textarea, code, json) use stacked layout.
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
      style={[styles.inlineInput, disabled && styles.disabled]}
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
      style={[styles.inlineInput, disabled && styles.disabled]}
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
      style={[styles.inlineInput, disabled && styles.disabled]}
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
// Textarea (stacked — multiline)
// ---------------------------------------------------------------------------

export const TextareaField: React.FC<FieldComponentProps<ClientTextareaField>> = ({
  field, value, onChange, disabled, error,
}) => (
  <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
    <TextInput
      style={[styles.multilineInput, disabled && styles.disabled]}
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
// Code (stacked — multiline monospaced)
// ---------------------------------------------------------------------------

export const CodeField: React.FC<FieldComponentProps<ClientCodeField>> = ({
  field, value, onChange, disabled, error,
}) => (
  <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
    <TextInput
      style={[styles.multilineInput, styles.codeFont, disabled && styles.disabled]}
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
// JSON (stacked — multiline monospaced)
// ---------------------------------------------------------------------------

export const JSONField: React.FC<FieldComponentProps<ClientJSONField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? ''
  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      <TextInput
        style={[styles.multilineInput, styles.codeFont, disabled && styles.disabled]}
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
// Point (lat/lng — inline pair)
// ---------------------------------------------------------------------------

export const PointField: React.FC<FieldComponentProps<ClientPointField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const coords = Array.isArray(value) ? value : [0, 0]
  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <View style={styles.pointRow}>
        <TextInput
          style={[styles.inlineInput, styles.pointInput, disabled && styles.disabled]}
          value={String(coords[0] ?? '')}
          onChangeText={(v) => onChange([Number(v) || 0, coords[1]])}
          placeholder="Lng"
          placeholderTextColor={t.colors.textPlaceholder}
          keyboardType="numeric"
          editable={!disabled}
        />
        <TextInput
          style={[styles.inlineInput, styles.pointInput, disabled && styles.disabled]}
          value={String(coords[1] ?? '')}
          onChangeText={(v) => onChange([coords[0], Number(v) || 0])}
          placeholder="Lat"
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
  // Inline input — borderless, fills the right side of the row
  inlineInput: {
    fontSize: t.fontSize.md,
    color: t.colors.text,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    flex: 1,
    textAlign: 'left',
  },
  // Multiline input — stacked below label with light border
  multilineInput: {
    fontSize: t.fontSize.md,
    color: t.colors.text,
    minHeight: 100,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.sm,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
  },
  codeFont: {
    fontFamily: 'monospace',
    fontSize: t.fontSize.sm,
    minHeight: 140,
  },
  disabled: { opacity: 0.5 },
  pointRow: { flexDirection: 'row', gap: t.spacing.md, flex: 1 },
  pointInput: { flex: 1 },
})
