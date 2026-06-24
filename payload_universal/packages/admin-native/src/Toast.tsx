/**
 * In-app toast notification system — iOS-native style.
 *
 * Renders pill-shaped, dark translucent toasts at the top of the screen,
 * matching the look of iOS system notifications (AirPods connected, etc.).
 * Each toast type gets a themed icon and accent color.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useListColors } from './hooks/useListColors'

// ---------------------------------------------------------------------------
// Optional deps — loaded dynamically
// ---------------------------------------------------------------------------

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

// Optional: GlassView for liquid glass pills on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

// Lucide icons — loaded dynamically so this package doesn't hard-depend on them
let CheckCircle2: React.ComponentType<any> | null = null
let XCircle: React.ComponentType<any> | null = null
let Info: React.ComponentType<any> | null = null
let CloudOff: React.ComponentType<any> | null = null
let Trash2: React.ComponentType<any> | null = null
let RotateCcw: React.ComponentType<any> | null = null
let Save: React.ComponentType<any> | null = null
let CloudCheck: React.ComponentType<any> | null = null

try {
  const lucide = require('lucide-react-native')
  CheckCircle2 = lucide.CheckCircle2 ?? lucide.CheckCircle ?? null
  XCircle = lucide.XCircle ?? null
  Info = lucide.Info ?? null
  CloudOff = lucide.CloudOff ?? null
  Trash2 = lucide.Trash2 ?? null
  RotateCcw = lucide.RotateCcw ?? null
  Save = lucide.Save ?? null
  CloudCheck = lucide.CloudCheck ?? null
} catch {
  /* lucide-react-native not installed */
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = 'success' | 'error' | 'info'

/** Semantic hint for picking the right icon. */
type ToastIcon = 'sync' | 'syncError' | 'save' | 'publish' | 'delete' | 'undo' | 'error' | 'info' | 'success'

type Toast = {
  id: number
  message: string
  type: ToastType
  icon?: ToastIcon
  duration: number
}

type ToastContextValue = {
  showToast: (
    message: string,
    options?: { type?: ToastType; icon?: ToastIcon; duration?: number },
  ) => void
}

// ---------------------------------------------------------------------------
// Accent colours per toast type
// ---------------------------------------------------------------------------

const ACCENT = {
  success: '#34C759', // iOS green
  error: '#FF3B30', // iOS red
  info: '#007AFF', // iOS blue
} as const

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

function ToastIcon_({
  type,
  icon,
}: {
  type: ToastType
  icon?: ToastIcon
}) {
  const color = ACCENT[type]
  const size = 22

  // Pick icon component based on semantic hint, then fall back to type
  const resolved = icon ?? type
  let IconComponent: React.ComponentType<any> | null = null

  switch (resolved) {
    case 'sync':
    case 'success':
      IconComponent = CloudCheck ?? CheckCircle2
      break
    case 'syncError':
      IconComponent = CloudOff ?? XCircle
      break
    case 'save':
    case 'publish':
      IconComponent = Save ?? CheckCircle2
      break
    case 'delete':
      IconComponent = Trash2 ?? Info
      break
    case 'undo':
      IconComponent = RotateCcw ?? Info
      break
    case 'error':
      IconComponent = XCircle ?? null
      break
    case 'info':
      IconComponent = Info ?? null
      break
    default:
      IconComponent = CheckCircle2
  }

  if (IconComponent) {
    return <IconComponent size={size} color={color} strokeWidth={2} />
  }

  // Unicode fallback when lucide isn't available
  const fallbackChar = type === 'error' ? '✕' : type === 'success' ? '✓' : 'ℹ'
  return <Text style={[styles.fallbackIcon, { color }]}>{fallbackChar}</Text>
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null)

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

let nextToastId = 0

/** Maximum number of toasts visible at once — older ones are evicted. */
const MAX_VISIBLE_TOASTS = 2

/** Default auto-dismiss base duration (ms). */
const BASE_DURATION = 3500
/** Extra dwell time per character so long messages stay readable. */
const PER_CHAR_MS = 40
/** Hard cap on the auto-computed duration. */
const MAX_AUTO_DURATION = 8000

/**
 * Auto-dismiss duration scaled by message length: base + 40ms/char, capped
 * at 8s. Only used when the caller doesn't pass an explicit duration.
 */
const autoDuration = (message: string): number =>
  Math.min(BASE_DURATION + message.length * PER_CHAR_MS, MAX_AUTO_DURATION)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const insets = useSafeAreaInsets()

  const showToast = useCallback(
    (
      message: string,
      options?: { type?: ToastType; icon?: ToastIcon; duration?: number },
    ) => {
      const id = ++nextToastId
      const toast: Toast = {
        id,
        message,
        type: options?.type ?? 'info',
        icon: options?.icon,
        duration: options?.duration ?? autoDuration(message),
      }
      // Stack up to MAX_VISIBLE_TOASTS — evict the oldest beyond that
      setToasts((prev) => [...prev, toast].slice(-MAX_VISIBLE_TOASTS))

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, toast.duration)
    },
    [],
  )

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// ToastItem
// ---------------------------------------------------------------------------

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    gap: 8,
  },

  // Pill shape — sizes to its content (maxWidth applied inline from window
  // width), centred, very rounded. RN clamps oversized radii on tall pills.
  pill: {
    borderRadius: 50,
    overflow: 'hidden',
    minWidth: 200,
    borderWidth: StyleSheet.hairlineWidth,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },

  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },

  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    letterSpacing: -0.2,
  },

  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  fallbackIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
})
