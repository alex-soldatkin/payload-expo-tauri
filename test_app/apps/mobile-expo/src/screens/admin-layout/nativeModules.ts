/**
 * Optional native modules + constants for the admin tab layout.
 *
 * Graceful fallback when the native binary doesn't include these views.
 * Shared between the phone tab bar (TabBar.tsx) and the tablet sidebar
 * (Sidebar.tsx) chrome.
 */
import React from 'react'
import { Platform } from 'react-native'

// ---------------------------------------------------------------------------
// Optional native modules (graceful fallback when unavailable)
// ---------------------------------------------------------------------------

export let BlurView: React.ComponentType<any> | null = null
try {
  // expo-blur uses a native view (ViewManagerAdapter_ExpoBlur_ExpoBlurView).
  // The JS module always loads, but the native view crashes at RENDER time if
  // the binary doesn't include it. The view config getter is registered lazily
  // via NativeComponentRegistry — it doesn't throw at require time.
  // Check globalThis.expo.getViewConfig() which is the native registry probe.
  const hasNativeView = globalThis.expo?.getViewConfig?.('ExpoBlur', 'ExpoBlurView') != null
  if (hasNativeView) {
    BlurView = require('expo-blur').BlurView
  }
} catch {
  /* expo-blur not installed or native view unavailable */
}

// SwiftUI components for the native long-press menu (iOS only)
export let SMenu: any = null
export let SButton: any = null
export let SDivider: any = null
export let SHost: any = null

if (Platform.OS === 'ios') {
  try {
    const s = require('@expo/ui/swift-ui')
    SMenu = s.Menu
    SButton = s.Button
    SDivider = s.Divider
    SHost = s.Host
  } catch {
    /* @expo/ui not available */
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ACTIVE_COLOR = '#007AFF'
export const INACTIVE_COLOR = '#8E8E93'
