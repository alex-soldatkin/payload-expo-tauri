/**
 * Settings-style segmented picker row — native SwiftUI Picker when available,
 * chip fallback otherwise. Used by the Account screen's Preferences card.
 *
 * App screens MAY import @expo/ui/swift-ui directly (tab layout precedent).
 * SwiftUI modifiers MUST be factory calls from '@expo/ui/swift-ui/modifiers'.
 */
import React from 'react'
import { Platform, Pressable, Text, useColorScheme, View } from 'react-native'

let SHost: any = null
let SPicker: any = null
let SText: any = null
let pickerStyleMod: ((style: string) => any) | null = null
let tagMod: ((tag: string) => any) | null = null
if (Platform.OS === 'ios') {
  try {
    const ui = require('@expo/ui/swift-ui')
    const mods = require('@expo/ui/swift-ui/modifiers')
    SHost = ui.Host
    SPicker = ui.Picker
    SText = ui.Text
    pickerStyleMod = mods.pickerStyle
    tagMod = mods.tag
  } catch {
    /* @expo/ui not available */
  }
}

export function PreferencePickerRow<T extends string>({
  label,
  options,
  optionLabels,
  value,
  onChange,
}: {
  label: string
  options: T[]
  optionLabels: Record<string, string>
  value: T
  onChange: (value: T) => void
}) {
  const isDark = useColorScheme() === 'dark'
  if (SHost && SPicker && SText && pickerStyleMod && tagMod) {
    return (
      <View style={{ paddingVertical: 6 }}>
        <Text className="mb-2 text-sm font-semibold text-ink">{label}</Text>
        {/* matchContents — zero-height hosts swallow touches */}
        <SHost matchContents={{ vertical: true }} style={{ width: '100%' }}>
          <SPicker
            selection={value}
            onSelectionChange={(sel: string | number | null) => {
              if (typeof sel === 'string' && (options as string[]).includes(sel)) {
                onChange(sel as T)
              }
            }}
            modifiers={[pickerStyleMod('segmented')]}
          >
            {options.map((opt) => (
              <SText key={opt} modifiers={[tagMod!(opt)]}>
                {optionLabels[opt] ?? opt}
              </SText>
            ))}
          </SPicker>
        </SHost>
      </View>
    )
  }

  // JS fallback — chip row
  return (
    <View style={{ paddingVertical: 6 }}>
      <Text className="mb-2 text-sm font-semibold text-ink">{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: value === opt ? '#007AFF' : 'rgba(120,120,128,0.16)',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: value === opt ? '#fff' : isDark ? '#f2f2f2' : '#1f1f1f',
              }}
            >
              {optionLabels[opt] ?? opt}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
