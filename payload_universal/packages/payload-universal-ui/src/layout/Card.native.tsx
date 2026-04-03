/**
 * Card — Native implementation.
 * View with subtle shadow, optionally GlassView on iOS 26+.
 */
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

let GlassView: React.ComponentType<any> | null = null
let glassAvailable = false
try {
  const m = require('expo-glass-effect')
  GlassView = m.GlassView
  glassAvailable = m.isLiquidGlassAvailable?.() ?? false
} catch { /* not available */ }

type Props = {
  children: React.ReactNode
  style?: any
  className?: string
  id?: string
  title?: string
}

export const Card: React.FC<Props> = ({ children, style }) => {
  if (glassAvailable && GlassView) {
    return (
      <GlassView style={[styles.card, style]} glassEffectStyle="regular">
        {children}
      </GlassView>
    )
  }

  return <View style={[styles.card, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.lg,
    marginVertical: t.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
})
