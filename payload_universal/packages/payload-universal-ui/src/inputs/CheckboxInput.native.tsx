/**
 * CheckboxInput — Native implementation.
 * Uses React Native Switch (or native Toggle when available).
 */
import React from 'react'
import { Switch, StyleSheet, Text, View } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Props = {
  value?: boolean
  onChange?: (value: boolean) => void
  label?: string
  required?: boolean
  disabled?: boolean
  error?: string
  description?: string
  className?: string
  style?: any
  id?: string
  name?: string
}

export const CheckboxInput: React.FC<Props> = ({
  value = false,
  onChange,
  label,
  disabled,
  error,
  description,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {label && <Text style={styles.label}>{label}</Text>}
        <Switch
          value={!!value}
          onValueChange={onChange}
          disabled={disabled}
        />
      </View>
      {description && <Text style={styles.description}>{description}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={[styles.separator, error && styles.separatorError]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  label: { fontSize: t.fontSize.md, color: t.colors.textMuted, flex: 1, marginRight: 8 },
  description: { fontSize: 12, color: t.colors.textPlaceholder, marginTop: 2 },
  error: { fontSize: 12, color: t.colors.error, marginTop: 3 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.separator },
  separatorError: { backgroundColor: t.colors.error, height: 1 },
})
