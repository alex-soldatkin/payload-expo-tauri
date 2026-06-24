// ---------------------------------------------------------------------------
// Pinch-to-zoom (two-finger, focal-point anchored)
// ---------------------------------------------------------------------------
//
// Two phases (Apple-Maps pattern): a CHEAP visual scaleX transform on the
// timeline content at 60fps WITHOUT re-layout, then on release commit the
// new pxPerDay through `onPxPerDayChange` and compensate scrollX so the
// focal date stays under the fingers.
//
// FOCAL-ANCHOR MATH (RN scaleX is CENTER-anchored about the content view):
//   A content point f renders, under center-anchored scaleX `s` plus an
//   added translateX `tx`, at content-x  f*s + (W/2)*(1−s) + tx  (W = full
//   timeline width). Subtract the (locked) scroll offset for its viewport-x.
//   To keep f fixed in the viewport we need that to equal f, so
//     tx = (1 − s) * (f − W/2).
//   On release the committed ratio is sCommit = newPx / basePx (after the
//   MIN/MAX clamp, which can differ from the raw finger ratio). The focal
//   date sat at f in the OLD scale; at the new scale the same date is at
//   f*sCommit, so to hold it under the fingers the new offset is
//     scrollXnew = scrollX0 + f*(sCommit − 1)
//   applied synchronously once the wider/narrower content size lands
//   (handleContentSizeChange — the same jump-free moment the left-extension
//   uses), with the visual transform reset to identity in the same commit.
import { useCallback, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder } from 'react-native'
import type { GestureResponderEvent } from 'react-native'

import { GANTT_MAX_PX_PER_DAY, GANTT_MIN_PX_PER_DAY } from '../../types'

export type UsePinchZoomArgs = {
  px: number
  pxRef: React.MutableRefObject<number>
  scrollXRef: React.MutableRefObject<number>
  timelineWidthRef: React.MutableRefObject<number>
  dragLockRef: React.MutableRefObject<boolean>
  onPxPerDayChange?: (px: number) => void
}

export type UsePinchZoom = {
  pinchActive: boolean
  pinchScaleX: Animated.Value
  pinchTranslateX: Animated.Value
  pinchResponder: ReturnType<typeof PanResponder.create>
  /**
   * Absolute scrollX to restore once the committed content size lands
   * (NaN = no pending zoom compensation). Consumed by the chart's
   * onContentSizeChange — the jump-free moment.
   */
  pendingZoomScrollXRef: React.MutableRefObject<number>
}

