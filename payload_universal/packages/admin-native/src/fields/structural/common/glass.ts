import React from 'react'
import { Platform, UIManager } from 'react-native'

// ---------------------------------------------------------------------------
// Liquid glass (iOS 26+) — optional GlassView container
// ---------------------------------------------------------------------------

let _GlassView: React.ComponentType<any> | null = null
let _liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  _GlassView = glassModule.GlassView
  _liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}
// Exported as consts so TS narrowing survives into closures at call sites.
export const GlassView = _GlassView
export const liquidGlassAvailable = _liquidGlassAvailable

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
