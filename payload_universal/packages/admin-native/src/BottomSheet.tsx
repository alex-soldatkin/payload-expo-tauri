import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
  useWindowDimensions,
} from 'react-native'
import { PreviewContextProvider } from './contexts/PreviewContext'

// ---------------------------------------------------------------------------
// Optional deps — loaded dynamically (graceful three-tier background:
// GlassView (iOS 26+) → BlurView → solid View)
// ---------------------------------------------------------------------------

// Optional: BlurView for translucent sheet background
let BlurView: React.ComponentType<{
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

// Optional: GlassView for liquid glass sheet background on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

// ---------------------------------------------------------------------------
// Detents
// ---------------------------------------------------------------------------

/**
 * A sheet snap point: the system detents `'medium'` / `'large'` (matching
 * SwiftUI's presentationDetents semantics) or a screen-height fraction (0–1).
 */
export type SheetDetent = 'medium' | 'large' | number

const MEDIUM_FRACTION = 0.5
// 'large' leaves a visible gap at the top, like a system pageSheet
const LARGE_FRACTION = 0.93
const MIN_FRACTION = 0.15

const resolveFraction = (detent: SheetDetent): number => {
  if (detent === 'medium') return MEDIUM_FRACTION
  if (detent === 'large') return LARGE_FRACTION
  return Math.min(Math.max(detent, MIN_FRACTION), LARGE_FRACTION)
}

// Spring curves tuned to feel like the UIKit sheet presentation
const SPRING_IN = { damping: 22, stiffness: 220, mass: 0.9, useNativeDriver: true } as const
const SPRING_OUT = { damping: 24, stiffness: 280, mass: 0.9, useNativeDriver: true } as const

/** iOS-style rubber band: diminishing returns as the overdrag grows. */
const rubberBand = (overdrag: number, dimension: number): number =>
  (1 - 1 / ((overdrag * 0.55) / dimension + 1)) * dimension * 0.5

type Props = {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  /**
   * Legacy single-height API: height as a fraction of screen height (0–1).
   * Treated as a single detent. Defaults to 0.5 when `detents` is also omitted.
   */
  height?: number
  /**
   * Detent snap points the sheet can rest at (drag the grabber to move
   * between them). Defaults to `[height]` when `height` is provided,
   * otherwise `['medium', 'large']`. The sheet opens at the smallest detent.
   */
  detents?: SheetDetent[]
}

/**
 * Bottom sheet using transparent Modal + Animated slide-up, styled to match
 * the native iOS sheet presentation: detent snap points (medium/large),
 * rubber-banding past the top detent, velocity-projected snapping, a system
 * grabber, keyboard avoidance, and a liquid-glass/blur background.
 *
 * Deliberately NOT the SwiftUI/Jetpack-Compose native BottomSheet: those
 * host native children only — embedding our React Native content would
 * require RNHostView (not in the component registry) and has unresolved
 * scroll-gesture/keyboard behaviour. The JS sheet keeps RN children
 * (FlatLists, TextInputs) first-class on both platforms.
 *
 * The drag handle at the top captures touches in the capture phase
 * so the PanResponder always works there regardless of child views.
 * Content area scroll takes priority (FlatList, ScrollView, etc.).
 */
export const BottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  children,
  height,
  detents,
}) => {
  const { height: screenHeight } = useWindowDimensions()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  // ── Detent geometry ──
  // The sheet container is laid out at the LARGEST detent height and anchored
  // to the bottom; translateY pushes it down so exactly the current detent's
  // height stays on screen. offset(i) = maxHeight - height(i); 0 = fully open.
  const fractions = useMemo(() => {
    const source: SheetDetent[] =
      detents && detents.length > 0
        ? detents
        : height != null
          ? [height]
          : ['medium', 'large']
    const resolved = Array.from(new Set(source.map(resolveFraction))).sort((a, b) => a - b)
    return resolved.length > 0 ? resolved : [MEDIUM_FRACTION]
  }, [detents, height])

  const detentHeights = useMemo(
    () => fractions.map((f) => f * screenHeight),
    [fractions, screenHeight],
  )
  const maxHeight = detentHeights[detentHeights.length - 1]
  const offsets = useMemo(
    () => detentHeights.map((h) => maxHeight - h),
    [detentHeights, maxHeight],
  )
  const closedOffset = maxHeight + 60

  // Current detent index (0 = smallest). State drives the content height;
  // the ref keeps the PanResponder closure-free.
  const [detentIndex, setDetentIndex] = useState(0)
  const detentIndexRef = useRef(0)

  const translateY = useRef(new Animated.Value(screenHeight)).current

  // Refs so the once-created PanResponder always sees fresh values
  const offsetsRef = useRef(offsets)
  offsetsRef.current = offsets
  const detentHeightsRef = useRef(detentHeights)
  detentHeightsRef.current = detentHeights
  const maxHeightRef = useRef(maxHeight)
  maxHeightRef.current = maxHeight
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  const handleClose = useCallback(() => {
    Keyboard.dismiss()
    onClose()
  }, [onClose])
  const handleCloseRef = useRef(handleClose)
  handleCloseRef.current = handleClose

  const snapTo = useCallback(
    (index: number) => {
      const target = offsetsRef.current[index]
      if (target == null) return
      detentIndexRef.current = index
      setDetentIndex(index)
      Animated.spring(translateY, { toValue: target, ...SPRING_IN }).start()
    },
    [translateY],
  )
  const snapToRef = useRef(snapTo)
  snapToRef.current = snapTo

  // ── Present / dismiss ──
  const wasVisible = useRef(false)
  useEffect(() => {
    if (visible) {
      if (!wasVisible.current) {
        // Opening: always start at the smallest detent
        detentIndexRef.current = 0
        setDetentIndex(0)
      }
      const idx = Math.min(detentIndexRef.current, offsets.length - 1)
      Animated.spring(translateY, { toValue: offsets[idx], ...SPRING_IN }).start()
    } else {
      Animated.spring(translateY, { toValue: closedOffset, ...SPRING_OUT }).start()
    }
    wasVisible.current = visible
  }, [visible, translateY, offsets, closedOffset])

  // ── Keyboard: expand to the largest detent so the focused input and the
  // KeyboardAvoidingView have room to work with ──
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const sub = Keyboard.addListener(event, () => {
      if (!visibleRef.current) return
      const last = offsetsRef.current.length - 1
      if (last > 0 && detentIndexRef.current !== last) {
        snapToRef.current(last)
      }
    })
    return () => sub.remove()
  }, [])

  // ── Handle-area PanResponder — captures in the capture phase so it always
  // works regardless of BlurView or other overlapping children. Drag moves
  // the sheet between detents; rubber-bands past the top; velocity-projects
  // the release to pick a snap target or dismiss. ──
  const baseOffsetRef = useRef(0)
  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        baseOffsetRef.current =
          offsetsRef.current[
            Math.min(detentIndexRef.current, offsetsRef.current.length - 1)
          ] ?? 0
      },
      onPanResponderMove: (_, gs) => {
        let next = baseOffsetRef.current + gs.dy
        if (next < 0) {
          // Above the top detent — rubber-band with progressive resistance
          next = -rubberBand(-next, maxHeightRef.current)
        }
        translateY.setValue(next)
      },
      onPanResponderRelease: (_, gs) => {
        const currentOffsets = offsetsRef.current
        const heights = detentHeightsRef.current
        const current = baseOffsetRef.current + gs.dy
        // Project the gesture forward (iOS-style deceleration projection)
        const projected = current + gs.vy * 180

        const smallestOffset = currentOffsets[0]
        const smallestHeight = heights[0]
        const flickedDown = gs.vy > 1.2 && gs.dy > 24
        if (projected > smallestOffset + smallestHeight * 0.3 || flickedDown) {
          handleCloseRef.current()
          return
        }

        // Snap to the nearest detent by projected position
        let best = 0
        let bestDist = Number.POSITIVE_INFINITY
        for (let i = 0; i < currentOffsets.length; i++) {
          const dist = Math.abs(currentOffsets[i] - projected)
          if (dist < bestDist) {
            bestDist = dist
            best = i
          }
        }
        snapToRef.current(best)
      },
    }),
  ).current

  const visibleHeight = detentHeights[Math.min(detentIndex, detentHeights.length - 1)]

  // Adaptive colours (never hardcode light — follow the system scheme)
  const solidBg = isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.88)'
  const grabberColor = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.18)'

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <View style={styles.backdropFill} />
      </Pressable>
      <Animated.View
        style={[styles.sheet, { height: maxHeight, transform: [{ translateY }] }]}
      >
        {/* Background: liquid glass (iOS 26+) → blur → solid fallback.
            One layer only — never double-apply glass treatments. */}
        {liquidGlassAvailable && GlassView ? (
          <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
        ) : BlurView && Platform.OS === 'ios' ? (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={40}
            tint="systemUltraThinMaterial"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.sheetFallbackBg, { backgroundColor: solidBg }]} />
        )}
        {/* Only the current detent's height is interactive/visible */}
        <View style={{ height: visibleHeight }}>
          {/* Grabber — dedicated PanResponder so it always captures */}
          <Animated.View style={styles.handleRow} {...handlePan.panHandlers}>
            <View style={[styles.handleBar, { backgroundColor: grabberColor }]} />
          </Animated.View>
          <KeyboardAvoidingView
            style={styles.kav}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.content}>
              <PreviewContextProvider value={true}>
                {children}
              </PreviewContextProvider>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  backdropFill: { flex: 1 },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 20,
  },
  sheetFallbackBg: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 14,
  },
  handleBar: { width: 36, height: 5, borderRadius: 3 },
  kav: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
})
