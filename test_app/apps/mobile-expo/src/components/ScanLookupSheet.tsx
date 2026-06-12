/**
 * ScanLookupSheet — barcode / QR / DataMatrix scan popup for record lookup.
 *
 * NOT fullscreen:
 *   - Phone: centered Telegram-peek-style overlay — dim backdrop, ~88% width,
 *     rounded-20 glass container, spring in/out (the peek module's visual
 *     language, mirrored in JS).
 *   - Tablet (width >= 768): floating ~360x440 popup anchored near the
 *     top-right below the toolbar area, glass + shadow, tap-outside dismiss.
 *
 * Camera: expo-camera's CameraView, FRONT camera by default with a flip
 * button (lucide SwitchCamera in a glass circle — icon-only @expo/ui SwiftUI
 * Buttons render invisible per memory-bank 013), torch toggle when the rear
 * camera is active, rounded viewfinder mask + animated scanning reticle.
 *
 * Degrades gracefully — NEVER crashes:
 *   - expo-camera is loaded via try/catch require. The CURRENT dev-client
 *     binary does NOT include the ExpoCamera pod (a NEW EAS BUILD is
 *     required); until then an instructive empty state renders instead.
 *   - Permission flow lives in-popup: 'Allow camera' button via
 *     useCameraPermissions, 'Open Settings' once permanently denied.
 *
 * Scan handling: qr + datamatrix + ean13 + code128 + upc_a/upc_e; repeated
 * reads of the same value within 2s are ignored (sliding window); an
 * accepted read triggers a brief success flash, then `onScanned(value)`.
 * The popup does NOT close itself — the screen owns the resolution flow.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  CameraOff,
  Flashlight,
  FlashlightOff,
  ScanLine,
  SwitchCamera,
  X,
} from 'lucide-react-native'
import { useListColors, type ListColorPalette } from '@payload-universal/admin-native'

// ---------------------------------------------------------------------------
// Optional native deps — try/catch requires (graceful degradation tiers)
// ---------------------------------------------------------------------------

type PermissionShape = { granted: boolean; canAskAgain: boolean } | null
type UseCameraPermissions = () => readonly [
  PermissionShape,
  () => Promise<unknown>,
  ...unknown[],
]

type CameraViewProps = {
  style?: StyleProp<ViewStyle>
  facing?: 'front' | 'back'
  enableTorch?: boolean
  barcodeScannerSettings?: { barcodeTypes: string[] }
  onBarcodeScanned?: (result: { data: string; type: string }) => void
}

type CameraModuleShape = {
  CameraView: React.ComponentType<CameraViewProps>
  useCameraPermissions: UseCameraPermissions
}

// expo-camera calls requireNativeModule at import time — it THROWS on a
// binary built without the ExpoCamera pod. The require must stay guarded so
// the current binary shows the fallback message instead of crashing.
let cameraModule: CameraModuleShape | null = null
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
const useCameraPermissionsSafe: UseCameraPermissions =
  cameraModule?.useCameraPermissions ??
  (() => [null, async () => null] as const)

// Liquid glass (iOS 26+) → BlurView → solid fallback, BottomSheet precedent.
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

let BlurView: React.ComponentType<{
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Symbologies resolved by the record-lookup flow. */
const BARCODE_TYPES = ['qr', 'datamatrix', 'ean13', 'code128', 'upc_a', 'upc_e']

/** Repeated reads of the SAME value inside this window are ignored. */
const DEBOUNCE_MS = 2000

/** Delay between the success flash starting and `onScanned` firing. */
const SUCCESS_FIRE_MS = 220

/** Side of the square viewfinder cutout. */
const RETICLE = 200

const TABLET_BREAKPOINT = 768
const TABLET_W = 360
const TABLET_H = 440

// Spring curves mirroring the peek module's morph feel (0.42s / damping 0.8)
const SPRING_IN = { damping: 18, stiffness: 240, mass: 0.9, useNativeDriver: true } as const
const SPRING_OUT = { damping: 22, stiffness: 300, mass: 0.9, useNativeDriver: true } as const

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type ScanLookupSheetProps = {
  visible: boolean
  onClose: () => void
  /** Fired once per accepted (debounced) read with the decoded string. */
  onScanned: (value: string) => void
  /** Heading; defaults to 'Scan code'. */
  title?: string
}

