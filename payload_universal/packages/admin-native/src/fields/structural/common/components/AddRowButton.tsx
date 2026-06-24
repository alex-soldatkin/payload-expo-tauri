import React from 'react'
import { Pressable, Text, View } from 'react-native'

import { nativeComponents } from '../../../shared'
import { NativeHost } from '../../../NativeHost'
import { GlassView, liquidGlassAvailable } from '../glass'
import { usePalette } from '../palette'
import { commonStyles } from '../styles'

// ---------------------------------------------------------------------------
// Add button — three-tier, liquid-glass on iOS 26+.
// ---------------------------------------------------------------------------

export const AddRowButton: React.FC<{
  label: string
  onPress: () => void
  /** maxRows reached — render the affordance disabled. */
  disabled?: boolean
}> = ({ label, onPress, disabled }) => {
  const palette = usePalette()

  // Tier 1 — SwiftUI Button (glass on iOS 26+, bordered otherwise).
  const NativeButton = nativeComponents.Button
  const buttonStyleMod = nativeComponents.buttonStyle
  const disabledMod = nativeComponents.disabled
  if (NativeButton) {
    const modifiers = [
      ...(buttonStyleMod ? [buttonStyleMod(liquidGlassAvailable ? 'glass' : 'bordered')] : []),
      ...(disabled && disabledMod ? [disabledMod(true)] : []),
    ]
    return (
      <View style={commonStyles.addBtnWrapper}>
        <NativeHost matchContents>
          <NativeButton
            label={label}
            systemImage="plus"
            onPress={disabled ? undefined : onPress}
            modifiers={modifiers.length > 0 ? modifiers : undefined}
          />
        </NativeHost>
      </View>
    )
  }

  // Tier 2 — JC Button (Material tonal style).
  const JCButton = nativeComponents.JCButton
  if (JCButton) {
    return (
      <View style={commonStyles.addBtnWrapper}>
        <NativeHost matchContents>
          <JCButton variant="outlined" leadingIcon="filled.Add" disabled={disabled} onPress={onPress}>
            {label}
          </JCButton>
        </NativeHost>
      </View>
    )
  }

  // Tier 3 — pure JS (GlassView pressable on iOS 26+, plain otherwise).
  if (liquidGlassAvailable && GlassView) {
    return (
      <Pressable onPress={disabled ? undefined : onPress} style={disabled && commonStyles.addBtnDisabled}>
        <GlassView style={commonStyles.glassAddBtn} isInteractive glassEffectStyle="regular">
          <Text style={[commonStyles.addText, { color: palette.primary }]}>+ {label}</Text>
        </GlassView>
      </Pressable>
    )
  }
  return (
    <Pressable
      style={[commonStyles.addBtn, disabled && commonStyles.addBtnDisabled]}
      onPress={disabled ? undefined : onPress}
    >
      <Text style={[commonStyles.addText, { color: palette.primary }]}>+ {label}</Text>
    </Pressable>
  )
}
