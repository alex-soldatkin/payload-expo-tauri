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
import React, { useMemo } from 'react'
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
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
import { useListColors } from '@payload-universal/admin-native'

import { BARCODE_TYPES, TABLET_BREAKPOINT, TABLET_H, TABLET_W } from './constants'
import { BlurView, GlassView, cameraModule, liquidGlassAvailable } from './nativeDeps'
import { createDynamicStyles, styles } from './styles'
import { CircleButton } from './components/CircleButton'
import { useScanController } from './hooks/useScanController'
import type { ScanLookupSheetProps } from './types'

export type { ScanLookupSheetProps } from './types'

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

  const {
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
  } = useScanController(visible, onScanned)

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
