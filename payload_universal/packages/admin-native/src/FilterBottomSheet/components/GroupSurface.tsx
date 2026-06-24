// ---------------------------------------------------------------------------
// Group surface — liquid glass inset section on iOS 26+, themed fallback
// ---------------------------------------------------------------------------
import React from 'react'
import { View } from 'react-native'

import type { FilterStyles } from '../types'

// Optional: GlassView for liquid glass group sections on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed */
}

export const GroupSurface: React.FC<{
  styles: FilterStyles
  children: React.ReactNode
}> = ({ styles, children }) => {
  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView style={styles.groupSection} glassEffectStyle="regular">
        {children}
      </GlassView>
    )
  }
  return <View style={[styles.groupSection, styles.groupSectionFallback]}>{children}</View>
}
