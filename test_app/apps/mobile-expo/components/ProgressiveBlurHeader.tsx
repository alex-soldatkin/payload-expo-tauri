/**
 * Progressive blur header overlay + headerBackground fallback.
 *
 * Exports:
 *   - `ProgressiveBlurHeader` — overlay that fades in as the user scrolls.
 *     Driven by an `Animated.Value` (scrollY) shared via `HeaderScrollContext`.
 *     Uses MaskedView + BlurView for progressive fade, or GlassView on iOS 26+.
 *   - `HeaderBackgroundFallback` — headerBackground for the Stack when the
 *     progressive blur overlay can't render.
 *   - `hasProgressiveBlur` — static boolean for layout config.
 */
import React from 'react'
import { Animated, Platform, StyleSheet, UIManager, View } from 'react-native'

// ---------------------------------------------------------------------------
// Optional native modules
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
// Capability flags
// ---------------------------------------------------------------------------

const isIOS26 =
  Platform.OS === 'ios' && parseInt(Platform.Version as string, 10) >= 26

export const hasProgressiveBlur =
  !!(GlassView && isIOS26) || !!(BlurView && MaskedView && LinearGradient)

// ---------------------------------------------------------------------------
// Eased gradient stops for the blur mask
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

const PAPER = { r: 246, g: 244, b: 241 }

// Light tint behind the blur — lowered opacity for more translucency
const tintColors = [
  `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.55)`,
  `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.45)`,
  `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.3)`,
  `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.15)`,
  `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0.05)`,
  `rgba(${PAPER.r},${PAPER.g},${PAPER.b},0)`,
]
const tintLocations = [0, 0.25, 0.5, 0.7, 0.88, 1]

// ---------------------------------------------------------------------------
// ProgressiveBlurHeader
// ---------------------------------------------------------------------------

interface ProgressiveBlurHeaderProps {
  /** Total height of the navigation bar (safe-area top + 44). */
  headerHeight: number
  /** Extra pixels below the header where the blur fades out. Default 30. */
  blurExtension?: number
  /** expo-blur intensity. Default 35. */
  blurIntensity?: number
  /**
   * Scroll offset `Animated.Value` — drives the overlay opacity.
   * At scrollY=0 the header is nearly transparent; at scrollY≥60
   * it reaches full blur. When omitted the overlay is always visible.
   */
  scrollY?: Animated.Value
}

export function ProgressiveBlurHeader({
  headerHeight,
  blurExtension = 30,
  blurIntensity = 35,
  scrollY,
}: ProgressiveBlurHeaderProps) {
  const totalHeight = headerHeight + blurExtension

  // Scroll-driven opacity (transparent at top, fully blurred when scrolled)
  const opacity = scrollY
    ? scrollY.interpolate({
        inputRange: [0, 60],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      })
    : 1

  // ------ Tier 1: iOS 26+ liquid glass ------
  if (GlassView && isIOS26) {
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.overlay, { height: headerHeight, opacity }]}
      >
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          tintColor="rgba(246, 244, 241, 0.5)"
        />
      </Animated.View>
    )
  }

  // ------ Tier 2: Progressive blur (MaskedView + gradient + BlurView) ------
  if (BlurView && MaskedView && LinearGradient) {
    const Mask = MaskedView
    const Gradient = LinearGradient
    const Blur = BlurView

    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.overlay, { height: totalHeight, opacity }]}
      >
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
            tint="systemUltraThinMaterial"
            style={StyleSheet.absoluteFill}
          />
        </Mask>
      </Animated.View>
    )
  }

  // No progressive blur available
  return null
}

// ---------------------------------------------------------------------------
// HeaderBackgroundFallback
// ---------------------------------------------------------------------------

export function HeaderBackgroundFallback() {
  if (BlurView) {
    const Blur = BlurView
    try {
      return (
        <Blur
          style={StyleSheet.absoluteFill}
          intensity={35}
          tint="systemUltraThinMaterial"
        />
      )
    } catch {
      /* fall through */
    }
  }
  return <View style={[StyleSheet.absoluteFill, styles.translucentHeader]} />
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
    backgroundColor: 'rgba(246, 244, 241, 0.65)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
})
