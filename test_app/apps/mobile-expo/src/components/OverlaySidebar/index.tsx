/**
 * OverlaySidebar — swipe-from-left-edge slide-over navigation
 * (Apple Notes/Mail convention) + the shared sidebar nav content.
 *
 * `SidebarContent` is the grouped collections / globals / account nav tree —
 * ONE source rendered by both the persistent tablet sidebar
 * (app/(admin)/_layout.tsx) and the overlay panel here (see ./SidebarContent).
 *
 * Gesture arbitration (critical — do not regress):
 *
 *   OPEN — the wrapper View around the tab content carries a PanResponder
 *   that claims in the CAPTURE phase only when ALL of these hold:
 *     - the overlay is enabled (persistent sidebar hidden, width < 1024)
 *       and currently closed
 *     - the focused route is a tab ROOT ('/', '/collections', '/globals',
 *       '/account' exactly) — on any deeper path iOS's interactive-pop
 *       back-swipe owns the left edge, so the open gesture is disarmed
 *     - the gesture STARTED inside the ~24pt left-edge strip
 *       (start X = pageX − dx), single touch only
 *     - the move is decisively horizontal-right (dx > 6 && dx > |dy|)
 *   Why a logical strip on the content's PARENT instead of a physical
 *   overlay strip View: in RN's responder system unclaimed touches do NOT
 *   fall through to sibling views underneath, so a physical strip would
 *   dead-zone taps on the left 24pt of every row. The capture test on the
 *   wrapper is transparent — taps and vertical scrolls flow to children
 *   untouched, and only armed horizontal edge-moves are claimed.
 *
 *   DISMISS — while open, the panel's own PanResponder claims horizontal
 *   drags in the capture phase (|dx| > 6 && |dx| > 1.4·|dy|) so the nav
 *   ScrollView inside keeps vertical scrolling. Drag-left follows the
 *   finger; drag-right past fully-open rubber-bands (BottomSheet curve);
 *   release uses iOS-style velocity projection (pos + vx·180) with a
 *   flick shortcut. Backdrop tap and nav-item taps (navigate + close)
 *   also dismiss.
 *
 *   Springs use the native driver; backdrop opacity is interpolated from
 *   the panel position (one Animated.Value drives everything).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  BackHandler,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useListColors } from '@payload-universal/admin-native'

import {
  EDGE_WIDTH,
  MAX_PANEL_WIDTH,
  SPRING,
  TAB_ROOT_PATHS,
  rubberBand,
} from './constants'
import { BlurView, GlassView, liquidGlassAvailable } from './native'
import { SidebarContent } from './SidebarContent'
import { overlayStyles } from './styles'

export { SidebarContent } from './SidebarContent'

// ===========================================================================
//  Overlay: edge-capture wrapper + dim backdrop + sliding glass panel
// ===========================================================================

export function OverlaySidebar({
  enabled,
  children,
}: {
  /** False when the persistent sidebar is showing (width >= 1024). */
  enabled: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { dark, colors: c } = useListColors()

  const panelWidth = Math.min(MAX_PANEL_WIDTH, Math.round(width * 0.85))

  // Armed ONLY on tab roots — deeper paths belong to the system back-swipe.
  const normalized =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const armed = TAB_ROOT_PATHS.has(normalized || '/')

  /** Overlay subtree mounted (true from drag-start until close settles). */
  const [visible, setVisible] = useState(false)

  // Refs so the once-created PanResponders always see fresh values
  // (same pattern as admin-native/BottomSheet.tsx)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const armedRef = useRef(armed)
  armedRef.current = armed
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const panelWidthRef = useRef(panelWidth)
  panelWidthRef.current = panelWidth
  /** Settled-open flag — gates the panel responder and the edge responder. */
  const openRef = useRef(false)
  const dragBaseRef = useRef(0)

  // Panel position: -panelWidth (off-screen) … 0 (fully open).
  const translateX = useRef(new Animated.Value(-MAX_PANEL_WIDTH)).current

  /** Clamp a drag position: hard stop off-screen, rubber-band past open. */
  const clampPosition = useCallback((p: number) => {
    const w = panelWidthRef.current
    if (p > 0) return rubberBand(p, w)
    if (p < -w) return -w
    return p
  }, [])

  const settleOpen = useCallback(() => {
    openRef.current = true
    setVisible(true)
    Animated.spring(translateX, { toValue: 0, ...SPRING }).start()
  }, [translateX])

  const close = useCallback(() => {
    openRef.current = false
    Animated.spring(translateX, {
      toValue: -panelWidthRef.current,
      ...SPRING,
    }).start(({ finished }) => {
      // Unmount only if nothing re-opened while the spring ran
      if (finished && !openRef.current) setVisible(false)
    })
  }, [translateX])
  const closeRef = useRef(close)
  closeRef.current = close

  // ── OPEN: edge-capture PanResponder on the content wrapper ──
  const edgePan = useRef(
    PanResponder.create({
      // Never claim on touch start — taps always reach the content
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (evt, gs) => {
        if (!enabledRef.current || !armedRef.current) return false
        if (openRef.current || visibleRef.current) return false
        if (gs.numberActiveTouches !== 1) return false
        // Where the gesture STARTED (pageX is the current position)
        const startX = evt.nativeEvent.pageX - gs.dx
        return startX <= EDGE_WIDTH && gs.dx > 6 && gs.dx > Math.abs(gs.dy)
      },
      onPanResponderGrant: (_evt, gs) => {
        dragBaseRef.current = -panelWidthRef.current
        setVisible(true)
        translateX.setValue(clampPosition(dragBaseRef.current + gs.dx))
      },
      onPanResponderMove: (_evt, gs) => {
        translateX.setValue(clampPosition(dragBaseRef.current + gs.dx))
      },
      onPanResponderRelease: (_evt, gs) => {
        const w = panelWidthRef.current
        // iOS-style deceleration projection
        const projected = dragBaseRef.current + gs.dx + gs.vx * 180
        const flickOpen = gs.vx > 1.2 && gs.dx > 24
        if (flickOpen || projected > -w * 0.5) settleOpen()
        else closeRef.current()
      },
      onPanResponderTerminate: () => closeRef.current(),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current

  // ── DISMISS: the open panel owns horizontal drags; vertical scrolling of
  // the nav list inside still works (claim only when |dx| > 1.4·|dy|). ──
  const panelPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_evt, gs) => {
        if (!openRef.current) return false
        if (gs.numberActiveTouches !== 1) return false
        return Math.abs(gs.dx) > 6 && Math.abs(gs.dx) > 1.4 * Math.abs(gs.dy)
      },
      onPanResponderGrant: () => {
        dragBaseRef.current = 0
      },
      onPanResponderMove: (_evt, gs) => {
        translateX.setValue(clampPosition(dragBaseRef.current + gs.dx))
      },
      onPanResponderRelease: (_evt, gs) => {
        const w = panelWidthRef.current
        const projected = dragBaseRef.current + gs.dx + gs.vx * 180
        const flickClosed = gs.vx < -1.2 && gs.dx < -24
        if (flickClosed || projected < -w * 0.35) closeRef.current()
        else Animated.spring(translateX, { toValue: 0, ...SPRING }).start()
      },
      onPanResponderTerminate: () => {
        // Someone stole the gesture — settle back to the open position
        if (openRef.current) {
          Animated.spring(translateX, { toValue: 0, ...SPRING }).start()
        }
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current

  // Persistent sidebar appeared (rotation / window resize) → retire instantly
  useEffect(() => {
    if (!enabled && visible) {
      openRef.current = false
      translateX.setValue(-panelWidthRef.current)
      setVisible(false)
    }
  }, [enabled, visible, translateX])

  // Android hardware back closes the overlay
  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (openRef.current) {
        closeRef.current()
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [visible])

  // Backdrop dim follows the panel position
  const backdropOpacity = translateX.interpolate({
    inputRange: [-panelWidth, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })

  return (
    <View style={overlayStyles.wrapper} {...edgePan.panHandlers}>
      {children}

      {visible && (
        <>
          {/* Dim backdrop — tap to dismiss */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              overlayStyles.backdrop,
              { opacity: backdropOpacity },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => closeRef.current()}
              accessibilityRole="button"
              accessibilityLabel="Close navigation"
            />
          </Animated.View>

          {/* Sliding glass panel */}
          <Animated.View
            style={[
              overlayStyles.panel,
              {
                width: panelWidth,
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
                borderRightColor: c.hairline,
                transform: [{ translateX }],
              },
            ]}
            accessibilityViewIsModal
            {...panelPan.panHandlers}
          >
            {/* Background: liquid glass (iOS 26+) → blur → solid fallback.
                One layer only — never double-apply glass treatments. */}
            {liquidGlassAvailable && GlassView ? (
              <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
            ) : BlurView ? (
              <BlurView
                style={StyleSheet.absoluteFill}
                intensity={35}
                tint="systemUltraThinMaterial"
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: dark
                      ? 'rgba(30,30,30,0.96)'
                      : 'rgba(249,249,249,0.96)',
                  },
                ]}
              />
            )}

            <SidebarContent onNavigate={() => closeRef.current()} />
          </Animated.View>
        </>
      )}
    </View>
  )
}
