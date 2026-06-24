/**
 * DocumentForm — optional native module requires.
 *
 * Extracted from the original DocumentForm.tsx (purely structural; no behavior
 * change). These are best-effort `require`s for liquid-glass / blur containers
 * that are absent in dev/web builds — the consumers (SidebarEdgeTab,
 * InspectorPanel) fall back to plain Views.
 */
import type React from 'react'

// Optional: GlassView for liquid glass containers on iOS 26+
export let GlassView: React.ComponentType<any> | null = null
export let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

// Optional: BlurView for translucent panel background
export let BlurView: React.ComponentType<any> | null = null
try {
  BlurView = require('expo-blur').BlurView
} catch { /* not available */ }

// Try to import safe area insets for proper panel positioning
export let useSafeAreaInsets: (() => { top: number; bottom: number; left: number; right: number }) | null = null
try {
  useSafeAreaInsets = require('react-native-safe-area-context').useSafeAreaInsets
} catch { /* not available */ }
