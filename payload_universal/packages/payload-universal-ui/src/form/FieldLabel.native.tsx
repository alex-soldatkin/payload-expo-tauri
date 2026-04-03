/**
 * FieldLabel — Native implementation.
 */
import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Props = {
  label?: string | Record<string, string>
  required?: boolean
  htmlFor?: string
  className?: string
  style?: any
}

function resolveLabel(label: string | Record<string, string> | undefined): string {
  if (!label) return ''
  if (typeof label === 'string') return label
  return label.en ?? Object.values(label)[0] ?? ''
}

export const FieldLabel: React.FC<Props> = ({ label, required }) => {
  const text = resolveLabel(label)
  if (!text) return null

  return (
    <Text style={styles.label}>
      {text}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
  )
}

const styles = StyleSheet.create({
  label: {
    fontSize: t.fontSize.md,
    fontWeight: '400',
    color: t.colors.textMuted,
    marginBottom: 4,
  },
  required: { color: t.colors.error },
})
