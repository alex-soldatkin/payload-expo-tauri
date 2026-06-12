/**
 * Fallback field rendered for any field type that doesn't have a native component yet.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { ClientUIField, FieldComponentProps } from '../types'
import { defaultTheme as t } from '../theme'
import { getFieldLabel } from '../utils/schemaHelpers'
import { useCustomComponent } from '../contexts/CustomComponentContext'
import { useFormData } from '../contexts/FormDataContext'
import { useListColors } from '../hooks/useListColors'

export const FallbackField: React.FC<FieldComponentProps> = ({ field }) => {
  const { colors: c } = useListColors()
  return (
    <View style={[styles.container, { backgroundColor: c.pressed, borderColor: c.border }]}>
      <View style={[styles.badge, { backgroundColor: c.hairline }]}>
        <Text style={[styles.badgeText, { color: c.textMuted }]}>{field.type}</Text>
      </View>
      <Text style={[styles.label, { color: c.text }]}>{getFieldLabel(field)}</Text>
      <Text style={[styles.hint, { color: c.textMuted }]}>
        No native component for "{field.type}" fields yet.
      </Text>
    </View>
  )
}

/**
 * UIField — registry entry for Payload `ui` fields.
 *
 * `ui` fields have no data; on the web they render a custom admin component.
 * Resolution order:
 *   1. A custom Field component registered via CustomComponentContext
 *      (keyed "collectionSlug.fieldPath" or "fieldPath") renders directly,
 *      with no FieldShell chrome — matching the web admin.
 *   2. Nothing registered → a dev-friendly dashed placeholder so the gap is
 *      visible while building (FieldRenderer itself skips unregistered ui
 *      fields entirely, matching web behavior; this placeholder only shows
 *      for direct registry consumers).
 */
export const UIField: React.FC<FieldComponentProps<ClientUIField>> = ({
  field,
  value,
  onChange,
  path,
  disabled,
  error,
}) => {
  const formCtx = useFormData()
  const { colors: c } = useListColors()
  const CustomComponent = useCustomComponent(formCtx?.slug, path, 'Field')

  if (CustomComponent) {
    return (
      <CustomComponent
        field={field}
        value={value}
        onChange={onChange}
        path={path}
        disabled={disabled}
        error={error}
      />
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: c.pressed, borderColor: c.border }]}>
      <View style={[styles.badge, { backgroundColor: c.hairline }]}>
        <Text style={[styles.badgeText, { color: c.textMuted }]}>ui</Text>
      </View>
      <Text style={[styles.label, { color: c.text }]}>{getFieldLabel(field)}</Text>
      <Text style={[styles.hint, { color: c.textMuted }]}>
        No custom component registered for ui field "{path}". Register one via
        CustomComponentProvider (fields["{formCtx?.slug ? `${formCtx.slug}.${path}` : path}"]).
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: t.spacing.lg,
    padding: t.spacing.md,
    borderRadius: t.borderRadius.sm,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: t.colors.border,
    borderStyle: 'dashed',
  },
  badge: {
    backgroundColor: '#eee',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: t.spacing.xs,
  },
  badgeText: { fontSize: t.fontSize.xs, fontWeight: '600', color: t.colors.textMuted },
  label: { fontSize: t.fontSize.sm, fontWeight: '600', color: t.colors.text },
  hint: { fontSize: t.fontSize.xs, color: t.colors.textMuted, marginTop: 2 },
})
