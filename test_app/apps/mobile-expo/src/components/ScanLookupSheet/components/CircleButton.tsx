// ---------------------------------------------------------------------------
// Glass circle button (lucide icon inside; no @expo/ui in this tree)
// ---------------------------------------------------------------------------
import React from 'react'
import { Pressable, View } from 'react-native'
import type { ListColorPalette } from '@payload-universal/admin-native'

import { GlassView, liquidGlassAvailable } from '../nativeDeps'
import { styles } from '../styles'

export const CircleButton: React.FC<{
  onPress: () => void
  label: string
  colors: ListColorPalette
  dark: boolean
  children: React.ReactNode
}> = ({ onPress, label, colors, dark, children }) => {
  if (liquidGlassAvailable && GlassView) {
    return (
      <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6}>
        <GlassView style={styles.circle} isInteractive glassEffectStyle="regular">
          <View style={styles.circleInner}>{children}</View>
        </GlassView>
      </Pressable>
    )
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.circle,
        styles.circleInner,
        {
          backgroundColor: pressed
            ? colors.pressed
            : dark
              ? 'rgba(255,255,255,0.10)'
              : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      {children}
    </Pressable>
  )
}
