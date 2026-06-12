/**
 * Single-line native text input row.
 *
 *   iOS     → SwiftUI TextField / SecureField (registry-gated)
 *   Android → JC TextInput (registry-gated; placeholder rendered as a JS
 *             overlay because JCTextInput has no placeholder prop)
 *
 * Both natives are UNCONTROLLED — driven by useUncontrolledTextBridge.
 * Callers must gate on hasNativeSingleLineText / hasNativeSecureText and
 * fall back to the RN TextInput tier otherwise.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { defaultTheme as t } from '../../theme'
import { fieldShellStyles, nativeComponents } from '../shared'
import { NativeHost } from '../NativeHost'
import { useInputColors } from './colors'
import type { NativeTextRef, TextBridge } from './textBridge'

/** Whether a native single-line text input exists on this platform. */
export const hasNativeSingleLineText = Boolean(
  nativeComponents.Host && (nativeComponents.TextField || nativeComponents.JCTextInput),
)

/** Whether a native secure (password) input exists — SwiftUI only. */
export const hasNativeSecureText = Boolean(nativeComponents.Host && nativeComponents.SecureField)

type JCKeyboard = 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'ascii-capable' | 'url' | 'decimal-pad'

/** Map iOS-flavoured keyboard types onto the JC TextInput union. */
const toJCKeyboard = (keyboardType?: string): JCKeyboard | undefined => {
  switch (keyboardType) {
    case undefined:
      return undefined
    case 'numbers-and-punctuation':
      return 'decimal-pad'
    case 'default':
    case 'email-address':
    case 'numeric':
    case 'phone-pad':
    case 'ascii-capable':
    case 'url':
    case 'decimal-pad':
      return keyboardType
    default:
      return 'default'
  }
}

type NativeTextRowProps = {
  bridge: TextBridge
  placeholder?: string
  keyboardType?: string
  autocorrection?: boolean
  /** Render a SwiftUI SecureField (iOS only — callers gate via hasNativeSecureText). */
  secure?: boolean
  disabled?: boolean
  onBlur?: () => void
}

export const NativeTextRow: React.FC<NativeTextRowProps> = ({
  bridge,
  placeholder,
  keyboardType,
  autocorrection,
  secure,
  disabled,
  onBlur,
}) => {
  const colors = useInputColors()

  const setRef = (r: unknown) => {
    bridge.ref.current = r as NativeTextRef | null
  }
  const handleFocusChange = (focused: boolean) => {
    if (!focused) onBlur?.()
  }
  const handleSubmit = () => {
    void bridge.ref.current?.blur?.()
  }
  const disabledModifiers =
    disabled && nativeComponents.disabled ? [nativeComponents.disabled(true)] : undefined

  // ── iOS: SwiftUI SecureField ──
  const SecureField = nativeComponents.SecureField
  if (secure && SecureField) {
    return (
      <NativeHost
        matchContents={{ height: true }}
        style={disabled ? fieldShellStyles.disabledHost : undefined}
      >
        <SecureField
          ref={setRef}
          defaultValue={bridge.initialValue}
          placeholder={placeholder}
          keyboardType={keyboardType}
          onChangeText={bridge.handleChangeText}
          onChangeFocus={handleFocusChange}
          onSubmit={handleSubmit}
          modifiers={disabledModifiers}
        />
      </NativeHost>
    )
  }

  // ── iOS: SwiftUI TextField ──
  const TextField = nativeComponents.TextField
  if (TextField) {
    return (
      <NativeHost
        matchContents={{ height: true }}
        style={disabled ? fieldShellStyles.disabledHost : undefined}
      >
        <TextField
          ref={setRef}
          defaultValue={bridge.initialValue}
          placeholder={placeholder}
          keyboardType={keyboardType}
          autocorrection={autocorrection}
          onChangeText={bridge.handleChangeText}
          onChangeFocus={handleFocusChange}
          onSubmit={handleSubmit}
          modifiers={disabledModifiers}
        />
      </NativeHost>
    )
  }

  // ── Android: JC TextInput (no secure variant — callers fall back for passwords) ──
  const JCTextInput = nativeComponents.JCTextInput
  if (JCTextInput && !secure) {
    return (
      <View
        style={disabled ? styles.androidDisabledWrap : styles.androidWrap}
        pointerEvents={disabled ? 'none' : 'auto'}
      >
        <NativeHost matchContents={{ height: true }}>
          <JCTextInput
            ref={setRef}
            defaultValue={bridge.initialValue}
            onChangeText={bridge.handleChangeText}
            keyboardType={toJCKeyboard(keyboardType)}
            autocorrection={autocorrection}
            autoCapitalize="none"
            modifiers={nativeComponents.jcFillMaxWidth ? [nativeComponents.jcFillMaxWidth()] : undefined}
          />
        </NativeHost>
        {placeholder && bridge.isEmpty ? (
          <View pointerEvents="none" style={styles.placeholderOverlay}>
            <Text numberOfLines={1} style={[styles.placeholderText, { color: colors.textPlaceholder }]}>
              {placeholder}
            </Text>
          </View>
        ) : null}
      </View>
    )
  }

  return null
}

const styles = StyleSheet.create({
  androidWrap: { position: 'relative' },
  androidDisabledWrap: { position: 'relative', opacity: 0.5 },
  placeholderOverlay: {
    position: 'absolute',
    left: t.spacing.md,
    right: t.spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  placeholderText: { fontSize: t.fontSize.md },
})
