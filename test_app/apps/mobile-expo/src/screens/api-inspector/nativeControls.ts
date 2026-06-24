import React from 'react'
import { Platform } from 'react-native'

// ── Optional native modules (guarded — graceful fallback tiers) ──────────
export let GlassView: React.ComponentType<any> | null = null
export let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

// App screens MAY import @expo/ui/swift-ui directly (tab layout precedent).
// Modifiers are factory calls imported from '@expo/ui/swift-ui/modifiers'.
export let SHost: any = null
export let SPicker: any = null
export let SStepper: any = null
export let SToggle: any = null
export let SText: any = null
export let pickerStyleMod: ((style: string) => any) | null = null
export let tagMod: ((tag: string) => any) | null = null
if (Platform.OS === 'ios') {
  try {
    const ui = require('@expo/ui/swift-ui')
    const mods = require('@expo/ui/swift-ui/modifiers')
    SHost = ui.Host
    SPicker = ui.Picker
    SStepper = ui.Stepper
    SToggle = ui.Toggle
    SText = ui.Text
    pickerStyleMod = mods.pickerStyle
    tagMod = mods.tag
  } catch {
    /* @expo/ui not available */
  }
}

// ---------------------------------------------------------------------------
// Stable identities for native-bound props.
//
// Every value handed to a SwiftUI host/control must be referentially AND
// value stable across renders. Per-render-fresh objects re-apply native props
// on each commit, which re-arms SwiftUI body re-evaluation + `.onAppear`
// echo events mid-update — the render-loop class documented for the details
// sheet (memory-bank 008, Phase 25 item 2: DatePicker onAppear echo +
// `selection={new Date()}` re-arming the cycle).
// ---------------------------------------------------------------------------

export const MATCH_CONTENTS = { vertical: true }
