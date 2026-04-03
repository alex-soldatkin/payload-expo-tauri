/**
 * Shared field wrapper providing consistent label, description, required
 * indicator, and error display across all field types.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { defaultTheme as t } from '../../theme'

type FieldShellProps = {
  label: string
  description?: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

export const FieldShell: React.FC<FieldShellProps> = ({
  label,
  description,
  required,
  error,
  children,
}) => (
  <View style={styles.container}>
    <Text style={styles.label}>
      {label}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
    {children}
    {description && <Text style={styles.description}>{description}</Text>}
    {error && <Text style={styles.error}>{error}</Text>}
  </View>
)

export const fieldShellStyles = StyleSheet.create({
  container: { marginBottom: t.spacing.md },
  label: {
    fontSize: t.fontSize.xs,
    fontWeight: '600',
    color: t.colors.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  required: { color: t.colors.error },
  description: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    marginTop: t.spacing.xs,
  },
  error: {
    fontSize: t.fontSize.xs,
    color: t.colors.error,
    marginTop: t.spacing.xs,
  },
  disabledHost: { opacity: 0.5 },
})

const styles = fieldShellStyles
