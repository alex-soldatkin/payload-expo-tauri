/**
 * Page size selector — native segmented picker with a chip-row fallback.
 */
import React from 'react'
import { Pressable, Text, View } from 'react-native'

import { NativeHost } from '../../fields/NativeHost'
import { nativeComponents } from '../../fields/shared'
import type { createSfStyles } from '../styles'

export function PageSizeSelector({
  pageSize,
  options,
  onChange,
  sfStyles,
}: {
  pageSize: number
  options: number[]
  onChange: (pageSize: number) => void
  sfStyles: ReturnType<typeof createSfStyles>
}) {
  const NativePicker = nativeComponents.Picker
  const NativeText = nativeComponents.Text
  const tagMod = nativeComponents.tag
  const psMod = nativeComponents.pickerStyle

  if (NativePicker && NativeText && tagMod && psMod) {
    return (
      <View style={sfStyles.pageSizeWrap}>
        <NativeHost matchContents={{ height: true }}>
          <NativePicker
            selection={String(pageSize)}
            onSelectionChange={(v) => {
              const n = Number(v)
              if (Number.isFinite(n) && n > 0) onChange(n)
            }}
            modifiers={[psMod('segmented')]}
          >
            {options.map((o) => (
              <NativeText key={o} modifiers={[tagMod(String(o))]}>
                {String(o)}
              </NativeText>
            ))}
          </NativePicker>
        </NativeHost>
      </View>
    )
  }

  return (
    <View style={sfStyles.pageSizeRow}>
      {options.map((o) => {
        const active = o === pageSize
        return (
          <Pressable
            key={o}
            style={[sfStyles.pageSizeChip, active && sfStyles.pageSizeChipActive]}
            onPress={() => onChange(o)}
          >
            <Text style={[sfStyles.pageSizeText, active && sfStyles.pageSizeTextActive]}>
              {o}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
