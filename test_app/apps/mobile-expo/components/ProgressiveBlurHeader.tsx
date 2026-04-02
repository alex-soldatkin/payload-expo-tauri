/**
 * Progressive blur header overlay.
 *
 * Creates an Apple-style progressive blur at the top of the screen that fades
 * from full blur intensity behind the navigation bar to fully transparent below
 * it. Renders as an absolute-positioned overlay with pointerEvents="none" so
 * touches pass through to underlying content and native header controls.
 *
 * Fallback tiers:
 *   1. iOS 26+ liquid glass (GlassView) — Apple's native glass material
 *   2. Progressive blur (MaskedView + LinearGradient + BlurView)
 *   3. Gradient tint fallback (no native blur module)
 */
import React from 'react'
import { Platform, StyleSheet, UIManager, View } from 'react-native'

// ---------------------------------------------------------------------------
// Optional native modules — loaded dynamically so the app never hard-crashes
// ---------------------------------------------------------------------------

let GlassView: React.ComponentType<{
  style?: any
  glassEffectStyle?: string
  tintColor?: string
}> | null = null

try {
  const mod = require('expo-glass-effect')
  GlassView = mod.GlassView
} catch {
  /* not available */
}

let BlurView: React.ComponentType<{
  style?: any
  intensity?: number
  tint?: string
}> | null = null

try {
  const mod = require('expo-blur')
  if (mod.BlurView) BlurView = mod.BlurView
} catch {
  /* not available */
}

let MaskedView: React.ComponentType<{
  style?: any
  maskElement: React.ReactElement
  children: React.ReactNode
}> | null = null

try {
  const mod = require('@react-native-masked-view/masked-view')
  const Component = mod.default ?? mod.MaskedView ?? null
  // Verify the native view is actually registered in this binary —
  // the JS package may be installed but the native module missing
  // (e.g. running in Expo Go or a dev client that hasn't been rebuilt).
  if (Component && UIManager.getViewManagerConfig?.('RNCMaskedView')) {
    MaskedView = Component
  }
} catch {
  /* not available */
}

let LinearGradient: React.ComponentType<{
  style?: any
  colors: string[]
  locations?: number[]
  start?: { x: number; y: number }
  end?: { x: number; y: number }
  children?: React.ReactNode
}> | null = null

try {
  const mod = require('expo-linear-gradient')
  LinearGradient = mod.LinearGradient
} catch {
  /* not available */
}

// ---------------------------------------------------------------------------
// Pre-computed eased gradient stops for the blur mask.
// Uses react-native-easing-gradient when available for natural fall-off,
// otherwise uses hand-tuned ease-out stops.
// ---------------------------------------------------------------------------

let gradientColors: string[] = [
  'rgba(0,0,0,1)',
  'rgba(0,0,0,0.99)',
  'rgba(0,0,0,0.95)',
  'rgba(0,0,0,0.85)',
  'rgba(0,0,0,0.65)',
  'rgba(0,0,0,0.4)',
  'rgba(0,0,0,0.18)',
  'rgba(0,0,0,0.06)',
  'rgba(0,0,0,0)',
]
let gradientLocations: number[] = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.82, 0.92, 1]

try {
  const { easeGradient } = require('react-native-easing-gradient')
  const result = easeGradient({
    colorStops: {
      0: { color: 'rgba(0,0,0,0.99)' },
      0.55: { color: 'rgba(0,0,0,0.6)' },
      1: { color: 'transparent' },
    },
  })
  if (result?.colors?.length && result?.locations?.length) {
    gradientColors = result.colors
    gradientLocations = result.locations
  }
} catch {
  /* use hand-tuned stops */
}

// Same stops but for the tint gradient (paper color) used in the fallback and
// as a subtle tint layer behind the blur.
const PAPER = { r: 246, g: 244, b: 241 }

const tintColors = [
  `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.85)`,
  `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.75)`,
  `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.55)`,
  `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.3)`,
  `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.1)`,
  `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0)`,
]
const tintLocations = [0, 0.25, 0.5, 0.7, 0.88, 1]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProgressiveBlurHeaderProps {
  /** Total height of the navigation bar (safe-area top + 44). */
  headerHeight: number
  /** Extra pixels below the header where the blur fades out. Default 30. */
  blurExtension?: number
  /** expo-blur intensity. Default 50. */
  blurIntensity?: number
}

export function ProgressiveBlurHeader({
  headerHeight,
  blurExtension = 30,
  blurIntensity = 50,
}: ProgressiveBlurHeaderProps) {
  const totalHeight = headerHeight + blurExtension

  // ------ Tier 1: iOS 26+ liquid glass ------
  if (
    GlassView &&
    Platform.OS === 'ios' &&
    parseInt(Platform.Version as string, 10) >= 26
  ) {
    return (
      <View pointerEvents="none" style={[styles.overlay, { height: headerHeight }]}>
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          tintColor="rgba(246, 244, 241, 0.7)"
        />
      </View>
    )
  }

  // ------ Tier 2: Progressive blur (MaskedView + gradient + BlurView) ------
  if (BlurView && MaskedView && LinearGradient) {
    const Mask = MaskedView
    const Gradient = LinearGradient
    const Blur = BlurView

    return (
      <View pointerEvents="none" style={[styles.overlay, { height: totalHeight }]}>
        {/* Subtle paper tint behind the blur for readability */}
        <Gradient
          colors={tintColors}
          locations={tintLocations}
          style={StyleSheet.absoluteFill}
        />
        {/* Progressive blur masked by gradient */}
        <Mask
          maskElement={
            <Gradient
              colors={gradientColors}
              locations={gradientLocations}
              style={StyleSheet.absoluteFill}
            />
          }
          style={StyleSheet.absoluteFill}
        >
          <Blur
            intensity={blurIntensity}
            tint="systemChromeMaterialLight"
            style={StyleSheet.absoluteFill}
          />
        </Mask>
      </View>
    )
  }

  // ------ Tier 3: BlurView without progressive mask ------
  if (BlurView) {
    const Blur = BlurView
    return (
      <View pointerEvents="none" style={[styles.overlay, { height: headerHeight }]}>
        <Blur
          intensity={blurIntensity}
          tint="systemChromeMaterialLight"
          style={StyleSheet.absoluteFill}
        />
      </View>
    )
  }

  // ------ Tier 4: Pure RN fallback — gradient tint (no native blur) ------
  if (LinearGradient) {
    const Gradient = LinearGradient
    return (
      <View pointerEvents="none" style={[styles.overlay, { height: totalHeight }]}>
        <Gradient
          colors={[
            `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.95)`,
            `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.8)`,
            `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.4)`,
            `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0)`,
          ]}
          locations={[0, 0.45, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    )
  }

  // ------ Tier 5: Absolute fallback — solid translucent bar ------
  return (
    <View pointerEvents="none" style={[styles.overlay, { height: headerHeight }]}>
      <View style={[StyleSheet.absoluteFill, styles.translucentHeader]} />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  translucentHeader: {
    backgroundColor: 'rgba(246, 244, 241, 0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
})
