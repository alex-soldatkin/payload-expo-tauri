/**
 * useScanController — all of ScanLookupSheet's stateful behaviour:
 * presence + spring in/out, camera/permission state, debounced scan handling,
 * success flash, and the animated scanning-line loop. Pure mechanical
 * extraction — same effects, same timers, same callbacks.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Linking } from 'react-native'

import { cameraModule, useCameraPermissionsSafe } from '../nativeDeps'
import { DEBOUNCE_MS, RETICLE, SPRING_IN, SPRING_OUT, SUCCESS_FIRE_MS } from '../constants'

export function useScanController(visible: boolean, onScanned: (value: string) => void) {
  // ── Presence + spring in/out (Modal stays mounted through the exit) ──
  const [rendered, setRendered] = useState(visible)
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (visible) {
      setRendered(true)
      Animated.spring(progress, { toValue: 1, ...SPRING_IN }).start()
    } else {
      Animated.spring(progress, { toValue: 0, ...SPRING_OUT }).start(({ finished }) => {
        if (finished) setRendered(false)
      })
    }
  }, [visible, progress])

  // ── Camera state ──
  const [facing, setFacing] = useState<'front' | 'back'>('front')
  const [torch, setTorch] = useState(false)
  const [lastCaptured, setLastCaptured] = useState<string | null>(null)
  const [permission, requestPermission] = useCameraPermissionsSafe()

  const lastReadRef = useRef<{ value: string; at: number } | null>(null)
  const flash = useRef(new Animated.Value(0)).current
  const fireTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onScannedRef = useRef(onScanned)
  onScannedRef.current = onScanned

  // Reset transient scan state on every open
  useEffect(() => {
    if (visible) {
      lastReadRef.current = null
      setLastCaptured(null)
      setTorch(false)
    }
  }, [visible])

  useEffect(
    () => () => {
      if (fireTimer.current) clearTimeout(fireTimer.current)
      if (captionTimer.current) clearTimeout(captionTimer.current)
    },
    [],
  )

  const handleBarcodeScanned = useCallback(
    (result: { data: string; type: string }) => {
      const value = typeof result?.data === 'string' ? result.data.trim() : ''
      if (!value) return
      const now = Date.now()
      const last = lastReadRef.current
      if (last && last.value === value && now - last.at < DEBOUNCE_MS) {
        // Sliding window: keep suppressing while the same code stays in view
        last.at = now
        return
      }
      lastReadRef.current = { value, at: now }

      // Brief success flash, then hand the value to the screen
      setLastCaptured(value)
      flash.setValue(0)
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start()
      if (fireTimer.current) clearTimeout(fireTimer.current)
      fireTimer.current = setTimeout(() => onScannedRef.current(value), SUCCESS_FIRE_MS)
      if (captionTimer.current) clearTimeout(captionTimer.current)
      captionTimer.current = setTimeout(() => setLastCaptured(null), 1600)
    },
    [flash],
  )

  const flipCamera = useCallback(() => {
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'))
    setTorch(false)
  }, [])

  const handleAllowCamera = useCallback(() => {
    if (permission && !permission.granted && !permission.canAskAgain) {
      Linking.openSettings().catch(() => {})
      return
    }
    void requestPermission()
  }, [permission, requestPermission])

  const cameraGranted = Boolean(cameraModule && permission?.granted)

  // ── Animated scanning line inside the reticle ──
  const scanY = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!(rendered && cameraGranted)) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(scanY, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [rendered, cameraGranted, scanY])

  const scanLineTranslate = scanY.interpolate({
    inputRange: [0, 1],
    outputRange: [8, RETICLE - 10],
  })

  return {
    rendered,
    progress,
    facing,
    torch,
    setTorch,
    lastCaptured,
    permission,
    handleBarcodeScanned,
    flipCamera,
    handleAllowCamera,
    cameraGranted,
    flash,
    scanLineTranslate,
  }
}
