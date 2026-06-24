/**
 * Colour editor (OUTSIDE the Sortable trees — @expo/ui allowed). Native
 * SwiftUI ColorPicker via the admin-native registry (null-checked) with a
 * curated 8-swatch fallback row.
 */
import React from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  getFieldLabel,
  NO_STATUS_COLUMN_VALUE,
  useListColors,
  type ClientField,
} from '@payload-universal/admin-native'
import { nativeComponents, NativeHost } from '@payload-universal/admin-native/fields'

import type { KanbanSheetStyles } from './styles'
import { SWATCHES } from './utils'

export function ColorEditorSection({
  colorTarget,
  activeField,
  labelByValue,
  resolveColor,
  setColumnColor,
  resetColumnColor,
  styles,
}: {
  colorTarget: string
  activeField: ClientField | undefined
  labelByValue: Map<string, string>
  resolveColor: (value: string) => string
  setColumnColor: (value: string, color: string) => void
  resetColumnColor: (value: string) => void
  styles: KanbanSheetStyles
}) {
  const { colors } = useListColors()
  const NativeColorPicker = nativeComponents.ColorPicker

  return (
    <View style={styles.colorSection}>
      <View style={styles.colorHeader}>
        <Text style={styles.sectionLabel}>
          {`COLOR — ${
            colorTarget === NO_STATUS_COLUMN_VALUE
              ? `No ${activeField ? getFieldLabel(activeField) : 'Status'}`
              : labelByValue.get(colorTarget) ?? colorTarget
          }`}
        </Text>
        <Pressable hitSlop={8} onPress={() => resetColumnColor(colorTarget)}>
          <Text style={styles.colorReset}>Reset</Text>
        </Pressable>
      </View>
      {NativeColorPicker ? (
        <View style={styles.colorPickerWrap}>
          <NativeHost matchContents>
            <NativeColorPicker
              selection={resolveColor(colorTarget)}
              label="Column color"
              supportsOpacity={false}
              onSelectionChange={(hex) => setColumnColor(colorTarget, hex)}
            />
          </NativeHost>
        </View>
      ) : (
        <View style={styles.swatchRow}>
          {SWATCHES.map((hex) => {
            const selected = resolveColor(colorTarget).toLowerCase() === hex.toLowerCase()
            return (
              <Pressable
                key={hex}
                onPress={() => setColumnColor(colorTarget, hex)}
                style={[
                  styles.swatchLarge,
                  { backgroundColor: hex },
                  selected && { borderColor: colors.text, borderWidth: 2 },
                ]}
              />
            )
          })}
        </View>
      )}
    </View>
  )
}
