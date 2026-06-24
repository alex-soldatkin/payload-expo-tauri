// ---------------------------------------------------------------------------
// Glass section wrapper (graceful tiers).
//
// Top-level component with a STABLE type: when this was a useCallback-built
// component inside the screen, every color-scheme flip produced a new
// component type → React remounted all three sections → the SwiftUI hosts
// (Toggle/Stepper/Picker) were recreated → their `.onAppear` echoes fired
// setState again. A stable type only re-renders; it never remounts.
// ---------------------------------------------------------------------------
import React from 'react'
import { View } from 'react-native'

import { GlassView, liquidGlassAvailable } from './nativeControls'
import { styles } from './styles'

export const Section: React.FC<{
  isDark: boolean
  children: React.ReactNode
  style?: any
}> = ({ isDark, children, style }) =>
  liquidGlassAvailable && GlassView ? (
    <GlassView style={[styles.section, style]} glassEffectStyle="regular">
      {children}
    </GlassView>
  ) : (
    <View
      style={[
        styles.section,
        { backgroundColor: isDark ? 'rgba(44,44,46,0.9)' : 'rgba(255,255,255,0.92)' },
        style,
      ]}
    >
      {children}
    </View>
  )
