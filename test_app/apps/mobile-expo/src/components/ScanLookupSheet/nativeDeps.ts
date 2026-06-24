/**
 * Optional native deps for ScanLookupSheet — try/catch requires (graceful
 * degradation tiers). expo-camera, expo-glass-effect, expo-blur each load
 * guarded so a binary missing the pod shows a fallback instead of crashing.
 */
import type React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import type { CameraModuleShape, UseCameraPermissions } from './types'

// expo-camera calls requireNativeModule at import time — it THROWS on a
// binary built without the ExpoCamera pod. The require must stay guarded so
// the current binary shows the fallback message instead of crashing.
export let cameraModule: CameraModuleShape | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-camera') as Partial<CameraModuleShape>
  if (mod?.CameraView && mod?.useCameraPermissions) {
    cameraModule = mod as CameraModuleShape
  }
} catch {
  /* binary without the camera pod — instructive empty state below */
}

/** Module-constant hook reference — the branch never changes at runtime. */
export const useCameraPermissionsSafe: UseCameraPermissions =
  cameraModule?.useCameraPermissions ??
  (() => [null, async () => null] as const)

// Liquid glass (iOS 26+) → BlurView → solid fallback, BottomSheet precedent.
export let GlassView: React.ComponentType<any> | null = null
export let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

export let BlurView: React.ComponentType<{
  style?: StyleProp<ViewStyle>
  intensity?: number
  tint?: string
}> | null = null
try {
  if (
    (globalThis as Record<string, any>).expo?.getViewConfig?.('ExpoBlur', 'ExpoBlurView') != null
  ) {
    BlurView = require('expo-blur').BlurView
  }
} catch {
  /* not available */
}
