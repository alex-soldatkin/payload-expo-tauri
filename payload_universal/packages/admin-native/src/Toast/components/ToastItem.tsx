import React, { useRef } from 'react'
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

import { useListColors } from '../../hooks/useListColors'
import { BlurView, GlassView, liquidGlassAvailable } from '../deps'
import { ACCENT, styles } from '../styles'
import type { Toast } from '../types'
import { ToastIcon_ } from './ToastIcon'

// ---------------------------------------------------------------------------
// ToastItem
// ---------------------------------------------------------------------------

export const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({
  toast,
  onDismiss,
}) => {
  const { dark: isDark } = useListColors()
  const { width: windowWidth } = useWindowDimensions()

  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.85)).current
  const translateY = useRef(new Animated.Value(-12)).current

  const dismissingRef = useRef(false)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  React.useEffect(() => {
    // Enter — scale + slide + fade
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 18,
        stiffness: 240,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        stiffness: 240,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start()

    // Exit — fade out shortly before removal
    const fadeTimer = setTimeout(() => {
      if (dismissingRef.current) return
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start()
    }, toast.duration - 450)

    return () => clearTimeout(fadeTimer)
  }, [opacity, scale, translateY, toast.duration])

  // Swipe-up flick out — like dismissing a system notification banner
  const flickOut = useRef(() => {
    if (dismissingRef.current) return
    dismissingRef.current = true
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -90,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => onDismissRef.current(toast.id))
  }).current

  // Pan: upward drag follows the finger (downward rubber-bands slightly);
  // release with enough distance/velocity dismisses, otherwise spring back.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 4 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        translateY.setValue(gs.dy < 0 ? gs.dy : gs.dy * 0.12)
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -24 || gs.vy < -0.6) {
          flickOut()
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 18,
            stiffness: 240,
            mass: 0.8,
            useNativeDriver: true,
          }).start()
        }
      },
    }),
  ).current

  const accentColor = ACCENT[toast.type]

  // Adaptive colours — translucent tokens tuned for the glass/blur tiers
  // (the opaque useListColors palette would deaden the blur), with the
  // dark flag sourced from useListColors for scheme consistency.
  const blurTint = isDark ? 'dark' : 'light'
  const solidBg = isDark ? 'rgba(30, 30, 30, 0.92)' : 'rgba(255, 255, 255, 0.92)'
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'
  const textColor = isDark ? 'rgba(255, 255, 255, 0.92)' : 'rgba(0, 0, 0, 0.88)'

  // Content-sized pill: width grows with the message up to 90% of the
  // screen or 560pt (whichever is smaller); height follows the text.
  const maxWidth = Math.min(windowWidth * 0.9, 560)

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          borderColor,
          maxWidth,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
      {...pan.panHandlers}
    >
      {/* Background: liquid glass (iOS 26+) → blur → solid fallback */}
      {liquidGlassAvailable && GlassView ? (
        <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />
      ) : BlurView ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={Platform.OS === 'ios' ? 65 : 90}
          tint={blurTint}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: solidBg }]} />
      )}

      <Pressable onPress={() => onDismiss(toast.id)} style={styles.pillContent}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <ToastIcon_ type={toast.type} icon={toast.icon} />
        </View>

        {/* Text — wraps freely up to 4 lines, then ellipsizes */}
        <Text style={[styles.messageText, { color: textColor }]} numberOfLines={4}>
          {toast.message}
        </Text>

        {/* Coloured accent dot */}
        <View style={[styles.accentDot, { backgroundColor: accentColor }]} />
      </Pressable>
    </Animated.View>
  )
}
