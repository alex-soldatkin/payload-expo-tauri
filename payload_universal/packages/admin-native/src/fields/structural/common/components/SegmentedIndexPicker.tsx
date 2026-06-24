import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { defaultTheme as t } from '../../../../theme'
import { nativeComponents } from '../../../shared'
import { NativeHost } from '../../../NativeHost'
import { usePalette } from '../palette'
import { commonStyles } from '../styles'
import { SEGMENTED_THRESHOLD, withErrorSuffix } from '../utils'
import { ErrorBadge } from './ErrorBadge'

// ---------------------------------------------------------------------------
// Segmented index picker — shared by Tabs and Array (switcher mode).
// Three tiers:
//   1. SwiftUI Picker + pickerStyle('segmented')   (iOS, registry-gated)
//   2. JC Picker variant='segmented'               (Android, registry-gated)
//   3. PillTabBar                                  (pure JS fallback)
// Native segmented controls cap at SEGMENTED_THRESHOLD entries; beyond that
// the JS pill bar renders horizontally scrollable.
// ---------------------------------------------------------------------------

/** Pill-style tab bar — JS fallback on all platforms; scrolls when crowded. */
export const PillTabBar: React.FC<{
  labels: string[]
  activeIndex: number
  setActiveIndex: (i: number) => void
  errorCounts?: number[]
}> = ({ labels, activeIndex, setActiveIndex, errorCounts }) => {
  const palette = usePalette()
  const scrollable = labels.length > SEGMENTED_THRESHOLD

  const pills = labels.map((label, i) => {
    const errs = errorCounts?.[i] ?? 0
    const isActive = i === activeIndex
    return (
      <Pressable
        key={`pill-${i}`}
        style={[
          commonStyles.pill,
          !scrollable && commonStyles.pillFlex,
          isActive && [commonStyles.pillActive, { backgroundColor: palette.pillActiveBg }],
        ]}
        onPress={() => setActiveIndex(i)}
      >
        <Text
          style={[
            commonStyles.pillText,
            { color: isActive ? palette.text : palette.textMuted },
            isActive && commonStyles.pillTextActive,
            errs > 0 && { color: t.colors.error },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <ErrorBadge count={errs} />
      </Pressable>
    )
  })

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={commonStyles.pillScroll}>
        <View style={[commonStyles.pillBar, { backgroundColor: palette.pillBarBg }]}>{pills}</View>
      </ScrollView>
    )
  }
  return <View style={[commonStyles.pillBar, { backgroundColor: palette.pillBarBg }]}>{pills}</View>
}

export const SegmentedIndexPicker: React.FC<{
  labels: string[]
  selectedIndex: number
  onSelect: (index: number) => void
  errorCounts?: number[]
}> = ({ labels, selectedIndex, onSelect, errorCounts }) => {
  // Error counts fold into the segment text — native segments are text-only.
  const display = labels.map((label, i) => withErrorSuffix(label, errorCounts?.[i] ?? 0))

  const fitsNative = labels.length <= SEGMENTED_THRESHOLD
  // Tier 1 — SwiftUI segmented Picker. Gate REQUIRES the pickerStyle + tag
  // modifier factories: they are null on Android / Expo Go and calling them
  // with `!` behind a looser gate is a TypeError.
  const canSwiftUI = !!(
    nativeComponents.Picker &&
    nativeComponents.Text &&
    nativeComponents.pickerStyle &&
    nativeComponents.tag
  ) && fitsNative
  // Tier 2 — Jetpack Compose segmented Picker (options-based API).
  const canJC = !!nativeComponents.JCPicker && fitsNative

  if (canSwiftUI) {
    const NativePicker = nativeComponents.Picker!
    const NativeText = nativeComponents.Text!
    return (
      <View style={commonStyles.segmentedWrapper}>
        <NativeHost matchContents={{ height: true }}>
          <NativePicker
            selection={String(selectedIndex)}
            onSelectionChange={(s: any) => {
              const idx = typeof s === 'number' ? s : parseInt(String(s), 10)
              if (!isNaN(idx) && idx >= 0 && idx < labels.length) onSelect(idx)
            }}
            modifiers={[nativeComponents.pickerStyle!('segmented')]}
          >
            {display.map((label, i) => (
              <NativeText key={`seg-${i}`} modifiers={[nativeComponents.tag!(String(i))]}>
                {label}
              </NativeText>
            ))}
          </NativePicker>
        </NativeHost>
      </View>
    )
  }

  if (canJC) {
    const JCPicker = nativeComponents.JCPicker!
    return (
      <View style={commonStyles.segmentedWrapper}>
        <NativeHost matchContents={{ height: true }}>
          <JCPicker
            options={display}
            selectedIndex={selectedIndex}
            variant="segmented"
            onOptionSelected={(e) => {
              const idx = e?.nativeEvent?.index
              if (typeof idx === 'number' && idx >= 0 && idx < labels.length) onSelect(idx)
            }}
          />
        </NativeHost>
      </View>
    )
  }

  return (
    <PillTabBar labels={labels} activeIndex={selectedIndex} setActiveIndex={onSelect} errorCounts={errorCounts} />
  )
}
