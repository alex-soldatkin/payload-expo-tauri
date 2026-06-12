/**
 * SwipeToDeleteRow — platform-default swipe-left-to-delete for list rows
 * (document list cards, tablet table rows, array/blocks row cards).
 *
 * IMPLEMENTATION TIER: pure RN PanResponder — the codebase's proven
 * BottomSheet / Toast / InspectorPanel pattern. NOT react-native-gesture-
 * handler: both legacy Swipeable and ReanimatedSwipeable crashed on iOS 26
 * with PanGestureHandler errors in this app (memory-bank/013_ui-patterns.md
 * "Delete Actions"), and document list rows now live inside the custom
 * ScrollablePreview native trigger (UILongPressGestureRecognizer +
 * UITapGestureRecognizer) whose interplay with RNGH's native pan
 * recognizers is unverified on-device. PanResponder rides RN's own JS
 * responder pipeline, which demonstrably coexists with the peek module:
 * a horizontal pan exceeds the native recognizers' movement tolerance and
 * fails them, vertical pans stay with the enclosing FlatList, and clean
 * taps still reach row press handlers.
 *
 * Behaviour (iOS Mail style, identical on Android):
 *  - Left drag reveals a full-height destructive action anchored to the
 *    right edge (lucide Trash2 + white label on the palette destructive red)
 *  - Release past 30% of the row width OR a fast left flick → confirmation
 *    dialog (Alert.alert, destructive confirm); cancel springs the row back
 *  - Release past half the action width → row snaps open (88pt)
 *  - Tap on the revealed action → same confirmation
 *  - Tap on the row content while open → closes the row. The catch overlay
 *    is a JS sibling ABOVE the children, so taps spent closing never reach
 *    native trigger recognizers underneath (their hit-tested view is the
 *    overlay, which is outside the trigger subtree)
 *  - Only one row open at a time (module-level registry). Screens should
 *    gate their own tap/navigation handlers with `closeOpenSwipeRow()` —
 *    if it returns true the tap was spent closing a row
 *  - `canDelete={false}` keeps the gesture but routes the trigger to
 *    `onDeleteBlocked` (e.g. array/blocks minRows reached)
 *  - Rubber-bands near the full-width extreme; right-drag clamps at rest
 *
 * MUST stay free of @expo/ui — SwiftUI hosts crash inside RN gesture trees
 * (memory-bank convention). Lucide icons only.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { defaultTheme as t } from './theme'
import { useListColors } from './hooks/useListColors'

let TrashIcon: React.ComponentType<{ size: number; color: string }> | null = null
try {
  TrashIcon = require('lucide-react-native').Trash2
} catch {
  /* lucide-react-native not available — label-only action */
}

/** Width of the snapped-open action area (pt). */
const ACTION_WIDTH = 88
/** Fraction of the row width past which a release counts as a full swipe. */
const FULL_SWIPE_FRACTION = 0.3
/** Left fling velocity (px/ms) that counts as a full swipe. */
const FLICK_VELOCITY = 0.5
/** Gentler left velocity that snaps the row open on release. */
const OPEN_VELOCITY = 0.3

// ---------------------------------------------------------------------------
// Open-row registry — only one row may be open at a time
// ---------------------------------------------------------------------------

type OpenRowHandle = { close: () => void }

let currentOpenRow: OpenRowHandle | null = null

/**
 * Close whichever swipe row is currently open. Returns true when a row WAS
 * open — callers (row onPress, peek onPrimaryAction) should treat that as
 * "this tap was spent closing the row" and skip their own action.
 */
