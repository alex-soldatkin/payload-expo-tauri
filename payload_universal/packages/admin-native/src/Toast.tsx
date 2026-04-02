/**
 * In-app toast notification system — iOS-native style.
 *
 * Renders pill-shaped, dark translucent toasts at the top of the screen,
 * matching the look of iOS system notifications (AirPods connected, etc.).
 * Each toast type gets a themed icon and accent color.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Animated, Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// ---------------------------------------------------------------------------
// Optional deps — loaded dynamically
// ---------------------------------------------------------------------------

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
        duration: options?.duration ?? 3500,
      }
      setToasts((prev) => [...prev, toast])

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
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.85)).current
  const translateY = useRef(new Animated.Value(-12)).current

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

  const accentColor = ACCENT[toast.type]

  // Adaptive colours
  const blurTint = isDark ? 'dark' : 'light'
  const solidBg = isDark ? 'rgba(30, 30, 30, 0.92)' : 'rgba(255, 255, 255, 0.92)'
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'
  const textColor = isDark ? 'rgba(255, 255, 255, 0.92)' : 'rgba(0, 0, 0, 0.88)'

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          borderColor,
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {/* Blur background — adapts tint to colour scheme */}
      {BlurView ? (
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

        {/* Text */}
        <Text style={[styles.messageText, { color: textColor }]} numberOfLines={2}>
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

  // Pill shape — auto-width, centred, very rounded
  pill: {
    borderRadius: 50,
    overflow: 'hidden',
    minWidth: 200,
    maxWidth: '85%',
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
