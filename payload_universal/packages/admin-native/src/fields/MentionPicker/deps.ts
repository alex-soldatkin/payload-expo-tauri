import type React from 'react'

// Optional: GlassView for liquid glass effect on result cards (iOS 26+)
export let GlassView: React.ComponentType<any> | null = null
export let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

// Optional: local-db for offline-first querying
export let _useLocalDB: (() => any) | null = null
try {
  _useLocalDB = require('@payload-universal/local-db').useLocalDB
} catch { /* local-db not available */ }
