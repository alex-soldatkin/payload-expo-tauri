import type React from 'react'

// Optional: GlassView for the editor container (iOS 26+)
export let EditorGlassView: React.ComponentType<any> | null = null
export let editorGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  EditorGlassView = glassModule.GlassView
  editorGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch { /* not available */ }

// Optional: expo-image-picker for inline image insertion
export let ImagePicker: typeof import('expo-image-picker') | null = null
try {
  ImagePicker = require('expo-image-picker')
} catch { /* not available */ }

// Optional: local-db upload queue for background image uploads
export let _useLocalDB: (() => any) | null = null
try {
  _useLocalDB = require('@payload-universal/local-db').useLocalDB
} catch { /* local-db not available */ }
