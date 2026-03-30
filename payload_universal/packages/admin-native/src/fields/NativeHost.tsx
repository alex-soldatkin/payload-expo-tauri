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
import React from 'react'
import type { ViewStyle, StyleProp } from 'react-native'

import { nativeComponents } from './shared'

/** Whether native @expo/ui components are available on this platform. */
export const isNativeUIAvailable = nativeComponents.isAvailable

type NativeHostProps = {
  children: React.ReactNode
  /** Match native content size to React Native layout. Defaults to true. */
  matchContents?: boolean | { width?: boolean; height?: boolean }
  style?: StyleProp<ViewStyle>
}

export const NativeHost: React.FC<NativeHostProps> = ({
  children,
  matchContents = true,
  style,
}) => {
  const Host = nativeComponents.Host

  if (Host) {
    return (
      <Host
        matchContents={matchContents}
        colorScheme="light"
        ignoreSafeArea="keyboard"
        style={style}
      >
        {children}
      </Host>
    )
  }

  return <>{children}</>
}
