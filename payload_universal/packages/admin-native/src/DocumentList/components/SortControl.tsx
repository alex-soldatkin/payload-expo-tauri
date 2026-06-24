/**
 * Sort control — native menu picker (iOS) with a bottom-sheet fallback.
 */
import React, { useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'

import type { ClientField } from '../../types'
import { getFieldLabel } from '../../utils/schemaHelpers'
import type { ListColorPalette } from '../../hooks/useListColors'
import { BottomSheet } from '../../BottomSheet'
import { NativeHost } from '../../fields/NativeHost'
import { nativeComponents } from '../../fields/shared'
import { ArrowUpDownIcon, GlassView, liquidGlassAvailable } from '../icons'
import type { createStyles } from '../styles'
import type { DocumentListSort } from '../types'

type SortControlProps = {
  sort: DocumentListSort
  sortableFields: ClientField[]
  onChange: (sort: DocumentListSort) => void
  colors: ListColorPalette
  styles: ReturnType<typeof createStyles>
}

export function SortControl({ sort, sortableFields, onChange, colors, styles }: SortControlProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const current = sortableFields.find((f) => f.name === sort.field)
  const currentLabel = current ? getFieldLabel(current) : sort.field
  const toggleDirection = () =>
    onChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })

  const NativePicker = nativeComponents.Picker
  const NativeText = nativeComponents.Text
  const NativeButton = nativeComponents.Button
  const tagMod = nativeComponents.tag
  const psMod = nativeComponents.pickerStyle
  const btnStyleMod = nativeComponents.buttonStyle

  // ── Native path: SwiftUI menu-style picker + direction button ────────
  if (NativePicker && NativeText && tagMod && psMod) {
    return (
      <View style={styles.sortRow}>
        <NativeHost matchContents>
          <NativePicker
            selection={sort.field}
            onSelectionChange={(v) => {
              if (v != null) onChange({ ...sort, field: String(v) })
            }}
            label="Sort"
            systemImage="arrow.up.arrow.down"
            modifiers={[psMod('menu')]}
          >
            {sortableFields.map((f) => (
              <NativeText key={f.name} modifiers={[tagMod(f.name!)]}>
                {getFieldLabel(f)}
              </NativeText>
            ))}
          </NativePicker>
        </NativeHost>
        {NativeButton && btnStyleMod ? (
          <NativeHost matchContents>
            <NativeButton
              systemImage={sort.direction === 'desc' ? 'arrow.down' : 'arrow.up'}
              onPress={toggleDirection}
              modifiers={[btnStyleMod(liquidGlassAvailable ? 'glass' : 'bordered')]}
            />
          </NativeHost>
        ) : (
          <Pressable style={styles.sortDirBtn} onPress={toggleDirection} hitSlop={8}>
            <Text style={styles.sortDirText}>{sort.direction === 'desc' ? '↓' : '↑'}</Text>
          </Pressable>
        )}
      </View>
    )
  }

  // ── JS fallback: chip opens a bottom sheet ────────────────────────────
  const chipInner = (
    <>
      {ArrowUpDownIcon ? <ArrowUpDownIcon size={13} color={colors.textMuted} /> : null}
      <Text style={styles.sortChipText} numberOfLines={1}>
        {currentLabel} {sort.direction === 'desc' ? '↓' : '↑'}
      </Text>
    </>
  )

  return (
    <>
      <Pressable onPress={() => setSheetOpen(true)} hitSlop={4}>
        {liquidGlassAvailable && GlassView ? (
          <GlassView style={styles.sortChip} glassEffectStyle="regular">
            {chipInner}
          </GlassView>
        ) : (
          <View style={[styles.sortChip, styles.sortChipFallback]}>{chipInner}</View>
        )}
      </Pressable>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} height={0.6}>
        <Text style={styles.sortSheetTitle}>Sort by</Text>
        <View style={styles.sortSegmentRow}>
          {(['asc', 'desc'] as const).map((dir) => (
            <Pressable
              key={dir}
              style={[styles.sortSegment, sort.direction === dir && styles.sortSegmentActive]}
              onPress={() => onChange({ ...sort, direction: dir })}
            >
              <Text
                style={[
                  styles.sortSegmentText,
                  sort.direction === dir && styles.sortSegmentTextActive,
                ]}
              >
                {dir === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
              </Text>
            </Pressable>
          ))}
        </View>
        <FlatList
          data={sortableFields}
          keyExtractor={(item) => item.name || item.type}
          renderItem={({ item }) => {
            const active = item.name === sort.field
            return (
              <Pressable
                style={styles.sortFieldRow}
                onPress={() => {
                  if (item.name) onChange({ ...sort, field: item.name })
                  setSheetOpen(false)
                }}
              >
                <Text style={[styles.sortFieldLabel, active && styles.sortFieldLabelActive]}>
                  {getFieldLabel(item)}
                </Text>
                {active && <Text style={styles.sortCheck}>✓</Text>}
              </Pressable>
            )
          }}
        />
      </BottomSheet>
    </>
  )
}
