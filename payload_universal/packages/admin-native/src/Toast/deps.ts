import type React from 'react'

// ---------------------------------------------------------------------------
// Optional deps — loaded dynamically
// ---------------------------------------------------------------------------

export let BlurView: React.ComponentType<{
  style?: any
  intensity?: number
  tint?: string
}> | null = null

try {
  if (globalThis.expo?.getViewConfig?.('ExpoBlur', 'ExpoBlurView') != null) {
    BlurView = require('expo-blur').BlurView
  }
} catch {
  /* not available */
}

// Optional: GlassView for liquid glass pills on iOS 26+
export let GlassView: React.ComponentType<any> | null = null
export let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

// Lucide icons — loaded dynamically so this package doesn't hard-depend on them
export let CheckCircle2: React.ComponentType<any> | null = null
export let XCircle: React.ComponentType<any> | null = null
export let Info: React.ComponentType<any> | null = null
export let CloudOff: React.ComponentType<any> | null = null
export let Trash2: React.ComponentType<any> | null = null
export let RotateCcw: React.ComponentType<any> | null = null
export let Save: React.ComponentType<any> | null = null
export let CloudCheck: React.ComponentType<any> | null = null

try {
  const lucide = require('lucide-react-native')
  CheckCircle2 = lucide.CheckCircle2 ?? lucide.CheckCircle ?? null
  XCircle = lucide.XCircle ?? null
  Info = lucide.Info ?? null
  CloudOff = lucide.CloudOff ?? null
  Trash2 = lucide.Trash2 ?? null
  RotateCcw = lucide.RotateCcw ?? null
  Save = lucide.Save ?? null
  CloudCheck = lucide.CloudCheck ?? null
} catch {
  /* lucide-react-native not installed */
}
