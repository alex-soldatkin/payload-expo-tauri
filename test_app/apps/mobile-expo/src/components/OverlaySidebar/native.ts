/**
 * Optional native modules (graceful fallback when unavailable) — same probe
 * convention as app/(admin)/_layout.tsx and admin-native/BottomSheet.tsx.
 */
import type React from 'react'

let BlurView: React.ComponentType<any> | null = null
try {
  const hasNativeView = globalThis.expo?.getViewConfig?.('ExpoBlur', 'ExpoBlurView') != null
  if (hasNativeView) {
    BlurView = require('expo-blur').BlurView
  }
} catch {
  /* expo-blur not installed or native view unavailable */
}

let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not available */
}

export { BlurView, GlassView, liquidGlassAvailable }
