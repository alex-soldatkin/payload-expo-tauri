/**
 * Platform-aware @expo/ui Host wrapper.
 *
 * Wraps children in the platform-appropriate native Host so @expo/ui
 * components (Toggle, DatePicker, Picker, etc.) render correctly.
 * Passes through on platforms where @expo/ui is unavailable.
 *
 * Uses the centralized native component registry (shared/native)
 * which Metro resolves to the correct platform file at build time.
 */
import React, { createContext, useContext } from 'react'
import type { ViewStyle, StyleProp } from 'react-native'

import { nativeComponents, useIsInsideNativeForm } from './shared'

// Track Host nesting depth to prevent Host-inside-Host crashes
const NativeHostDepthContext = createContext(0)
/** Returns true if already inside a NativeHost (depth > 0). */
export const useIsInsideNativeHost = () => useContext(NativeHostDepthContext) > 0

/** Whether native @expo/ui components are available on this platform. */
export const isNativeUIAvailable = nativeComponents.isAvailable

type NativeHostProps = {
  children: React.ReactNode
  /**
   * Match native content size to React Native layout.
   * - true: match both width and height (default for inline components like Toggle)
   * - { width: false, height: true }: stretch width to RN parent, match height to content
   *   (used for Picker/Select to fill available width)
   */
  matchContents?: boolean | { width?: boolean; height?: boolean }
  style?: StyleProp<ViewStyle>
}

export const NativeHost: React.FC<NativeHostProps> = ({
  children,
  matchContents = true,
  style,
}) => {
  const Host = nativeComponents.Host
  const depth = useContext(NativeHostDepthContext)
  const insideNativeForm = useIsInsideNativeForm()

  // Inside a SwiftUI Form (already inside a Host) or nested Host: skip wrapper.
  // @expo/ui components render directly inside the Form's Host context.
  if (!Host || (depth > 0 && insideNativeForm)) {
    return <>{children}</>
  }

  const hostProps: any = {
    colorScheme: 'light',
    ignoreSafeArea: 'keyboard',
    style,
  }

  // Translate our { width, height } shape to @expo/ui's { horizontal, vertical }
  if (typeof matchContents === 'object') {
    hostProps.matchContents = {
      horizontal: matchContents.width ?? false,
      vertical: matchContents.height ?? false,
    }
  } else if (matchContents === false) {
    // Omit entirely → Host stretches to RN parent
  } else {
    hostProps.matchContents = matchContents
  }

  return (
    <NativeHostDepthContext.Provider value={depth + 1}>
      <Host {...hostProps}>{children}</Host>
    </NativeHostDepthContext.Provider>
  )
}
