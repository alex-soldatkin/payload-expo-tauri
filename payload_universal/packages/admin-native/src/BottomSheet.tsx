import React, { useCallback, useEffect, useRef } from 'react'
import {
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'

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

const SCREEN_HEIGHT = Dimensions.get('window').height

/**
 * A modal-based bottom sheet that replaces web popovers / dropdowns.
 * Uses only React Native built-ins (Modal + Animated + PanResponder).
 */
export const BottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  children,
  height = 0.5,
}) => {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const sheetHeight = SCREEN_HEIGHT * height

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 150,
      }).start()
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start()
    }
  }, [visible, translateY])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
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
            damping: 20,
            stiffness: 150,
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
        {...panResponder.panHandlers}
      >
        {/* Translucent blur background (iOS) or solid fallback */}
        {BlurView && Platform.OS === 'ios' ? (
          <BlurView
            style={StyleSheet.absoluteFill}
            intensity={40}
            tint="systemUltraThinMaterial"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.sheetFallbackBg]} />
        )}
        <View style={styles.handleRow}>
          <View style={styles.handleBar} />
        </View>
        <View style={styles.content}>{children}</View>
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
  handleRow: { alignItems: 'center', paddingVertical: 10 },
  handleBar: { width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)' },
  content: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
})
