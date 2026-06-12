/**
 * NativeActionButton — platform-native action button for codegen'd custom
 * components. (Mirror of packages/ui/src/NativeActionButton.native.tsx —
 * both packages claim the @payload-universal/ui name; keep them in sync.)
 *
 * Tier 1 (iOS dev build, @expo/ui available): SwiftUI Button via the
 *   admin-native nativeComponents registry, wrapped in NativeHost with
 *   matchContents so the button keeps its intrinsic size and stays tappable.
 *   buttonStyle('glass'/'glassProminent') on iOS 26+ (expo-glass-effect
 *   isLiquidGlassAvailable), 'bordered'/'borderedProminent' otherwise;
 *   controlSize('regular'); tint from the variant; role 'destructive'.
 *
 *   CONTRACT (@expo/ui canary 55.0.0-canary-20260128): the SwiftUI Button
 *   takes its text via the `label` STRING PROP — string children render
 *   NOTHING. Native side (`ios/Button/Button.swift`): when `label` is nil
 *   it renders only `Children()` (native subviews); an RN string child is
 *   not a SwiftUI subview, so the button ghosts (shape, no text). We
 *   therefore flatten children to a string via toLabel() and pass it as
 *   `label`; anything non-text (or empty after trim) falls to tier 2.
 *
 * Tier 2 (Android / Expo Go / non-text children): themed Pressable using
 *   the admin-native useListColors palette — borderRadius 10, hairline
 *   border, primary-tinted label, pressed opacity.
 *
 * Visual styles from the web source are intentionally IGNORED (native
 * styling wins); only margin* props from `style` are honored for layout.
 */
import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useListColors } from '@payload-universal/admin-native'
import { NativeHost, nativeComponents } from '@payload-universal/admin-native/fields'

// Liquid glass availability (expo-glass-effect; iOS 26+ dev builds only).
let liquidGlassAvailable = false
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const glassModule = require('expo-glass-effect')
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not installed (Expo Go / Android) */
}

export type NativeActionButtonProps = {
  onPress?: () => void
  disabled?: boolean
  /** Label. Text-only children expected; element children force the Pressable tier. */
  children?: React.ReactNode
  /**
   * 'default'     — plain action (system tint, glass/bordered)
   * 'primary'     — prominent action (theme primary tint, glassProminent/borderedProminent)
   * 'destructive' — SwiftUI destructive role / red label on the fallback tier
   */
  variant?: 'default' | 'primary' | 'destructive'
  /** Accepted for codegen compatibility; only margin* props are honored. */
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Flatten children to a plain label string, or null when not text-only.
 * Joins string/number nodes; any element child (or an empty/whitespace-only
 * result) yields null → caller must use the tier-2 Pressable, because the
 * SwiftUI Button only renders text passed via its `label` prop.
 */
const toLabel = (children: React.ReactNode): string | null => {
  const parts: string[] = []
  let textOnly = true
  React.Children.forEach(children, child => {
    if (child === null || child === undefined || typeof child === 'boolean') return
    if (typeof child === 'string' || typeof child === 'number') {
      parts.push(String(child))
    } else {
      textOnly = false
    }
  })
  if (!textOnly) return null
  const label = parts.join('').trim()
  return label.length > 0 ? label : null
}

const MARGIN_PROPS = [
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  'marginHorizontal',
  'marginVertical',
] as const

/** Keep only margin* props from the (otherwise ignored) web style. */
const extractMargins = (style?: StyleProp<ViewStyle>): ViewStyle | undefined => {
  const flat = StyleSheet.flatten(style)
  if (!flat) return undefined
  const out: Record<string, unknown> = {}
  for (const key of MARGIN_PROPS) {
    if (flat[key] !== undefined) out[key] = flat[key]
  }
  return Object.keys(out).length > 0 ? (out as ViewStyle) : undefined
}

export const NativeActionButton: React.FC<NativeActionButtonProps> = ({
  onPress,
  disabled,
  children,
  variant = 'default',
  style,
  testID,
}) => {
  const { colors } = useListColors()
  const label = toLabel(children)
  const margins = extractMargins(style)

  // ── Tier 1: SwiftUI Button via the registry (iOS dev builds) ──
  const SwiftUIButton = nativeComponents.Button
  const buttonStyleMod = nativeComponents.buttonStyle
  if (SwiftUIButton && buttonStyleMod && label !== null) {
    const prominent = variant === 'primary'
    const modifiers = [
      buttonStyleMod(
        liquidGlassAvailable
          ? prominent ? 'glassProminent' : 'glass'
          : prominent ? 'borderedProminent' : 'bordered',
      ),
      ...(nativeComponents.controlSize ? [nativeComponents.controlSize('regular')] : []),
      ...(prominent && nativeComponents.tint ? [nativeComponents.tint(colors.primary)] : []),
      ...(disabled && nativeComponents.disabled ? [nativeComponents.disabled(true)] : []),
    ]
    return (
      <NativeHost matchContents style={margins}>
        <SwiftUIButton
          label={label}
          role={variant === 'destructive' ? 'destructive' : undefined}
          onPress={disabled ? undefined : onPress}
          modifiers={modifiers}
        />
      </NativeHost>
    )
  }

  // ── Tier 2: themed Pressable (Android / Expo Go / non-text children) ──
  const labelColor =
    variant === 'destructive'
      ? colors.destructive
      : variant === 'primary'
        ? colors.primaryText
        : colors.primary
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        fallbackStyles.base,
        {
          backgroundColor: variant === 'primary' ? colors.primary : colors.card,
          borderColor: colors.hairline,
        },
        disabled && fallbackStyles.disabled,
        pressed && !disabled && fallbackStyles.pressed,
        margins,
      ]}
    >
      {label !== null ? (
        <Text style={[fallbackStyles.label, { color: labelColor }]}>{label}</Text>
      ) : (
        // Arbitrary (non-text-only) children. Wrap stray string/number nodes
        // in <Text> — RN throws on bare strings inside a Pressable.
        React.Children.map(children, child =>
          typeof child === 'string' || typeof child === 'number' ? (
            <Text style={[fallbackStyles.label, { color: labelColor }]}>{child}</Text>
          ) : (
            child
          ),
        )
      )}
    </Pressable>
  )
}

const fallbackStyles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  label: { fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.55 },
})
