/**
 * Banner — Native implementation.
 * Styled alert View with type-based colors.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Props = {
  children?: React.ReactNode
  type?: 'default' | 'success' | 'error' | 'info'
  className?: string
  style?: any
  icon?: React.ReactNode
  alignIcon?: string
  marginBottom?: boolean
}

const typeColors = {
  default: { bg: t.colors.surface, text: t.colors.text, border: t.colors.border },
  success: { bg: t.colors.successBackground, text: t.colors.success, border: t.colors.success },
  error: { bg: t.colors.errorBackground, text: t.colors.error, border: t.colors.error },
  info: { bg: '#eff6ff', text: '#2563eb', border: '#3b82f6' },
}

export const Banner: React.FC<Props> = ({
  children,
  type = 'default',
  icon,
  marginBottom,
}) => {
  const colors = typeColors[type] ?? typeColors.default

  return (
    <View style={[styles.banner, { backgroundColor: colors.bg, borderLeftColor: colors.border }, marginBottom && styles.marginBottom]}>
      {icon}
      {typeof children === 'string' ? (
        <Text style={[styles.text, { color: colors.text }]}>{children}</Text>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: t.spacing.md,
    borderRadius: t.borderRadius.sm,
    borderLeftWidth: 3,
    gap: t.spacing.sm,
    marginVertical: t.spacing.xs,
  },
  text: { fontSize: t.fontSize.sm, flex: 1 },
  content: { flex: 1 },
  marginBottom: { marginBottom: t.spacing.md },
})
