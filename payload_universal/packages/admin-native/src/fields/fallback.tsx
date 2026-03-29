/**
 * Fallback field rendered for any field type that doesn't have a native component yet.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { FieldComponentProps } from '../types'
import { defaultTheme as t } from '../theme'
import { getFieldLabel } from '../schemaHelpers'

export const FallbackField: React.FC<FieldComponentProps> = ({ field }) => (
  <View style={styles.container}>
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{field.type}</Text>
    </View>
    <Text style={styles.label}>{getFieldLabel(field)}</Text>
    <Text style={styles.hint}>
      No native component for "{field.type}" fields yet.
    </Text>
  </View>
)

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
