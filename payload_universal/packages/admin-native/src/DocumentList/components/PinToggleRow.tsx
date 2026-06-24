/**
 * Pin toggle row — registry SwiftUI Toggle (switch) with a lucide fallback.
 * Rendered only in plain sections, never inside Sortable trees.
 */
import React from 'react'
import { Pressable, Text, View } from 'react-native'

import type { ListColorPalette } from '../../hooks/useListColors'
import { NativeHost } from '../../fields/NativeHost'
import { nativeComponents } from '../../fields/shared'
import { ToggleLeftIcon, ToggleRightIcon } from '../icons'
import type { createSfStyles } from '../styles'

export function PinToggleRow({
  label,
  value,
  onChange,
  colors,
  sfStyles,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
  colors: ListColorPalette
  sfStyles: ReturnType<typeof createSfStyles>
}) {
  const NativeToggle = nativeComponents.Toggle

  return (
    <View style={sfStyles.pinRow}>
      <Text style={sfStyles.pinLabel}>{label}</Text>
      {NativeToggle ? (
        <NativeHost matchContents>
          <NativeToggle isOn={value} onIsOnChange={onChange} />
        </NativeHost>
      ) : (
        <Pressable
          hitSlop={8}
          onPress={() => onChange(!value)}
          accessibilityRole="switch"
          accessibilityState={{ checked: value }}
          accessibilityLabel={label}
        >
          {value ? (
            ToggleRightIcon ? (
              <ToggleRightIcon size={30} color={colors.primary} />
            ) : (
              <Text style={[sfStyles.pinFallbackText, { color: colors.primary }]}>On</Text>
            )
          ) : ToggleLeftIcon ? (
            <ToggleLeftIcon size={30} color={colors.textMuted} />
          ) : (
            <Text style={[sfStyles.pinFallbackText, { color: colors.textMuted }]}>Off</Text>
          )}
        </Pressable>
      )}
    </View>
  )
}
