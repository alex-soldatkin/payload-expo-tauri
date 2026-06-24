// ---------------------------------------------------------------------------
// Date value input — registry DatePicker (iOS) / JCDateTimePicker (Android),
// YYYY-MM-DD text input fallback
// ---------------------------------------------------------------------------
import React, { useCallback } from 'react'
import { TextInput, View } from 'react-native'

import { NativeHost } from '../../fields/NativeHost'
import { nativeComponents } from '../../fields/shared'
import type { ListColorPalette } from '../../hooks/useListColors'
import type { FilterStyles } from '../types'
import { formatDateLabel } from '../utils'

export const DateValueInput: React.FC<{
  value: unknown
  onChange: (v: unknown, label?: string) => void
  colors: ListColorPalette
  styles: FilterStyles
}> = ({ value, onChange, colors, styles }) => {
  const NativeDatePicker = nativeComponents.DatePicker
  const dpStyleMod = nativeComponents.datePickerStyle
  const JCDatePicker = nativeComponents.JCDateTimePicker

  const parsed = typeof value === 'string' && value ? new Date(value) : new Date()
  const selection = isNaN(parsed.getTime()) ? new Date() : parsed

  const handleDate = useCallback(
    (d: Date) => onChange(d.toISOString(), formatDateLabel(d)),
    [onChange],
  )

  if (NativeDatePicker) {
    return (
      <View style={styles.dateWrap}>
        <NativeHost matchContents={{ height: true }}>
          <NativeDatePicker
            selection={selection}
            onDateChange={handleDate}
            displayedComponents={['date']}
            modifiers={dpStyleMod ? [dpStyleMod('graphical')] : undefined}
          />
        </NativeHost>
      </View>
    )
  }

  if (JCDatePicker) {
    return (
      <View style={styles.dateWrap}>
        <NativeHost matchContents={{ height: true }}>
          <JCDatePicker
            initialDate={typeof value === 'string' && value ? value : null}
            onDateSelected={handleDate}
            variant="picker"
            displayedComponents="date"
          />
        </NativeHost>
      </View>
    )
  }

  // Pure-JS fallback — ISO date text entry
  return (
    <TextInput
      style={styles.textInput}
      value={value != null ? String(value) : ''}
      onChangeText={(v) => onChange(v)}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={colors.textPlaceholder}
      autoCapitalize="none"
      autoCorrect={false}
      autoFocus
    />
  )
}