// ---------------------------------------------------------------------------
// Glass circle button (lucide icon inside; no @expo/ui in this tree)
// ---------------------------------------------------------------------------

const CircleButton: React.FC<{
  onPress: () => void
  label: string
  colors: ListColorPalette
  dark: boolean
  children: React.ReactNode
}> = ({ onPress, label, colors, dark, children }) => {
  if (liquidGlassAvailable && GlassView) {
    return (
      <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6}>
        <GlassView style={styles.circle} isInteractive glassEffectStyle="regular">
          <View style={styles.circleInner}>{children}</View>
        </GlassView>
      </Pressable>
    )
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.circle,
        styles.circleInner,
        {
          backgroundColor: pressed
            ? colors.pressed
            : dark
              ? 'rgba(255,255,255,0.10)'
              : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      {children}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScanLookupSheet({
  visible,
  onClose,
  onScanned,
  title = 'Scan code',
}: ScanLookupSheetProps) {
  const { dark, colors } = useListColors()
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const isTablet = width >= TABLET_BREAKPOINT

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

  const popupWidth = isTablet ? TABLET_W : Math.min(width * 0.88, 420)

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isTablet ? 0.12 : 0.45],
  })
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] })
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [isTablet ? -12 : 24, 0],
  })

  const dynamic = useMemo(() => createDynamicStyles(colors, dark), [colors, dark])

  if (!rendered) return null

  // ── Background tier: liquid glass → blur → solid (single layer only) ──
  const glassBackground =
    liquidGlassAvailable && GlassView ? (
      <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
    ) : BlurView && Platform.OS === 'ios' ? (
      <BlurView
        style={StyleSheet.absoluteFill}
        intensity={50}
        tint="systemUltraThinMaterial"
      />
    ) : (
      <View style={[StyleSheet.absoluteFill, dynamic.solidBg]} />
    )

  // ── Camera area content (graceful tiers, never a crash) ──
  let cameraArea: React.ReactNode
  if (!cameraModule) {
    cameraArea = (
      <View style={styles.emptyState}>
        <CameraOff size={32} color={colors.textMuted} strokeWidth={1.6} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Camera unavailable</Text>
        <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
          This build does not include the camera module. Install the latest
          development build to scan codes here.
        </Text>
      </View>
    )
  } else if (!permission) {
    cameraArea = (
      <View style={styles.emptyState}>
        <ScanLine size={32} color={colors.textMuted} strokeWidth={1.6} />
        <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
          Checking camera access…
        </Text>
      </View>
    )
  } else if (!permission.granted) {
    cameraArea = (
      <View style={styles.emptyState}>
        <ScanLine size={32} color={colors.textMuted} strokeWidth={1.6} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Camera access needed</Text>
        <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
          {permission.canAskAgain
            ? 'Scanning a label looks up the matching record instantly.'
            : 'Camera access is turned off for this app. Enable it in Settings.'}
        </Text>
        <Pressable
          onPress={handleAllowCamera}
          style={({ pressed }) => [
            styles.allowButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityLabel="Allow camera"
        >
          <Text style={[styles.allowButtonLabel, { color: colors.primaryText }]}>
            {permission.canAskAgain ? 'Allow camera' : 'Open Settings'}
          </Text>
        </Pressable>
      </View>
    )
  } else {
    const CameraView = cameraModule.CameraView
    cameraArea = (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={facing}
          enableTorch={facing === 'back' && torch}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={visible ? handleBarcodeScanned : undefined}
        />
        {/* Viewfinder mask + reticle */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.maskRow} />
          <View style={styles.maskCenterRow}>
            <View style={styles.maskSide} />
            <View style={styles.reticleBox}>
              <View
                style={[
                  styles.viewfinderBorder,
                  { borderColor: lastCaptured ? colors.success : 'rgba(255,255,255,0.55)' },
                ]}
              />
              {/* Corner brackets */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              {/* Scanning line */}
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    backgroundColor: lastCaptured
                      ? colors.success
                      : 'rgba(255,255,255,0.85)',
                    transform: [{ translateY: scanLineTranslate }],
                  },
                ]}
              />
            </View>
            <View style={styles.maskSide} />
          </View>
          <View style={styles.maskRow} />
        </View>
        {/* Success flash */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.success,
              opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }),
            },
          ]}
        />
      </>
    )
  }

  const caption = lastCaptured
    ? `Captured · ${lastCaptured}`
    : cameraGranted
      ? 'Point at a code'
      : ' '

  const popupBody = (
    <Animated.View
      style={[
        styles.popup,
        isTablet
          ? {
              position: 'absolute' as const,
              top: insets.top + 56,
              right: 16,
              width: TABLET_W,
              height: TABLET_H,
            }
          : { width: popupWidth },
        isTablet ? styles.popupShadowTablet : styles.popupShadowPhone,
        { opacity: progress, transform: [{ scale }, { translateY }] },
      ]}
    >
      {glassBackground}
      <View style={[styles.content, isTablet && styles.contentFill]}>
        {/* Header: title + close */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <CircleButton onPress={onClose} label="Close scanner" colors={colors} dark={dark}>
            <X size={15} color={colors.textMuted} strokeWidth={2.5} />
          </CircleButton>
        </View>

        {/* Camera preview / fallback states */}
        <View
          style={[
            styles.cameraWrap,
            dynamic.cameraWrapBg,
            isTablet ? styles.cameraWrapFill : styles.cameraWrapSquare,
          ]}
        >
          {cameraArea}
        </View>

        {/* Status caption + camera controls */}
        <View style={styles.footerRow}>
          <Text
            style={[
              styles.caption,
              { color: lastCaptured ? colors.success : colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {caption}
          </Text>
          {cameraGranted ? (
            <View style={styles.controls}>
              {facing === 'back' ? (
                <CircleButton
                  onPress={() => setTorch((t) => !t)}
                  label={torch ? 'Turn torch off' : 'Turn torch on'}
                  colors={colors}
                  dark={dark}
                >
                  {torch ? (
                    <Flashlight size={16} color={colors.warning} strokeWidth={2.2} />
                  ) : (
                    <FlashlightOff size={16} color={colors.textMuted} strokeWidth={2.2} />
                  )}
                </CircleButton>
              ) : null}
              <CircleButton
                onPress={flipCamera}
                label="Flip camera"
                colors={colors}
                dark={dark}
              >
                <SwitchCamera size={16} color={colors.textMuted} strokeWidth={2.2} />
              </CircleButton>
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  )

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Dim backdrop (phone: peek-style dim; tablet: barely-there) */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]}
      />
      {/* Tap-outside dismiss */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Dismiss scanner"
      />
      {isTablet ? (
        popupBody
      ) : (
        <View style={styles.centerWrap} pointerEvents="box-none">
          {popupBody}
        </View>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CORNER = 26
const CORNER_W = 3

const createDynamicStyles = (colors: ListColorPalette, dark: boolean) =>
  StyleSheet.create({
    solidBg: {
      backgroundColor: dark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.94)',
    },
    cameraWrapBg: {
      backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      borderColor: colors.hairline,
    },
  })

const styles = StyleSheet.create({
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  popupShadowPhone: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 16,
  },
  popupShadowTablet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 20,
  },
  content: {
    padding: 14,
  },
  contentFill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    flexShrink: 1,
    marginRight: 12,
  },
  cameraWrap: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cameraWrapSquare: {
    aspectRatio: 1,
  },
  cameraWrapFill: {
    flex: 1,
  },
  // Viewfinder mask strips (darken everything outside the reticle)
  maskRow: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  maskCenterRow: {
    flexDirection: 'row',
    height: RETICLE,
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  reticleBox: {
    width: RETICLE,
    height: RETICLE,
  },
  viewfinderBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#fff',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderTopRightRadius: 18,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderBottomRightRadius: 18,
  },
  scanLine: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    minHeight: 32,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    marginRight: 12,
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  circleInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Permission / module-absent empty states
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  allowButton: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  allowButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
})
