/**
 * In-app toast notification system.
 * Provides a provider + hook for showing transient messages (success, error, info)
 * similar to Payload's web admin toasts.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { defaultTheme as t } from './theme'

type ToastType = 'success' | 'error' | 'info'

type Toast = {
  id: number
  message: string
  type: ToastType
  duration: number
}

type ToastContextValue = {
  showToast: (message: string, options?: { type?: ToastType; duration?: number }) => void
}

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
    (message: string, options?: { type?: ToastType; duration?: number }) => {
      const id = ++nextToastId
      const toast: Toast = {
        id,
        message,
        type: options?.type ?? 'info',
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

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({
  toast,
  onDismiss,
}) => {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-20)).current

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 15, stiffness: 200, useNativeDriver: true }),
    ]).start()

    const fadeTimer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start()
    }, toast.duration - 400)

    return () => clearTimeout(fadeTimer)
  }, [opacity, translateY, toast.duration])

  const bgColor =
    toast.type === 'error' ? '#dc2626' :
    toast.type === 'success' ? '#16a34a' :
    '#1f1f1f'

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bgColor, opacity, transform: [{ translateY }] }]}>
      <Pressable onPress={() => onDismiss(toast.id)} style={styles.toastContent}>
        <Text style={styles.toastIcon}>
          {toast.type === 'error' ? '✕' : toast.type === 'success' ? '✓' : 'ℹ'}
        </Text>
        <Text style={styles.toastText} numberOfLines={3}>{toast.message}</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
    gap: 8,
  },
  toast: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  toastContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toastIcon: { fontSize: 16, fontWeight: '700', color: '#fff' },
  toastText: { fontSize: 14, color: '#fff', flex: 1, fontWeight: '500' },
})
