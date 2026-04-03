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

  if (Host) {
    // matchContents={false} → omit the prop entirely so the Host stretches to its RN parent
    const hostProps: any = {
      colorScheme: 'light',
      ignoreSafeArea: 'keyboard',
      style,
    }
    if (matchContents !== false) {
      hostProps.matchContents = matchContents
    }
    return <Host {...hostProps}>{children}</Host>
  }

  return <>{children}</>
}
