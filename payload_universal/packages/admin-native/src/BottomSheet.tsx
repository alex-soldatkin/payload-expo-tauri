import React, { useCallback, useEffect, useRef } from 'react'
import {
  Animated,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'
import { PreviewContextProvider } from './PreviewContext'

// Optional: BlurView for translucent sheet background
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

type Props = {
  visible: boolean
  onClose: () => void
  children: React.ReactNode
  /** Height as a fraction of screen height (0–1). Defaults to 0.5. */
  height?: number
}

/**
 * Bottom sheet using transparent Modal + Animated slide-up.
 *
 * The drag handle at the top captures touches in the capture phase
 * so the PanResponder always works there regardless of child views.
 * Content area scroll takes priority (FlatList, ScrollView, etc.).
 */
export const BottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  children,
  height = 0.5,
}) => {
  const { height: screenHeight } = useWindowDimensions()
  const translateY = useRef(new Animated.Value(screenHeight)).current
  const sheetHeight = screenHeight * height

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220,
        mass: 0.9,
      }).start()
    } else {
      Animated.spring(translateY, {
        toValue: screenHeight,
        useNativeDriver: true,
        damping: 24,
        stiffness: 280,
        mass: 0.9,
      }).start()
    }
  }, [visible, translateY, screenHeight])

  // Handle-area PanResponder — captures in the capture phase so
  // it always works regardless of BlurView or other overlapping children.
  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy)
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          onClose()
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 220,
            mass: 0.9,
          }).start()
        }
      },
    }),
  ).current

  const handleClose = useCallback(() => {
    Keyboard.dismiss()
    onClose()
  }, [onClose])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <View style={styles.backdropFill} />
      </Pressable>
      <Animated.View
        style={[styles.sheet, { height: sheetHeight, transform: [{ translateY }] }]}
      >
        {BlurView && Platform.OS === 'ios' ? (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={40}
            tint="systemUltraThinMaterial"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.sheetFallbackBg]} />
        )}
        {/* Drag handle — dedicated PanResponder so it always captures */}
        <Animated.View style={styles.handleRow} {...handlePan.panHandlers}>
          <View style={styles.handleBar} />
        </Animated.View>
        <View style={styles.content}>
          <PreviewContextProvider value={true}>
            {children}
          </PreviewContextProvider>
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
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 14,
  },
  handleBar: { width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)' },
  content: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
})
