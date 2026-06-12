/**
 * Single-line native text input row.
 *
 *   iOS     → SwiftUI TextField / SecureField (registry-gated)
 *   Android → JCTextInput registry adapter over JC BasicTextField
 *             (placeholder rendered as a JS overlay — still no native
 *             placeholder prop)
 *
 * Both natives are UNCONTROLLED — driven by useUncontrolledTextBridge.
 * STABLE @expo/ui 56: `defaultValue` died on both platforms (initial text is
 * pushed via bridge.attachRef → ref.setText), and the iOS keyboardType/
 * autocorrection/onSubmit PROPS became MODIFIERS (registry keys).
 * Callers must gate on hasNativeSingleLineText / hasNativeSecureText and
 * fall back to the RN TextInput tier otherwise.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { defaultTheme as t } from '../../theme'
import { fieldShellStyles, nativeComponents } from '../shared'
import type { NativeModifier } from '../shared'
import { NativeHost } from '../NativeHost'
import { useInputColors } from './colors'
import type { TextBridge } from './textBridge'

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

  const handleFocusChange = (focused: boolean) => {
    if (!focused) onBlur?.()
  }
  const handleSubmit = () => {
    void bridge.ref.current?.blur?.()
  }
  // Stable @expo/ui: keyboardType / autocorrection / onSubmit are MODIFIERS
  // on iOS (the canary props died).
  const iosModifiers: NativeModifier[] = []
  // Row contract: stacked-row input text is 16pt — pins the SwiftUI field to
  // the same size as the JS fallback tier (styles.stackedInput in inputs.tsx)
  // so native and JS rows are pixel-consistent.
  if (nativeComponents.font) {
    iosModifiers.push(nativeComponents.font({ size: 16 }))
  }
  if (keyboardType && nativeComponents.keyboardType) {
    iosModifiers.push(nativeComponents.keyboardType(keyboardType as Parameters<NonNullable<typeof nativeComponents.keyboardType>>[0]))
  }
  if (autocorrection === false && nativeComponents.autocorrectionDisabled) {
    iosModifiers.push(nativeComponents.autocorrectionDisabled(true))
  }
  if (nativeComponents.onSubmit) {
    iosModifiers.push(nativeComponents.onSubmit(handleSubmit))
  }
  if (disabled && nativeComponents.disabled) {
    iosModifiers.push(nativeComponents.disabled(true))
  }

  // ── iOS: SwiftUI SecureField ──
  const SecureField = nativeComponents.SecureField
  if (secure && SecureField) {
    return (
      <NativeHost
        matchContents={{ height: true }}
        style={disabled ? fieldShellStyles.disabledHost : undefined}
      >
        <SecureField
          ref={bridge.attachRef}
          placeholder={placeholder}
          onTextChange={bridge.handleChangeText}
          onFocusChange={handleFocusChange}
          modifiers={iosModifiers.length > 0 ? iosModifiers : undefined}
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
          ref={bridge.attachRef}
          placeholder={placeholder}
          onTextChange={bridge.handleChangeText}
          onFocusChange={handleFocusChange}
          modifiers={iosModifiers.length > 0 ? iosModifiers : undefined}
        />
      </NativeHost>
    )
  }

  // ── Android: JCTextInput adapter (no secure variant — callers fall back for passwords) ──
  const JCTextInput = nativeComponents.JCTextInput
  if (JCTextInput && !secure) {
    return (
      <View
        style={disabled ? styles.androidDisabledWrap : styles.androidWrap}
        pointerEvents={disabled ? 'none' : 'auto'}
      >
        <NativeHost matchContents={{ height: true }}>
          <JCTextInput
            ref={bridge.attachRef}
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
  // Zero horizontal inset — the FormSection row owns the 16pt grid, so the
  // overlay sits exactly where the JC input draws its text.
  placeholderOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  placeholderText: { fontSize: t.fontSize.md },
})