export const closeOpenSwipeRow = (): boolean => {
  if (currentOpenRow) {
    const row = currentOpenRow
    currentOpenRow = null
    row.close()
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type SwipeToDeleteRowProps = {
  children: React.ReactNode
  /** Called AFTER the user confirms the destructive alert. */
  onDelete: () => void
  /** Gate the whole gesture (e.g. selection mode / disabled form). */
  enabled?: boolean
  /**
   * When false the swipe still reveals/triggers, but instead of the confirm
   * dialog `onDeleteBlocked` fires (e.g. minRows reached on arrays/blocks).
   */
  canDelete?: boolean
  /** Called instead of the confirm dialog when `canDelete` is false. */
  onDeleteBlocked?: () => void
  confirmTitle?: string
  confirmMessage?: string
  /** Label on the revealed action AND the destructive confirm button. */
  actionLabel?: string
  /** Outer container style — row margins belong here, not on children. */
  style?: StyleProp<ViewStyle>
  /**
   * Style for the revealed action layer — use to align the red area with
   * the visible card (borderRadius / margin insets matching the card).
   */
  actionStyle?: StyleProp<ViewStyle>
}

export const SwipeToDeleteRow: React.FC<SwipeToDeleteRowProps> = ({
  children,
  onDelete,
  enabled = true,
  canDelete = true,
  onDeleteBlocked,
  confirmTitle = 'Delete',
  confirmMessage = 'Are you sure?',
  actionLabel = 'Delete',
  style,
  actionStyle,
}) => {
  const { colors } = useListColors()
  const [open, setOpen] = useState(false)

  const translateX = useRef(new Animated.Value(0)).current

  // Refs keep the once-created PanResponder closure-free (BottomSheet pattern)
  const widthRef = useRef(0)
  const openRef = useRef(false)
  const startOffsetRef = useRef(0)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const canDeleteRef = useRef(canDelete)
  canDeleteRef.current = canDelete
  const propsRef = useRef({ onDelete, onDeleteBlocked, confirmTitle, confirmMessage, actionLabel })
  propsRef.current = { onDelete, onDeleteBlocked, confirmTitle, confirmMessage, actionLabel }

  const setOpenState = (next: boolean) => {
    openRef.current = next
    setOpen(next)
  }

  const spring = (toValue: number) => {
    Animated.spring(translateX, {
      toValue,
      damping: 24,
      stiffness: 280,
      mass: 0.7,
      useNativeDriver: false, // width interpolation + JS-driven pan updates
    }).start()
  }

  const settleClosed = () => {
    if (currentOpenRow === handleRef.current) currentOpenRow = null
    setOpenState(false)
    spring(0)
  }

  const settleOpen = () => {
    setOpenState(true)
    currentOpenRow = handleRef.current
    spring(-ACTION_WIDTH)
  }

  /** Reset instantly (no spring) — used right before onDelete so index-keyed
   * rows (arrays/blocks) don't hand an open offset to the row that shifts
   * into this instance after removal. */
  const resetClosed = () => {
    if (currentOpenRow === handleRef.current) currentOpenRow = null
    setOpenState(false)
    translateX.setValue(0)
  }

  const requestDelete = () => {
    const p = propsRef.current
    if (!canDeleteRef.current) {
      p.onDeleteBlocked?.()
      settleClosedRef.current()
      return
    }
    Alert.alert(
      p.confirmTitle,
      p.confirmMessage,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => settleClosedRef.current() },
        {
          text: p.actionLabel,
          style: 'destructive',
          onPress: () => {
            resetClosedRef.current()
            propsRef.current.onDelete()
          },
        },
      ],
      // Android: tapping outside / back button springs the row shut too
      { cancelable: true, onDismiss: () => settleClosedRef.current() },
    )
  }

  // Stable refs so the registry handle + PanResponder never go stale
  const settleClosedRef = useRef(settleClosed)
  settleClosedRef.current = settleClosed
  const settleOpenRef = useRef(settleOpen)
  settleOpenRef.current = settleOpen
  const resetClosedRef = useRef(resetClosed)
  resetClosedRef.current = resetClosed
  const requestDeleteRef = useRef(requestDelete)
  requestDeleteRef.current = requestDelete

  const handleRef = useRef<OpenRowHandle>({ close: () => settleClosedRef.current() })

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        // Claim only clearly-horizontal pans; left-only while closed so the
        // FlatList keeps vertical scrolling and taps reach row handlers.
        onMoveShouldSetPanResponder: (_evt, gs) => {
          if (!enabledRef.current) return false
          if (Math.abs(gs.dx) <= 6 || Math.abs(gs.dx) <= Math.abs(gs.dy) * 1.4) return false
          return openRef.current || gs.dx < 0
        },
        onPanResponderGrant: () => {
          // Opening a new row closes whichever one is currently open
          if (currentOpenRow && currentOpenRow !== handleRef.current) {
            const row = currentOpenRow
            currentOpenRow = null
            row.close()
          }
          startOffsetRef.current = openRef.current ? -ACTION_WIDTH : 0
          translateX.stopAnimation()
        },
        onPanResponderMove: (_evt, gs) => {
          let x = startOffsetRef.current + gs.dx
          if (x > 0) x = 0
          const maxLeft = -Math.max(widthRef.current * 0.9, ACTION_WIDTH)
          if (x < maxLeft) x = maxLeft + (x - maxLeft) * 0.18 // rubber-band
          translateX.setValue(x)
        },
        onPanResponderRelease: (_evt, gs) => {
          const w = widthRef.current || ACTION_WIDTH * 3
          let x = startOffsetRef.current + gs.dx
          if (x > 0) x = 0
          // Right fling closes
          if (gs.vx >= OPEN_VELOCITY) {
            settleClosedRef.current()
            return
          }
          const fullSwipe =
            x <= -w * FULL_SWIPE_FRACTION ||
            (gs.vx <= -FLICK_VELOCITY && x <= -ACTION_WIDTH * 0.5)
          if (fullSwipe) {
            settleOpenRef.current()
            requestDeleteRef.current()
            return
          }
          if (x <= -ACTION_WIDTH * 0.5 || gs.vx <= -OPEN_VELOCITY) {
            settleOpenRef.current()
            return
          }
          settleClosedRef.current()
        },
        // Keep the gesture once claimed — vertical wobble must not hand the
        // row back to the scroll view mid-swipe.
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
          if (openRef.current) settleOpenRef.current()
          else settleClosedRef.current()
        },
      }),
    [translateX],
  )

  // Force-close when the gesture gets disabled (e.g. entering selection mode)
  useEffect(() => {
    if (!enabled && openRef.current) resetClosedRef.current()
  }, [enabled])

  // Unmount cleanup — never leave a dangling registry entry
  useEffect(
    () => () => {
      if (currentOpenRow === handleRef.current) currentOpenRow = null
    },
    [],
  )

  // Revealed area tracks the drag 1:1 (width-anim instead of a full-bleed
  // backdrop — translucent liquid-glass cards must never sit OVER red).
  const revealWidth = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-1, 0],
        outputRange: [1, 0],
        extrapolateLeft: 'extend',
        extrapolateRight: 'clamp',
      }),
    [translateX],
  )
  const revealOpacity = useMemo(
    () =>
      translateX.interpolate({
        inputRange: [-12, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [translateX],
  )

  if (!enabled) {
    return <View style={style}>{children}</View>
  }

  return (
    <View
      style={style}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width
      }}
    >
      {/* Destructive action layer — revealed behind the sliding content */}
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          styles.actionLayer,
          { backgroundColor: colors.destructive },
          actionStyle,
          { width: revealWidth, opacity: revealOpacity },
        ]}
      >
        <Pressable
          style={styles.actionButton}
          onPress={() => requestDeleteRef.current()}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          {TrashIcon ? <TrashIcon size={20} color="#ffffff" /> : null}
          <Text style={styles.actionText} numberOfLines={1}>
            {actionLabel}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Sliding row content */}
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
        {/* While open: catch taps on the content and just close the row.
            Sibling ABOVE children → native trigger recognizers underneath
            never receive these touches. */}
        {open && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => settleClosedRef.current()}
            accessibilityRole="button"
            accessibilityLabel="Close row actions"
          />
        )}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  actionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  actionButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionText: {
    color: '#ffffff',
    fontSize: t.fontSize.xs,
    fontWeight: '600',
  },
})