export function usePinchZoom({
  px,
  pxRef,
  scrollXRef,
  timelineWidthRef,
  dragLockRef,
  onPxPerDayChange,
}: UsePinchZoomArgs): UsePinchZoom {
  const [pinchActive, setPinchActive] = useState(false)
  const pinchActiveRef = useRef(false)
  const pinchScaleX = useRef(new Animated.Value(1)).current
  const pinchTranslateX = useRef(new Animated.Value(0)).current
  const pinchStartDistRef = useRef(0)
  const pinchFocalRef = useRef(0) // focal content-x (untransformed)
  const pinchScrollX0Ref = useRef(0) // scroll offset at gesture start
  const pinchBasePxRef = useRef(px) // px column width at gesture start
  const pinchRatioRef = useRef(1) // latest live ratio (post-clamp preview)
  // Absolute scrollX to restore once the committed content size lands
  // (NaN = no pending zoom compensation).
  const pendingZoomScrollXRef = useRef(Number.NaN)

  // Stable ref so the once-created pinch responder commits through the latest
  // screen callback without re-creating the responder.
  const onPxPerDayChangeRef = useRef(onPxPerDayChange)
  onPxPerDayChangeRef.current = onPxPerDayChange

  const twoTouchDistance = useCallback((e: GestureResponderEvent): number => {
    const ts = e.nativeEvent.touches
    if (ts.length < 2) return 0
    const dx = ts[0].pageX - ts[1].pageX
    const dy = ts[0].pageY - ts[1].pageY
    return Math.hypot(dx, dy)
  }, [])

  const twoTouchFocalContentX = useCallback((e: GestureResponderEvent): number => {
    // locationX is relative to the responder target (the timeline content
    // View), so it IS the untransformed content-x — the transform we apply
    // lives on a child wrapper inside this same View.
    const ts = e.nativeEvent.touches
    if (ts.length < 2) return scrollXRef.current
    return (ts[0].locationX + ts[1].locationX) / 2
  }, [scrollXRef])

  // Commit the pinch: clamp the new px, queue the focal-anchored scroll
  // compensation for the next content-size commit, reset the visual transform
  // and hand the new density to the screen. Idempotent (release + terminate
  // can race) via the pinchActiveRef gate.
  const commitPinch = useCallback(() => {
    if (!pinchActiveRef.current) return
    pinchActiveRef.current = false
    const base = pinchBasePxRef.current
    const sCommit = pinchRatioRef.current
    const newPx = Math.max(
      GANTT_MIN_PX_PER_DAY,
      Math.min(GANTT_MAX_PX_PER_DAY, base * sCommit),
    )
    const ratio = newPx / base
    const f = pinchFocalRef.current
    // Hold the focal date under the fingers at the new scale.
    const scrollXnew = Math.max(0, pinchScrollX0Ref.current + f * (ratio - 1))
    // Reset the visual transform now; the layout jump to newPx (and the
    // scroll compensation) lands in handleContentSizeChange.
    pinchScaleX.setValue(1)
    pinchTranslateX.setValue(0)
    setPinchActive(false)
    if (Math.abs(newPx - base) < 0.5) return // no meaningful change
    pendingZoomScrollXRef.current = scrollXnew
    onPxPerDayChangeRef.current?.(newPx)
  }, [pinchScaleX, pinchTranslateX])

  const pinchResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim ONLY a genuine two-finger gesture — single-touch scroll, bar
        // drags, handle drags and the static-hold peek all start with ONE
        // touch and are never intercepted. A bar drag in flight (dragLock)
        // hard-blocks the claim defensively.
        onStartShouldSetPanResponderCapture: (e) =>
          !dragLockRef.current && e.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponderCapture: (e) =>
          !dragLockRef.current &&
          !pinchActiveRef.current &&
          e.nativeEvent.touches.length >= 2,
        onPanResponderGrant: (e) => {
          const dist = twoTouchDistance(e)
          if (dist <= 0) return
          pinchActiveRef.current = true
          pinchStartDistRef.current = dist
          pinchFocalRef.current = twoTouchFocalContentX(e)
          pinchScrollX0Ref.current = scrollXRef.current
          pinchBasePxRef.current = pxRef.current
          pinchRatioRef.current = 1
          pinchScaleX.setValue(1)
          pinchTranslateX.setValue(0)
          setPinchActive(true)
        },
        onPanResponderMove: (e) => {
          if (!pinchActiveRef.current) return
          const dist = twoTouchDistance(e)
          if (dist <= 0 || pinchStartDistRef.current <= 0) return
          const base = pinchBasePxRef.current
          // Clamp the live ratio to the committable px range so the preview
          // never promises a zoom the commit can't keep.
          const rawRatio = dist / pinchStartDistRef.current
          const clampedPx = Math.max(
            GANTT_MIN_PX_PER_DAY,
            Math.min(GANTT_MAX_PX_PER_DAY, base * rawRatio),
          )
          const s = clampedPx / base
          pinchRatioRef.current = s
          const f = pinchFocalRef.current
          const w = timelineWidthRef.current
          pinchScaleX.setValue(s)
          pinchTranslateX.setValue((1 - s) * (f - w / 2))
        },
        onPanResponderRelease: () => commitPinch(),
        onPanResponderTerminate: () => commitPinch(),
        onPanResponderTerminationRequest: () => false,
      }),
    // commitPinch + the helpers are stable useCallbacks and the Animated
    // values / state setter are refs/stable, so the responder is created once.
    [
      commitPinch,
      twoTouchDistance,
      twoTouchFocalContentX,
      pinchScaleX,
      pinchTranslateX,
      dragLockRef,
      scrollXRef,
      pxRef,
      timelineWidthRef,
    ],
  )

  return {
    pinchActive,
    pinchScaleX,
    pinchTranslateX,
    pinchResponder,
    pendingZoomScrollXRef,
  }
}
