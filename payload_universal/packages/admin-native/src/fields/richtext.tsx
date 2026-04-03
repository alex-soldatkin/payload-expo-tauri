/**
 * RichText field – rendered as a multiline TextInput placeholder.
 * Full rich-text editing on mobile requires a dedicated editor integration
 * (e.g. @10play/tentap-editor). This component provides a usable plain-text
 * fallback that preserves the data round-trip.
 */
import React from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import type { ClientRichTextField, FieldComponentProps } from '../types'
import { defaultTheme as t } from '../theme'
import { getFieldDescription, getFieldLabel } from '../utils/schemaHelpers'

/**
 * Extract plain-text from a Lexical / Slate JSON tree (best-effort).
 * Falls back to JSON.stringify for unknown shapes.
 */
const richTextToPlain = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') return value

  // Lexical format: { root: { children: [ { children: [ { text: "..." } ] } ] } }
  if (typeof value === 'object' && 'root' in (value as Record<string, unknown>)) {
    const extract = (node: unknown): string => {
      if (node == null) return ''
      if (typeof node === 'string') return node
      const n = node as Record<string, unknown>
      if (typeof n.text === 'string') return n.text
      if (Array.isArray(n.children)) return n.children.map(extract).join('\n')
      return ''
    }
    return extract((value as Record<string, unknown>).root)
  }

  // Slate format: array of nodes
  if (Array.isArray(value)) {
    const extract = (node: unknown): string => {
      if (node == null) return ''
      const n = node as Record<string, unknown>
      if (typeof n.text === 'string') return n.text
      if (Array.isArray(n.children)) return n.children.map(extract).join('')
      return ''
    }
    return value.map(extract).join('\n')
  }

  return JSON.stringify(value, null, 2)
}

export const RichTextField: React.FC<FieldComponentProps<ClientRichTextField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const plainText = richTextToPlain(value)

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {getFieldLabel(field)}
        {field.required && <Text style={styles.required}> *</Text>}
      </Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Rich Text (plain-text editing mode)</Text>
      </View>
      <TextInput
        style={[styles.input, disabled && styles.disabled, error && styles.inputError]}
        value={plainText}
        onChangeText={(text) => {
          // Wrap in a minimal Lexical JSON structure so the server can accept it
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
        placeholderTextColor={t.colors.textPlaceholder}
        editable={!disabled && !field.admin?.readOnly}
        multiline
        numberOfLines={8}
        textAlignVertical="top"
      />
      {getFieldDescription(field) && (
        <Text style={styles.description}>{getFieldDescription(field)}</Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: t.spacing.lg },
  label: { fontSize: t.fontSize.sm, fontWeight: '600', color: t.colors.text, marginBottom: t.spacing.xs },
  required: { color: t.colors.error },
  description: { fontSize: t.fontSize.xs, color: t.colors.textMuted, marginTop: t.spacing.xs },
  error: { fontSize: t.fontSize.xs, color: t.colors.error, marginTop: t.spacing.xs },
  badge: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: t.spacing.sm,
  },
  badgeText: { fontSize: t.fontSize.xs, color: t.colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    fontSize: t.fontSize.md,
    color: t.colors.text,
    backgroundColor: t.colors.surface,
    minHeight: 140,
  },
  inputError: { borderColor: t.colors.error },
  disabled: { opacity: 0.5, backgroundColor: '#f9f9f9' },
})
