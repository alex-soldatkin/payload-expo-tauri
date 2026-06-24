/**
 * In-app toast notification system — iOS-native style.
 *
 * Renders pill-shaped, dark translucent toasts at the top of the screen,
 * matching the look of iOS system notifications (AirPods connected, etc.).
 * Each toast type gets a themed icon and accent color.
 */
import React, { createContext, useCallback, useContext, useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ToastItem } from './components/ToastItem'
import { styles } from './styles'
import type { Toast, ToastContextValue, ToastIcon, ToastType } from './types'

// Re-export types for consumer convenience (preserves old in-file exports)
export type { Toast, ToastContextValue, ToastIcon, ToastType } from './types'

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
