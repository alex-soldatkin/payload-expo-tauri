/**
 * Chip editor for hasMany text/number fields.
 *
 * Existing values render as removable chips — native SwiftUI Buttons with
 * buttonStyle('glass') in an HStack (wrapped in a GlassEffectContainer when
 * available, iOS 26+) — falling back to pure-JS pills everywhere else.
 * An inline add field appends values; numbers stay typed (parsed, never
 * stored as strings). minRows blocks removal below the floor, maxRows hides
 * the add affordance at the ceiling.
 */
import React, { useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { defaultTheme as t } from '../../theme'
import { nativeComponents } from '../shared'
import type { NativeModifier } from '../shared'
import { NativeHost } from '../NativeHost'
import { useInputColors } from './colors'

type HasManyChipsEditorProps = {
  kind: 'text' | 'number'
  values: Array<string | number>
  onChangeValues: (next: Array<string | number>) => void
  placeholder?: string
  minRows?: number
  maxRows?: number
  disabled?: boolean
}

export const HasManyChipsEditor: React.FC<HasManyChipsEditorProps> = ({
  kind,
  values,
  onChangeValues,
  placeholder,
  minRows,
  maxRows,
  disabled,
}) => {
  const colors = useInputColors()
  const [draft, setDraft] = useState('')

  const atMax = maxRows != null && values.length >= maxRows
  const atMin = minRows != null && values.length <= minRows
  const canRemove = !disabled && !atMin

  const removeAt = (index: number) => {
    if (!canRemove) return
    onChangeValues(values.filter((_, i) => i !== index))
  }

  const commitDraft = () => {
    const raw = draft.trim()
    if (!raw || disabled || atMax) return
    if (kind === 'number') {
      const n = Number(raw)
      if (Number.isNaN(n)) return // keep the draft visible — never coerce garbage
      onChangeValues([...values, n])
    } else {
      onChangeValues([...values, raw])
    }
    setDraft('')
  }

  // ── Chips row ──
  let chipsRow: React.ReactNode = null
  const NativeButton = nativeComponents.Button
  const NativeHStack = nativeComponents.HStack
  if (values.length > 0) {
    if (NativeButton && NativeHStack && nativeComponents.Host) {
      // iOS: native glass chips
      const chipModifiers: NativeModifier[] = []
      if (nativeComponents.buttonStyle) chipModifiers.push(nativeComponents.buttonStyle('glass'))
      if (nativeComponents.controlSize) chipModifiers.push(nativeComponents.controlSize('small'))
      const chipButtons = values.map((v, i) => (
        <NativeButton
          key={`${String(v)}-${i}`}
          label={String(v)}
          systemImage={canRemove ? 'xmark' : undefined}
          onPress={() => removeAt(i)}
          modifiers={chipModifiers.length > 0 ? chipModifiers : undefined}
        />
      ))
      const stack = <NativeHStack spacing={t.spacing.sm}>{chipButtons}</NativeHStack>
      const Glass = nativeComponents.GlassEffectContainer
      chipsRow = (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.chipScroll}
        >
          <NativeHost matchContents>
            {Glass ? <Glass spacing={t.spacing.sm}>{stack}</Glass> : stack}
          </NativeHost>
        </ScrollView>
      )
    } else {
      // JS fallback pills (Android / Expo Go)
      chipsRow = (
        <View style={styles.chipWrap}>
          {values.map((v, i) => (
            <Pressable
              key={`${String(v)}-${i}`}
              onPress={() => removeAt(i)}
              disabled={!canRemove}
              style={[styles.chip, { backgroundColor: colors.fill }]}
            >
              <Text style={[styles.chipText, { color: colors.text }]}>{String(v)}</Text>
              {canRemove && <Text style={[styles.chipRemove, { color: colors.textMuted }]}>✕</Text>}
            </Pressable>
          ))}
        </View>
      )
    }
  }

  return (
    <View style={styles.container}>
      {chipsRow}
      {!disabled && !atMax && (
        <View style={[styles.addRow, { borderColor: colors.separator }]}>
          <TextInput
            style={[styles.addInput, { color: colors.text }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder ?? (kind === 'number' ? 'Add number' : 'Add value')}
            placeholderTextColor={colors.textPlaceholder}
            keyboardType={
              kind === 'number'
                ? Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'
                : 'default'
            }
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={commitDraft}
          />
          <Pressable onPress={commitDraft} disabled={!draft.trim()} hitSlop={8}>
            <Text
              style={[
                styles.addButton,
                { color: draft.trim() ? colors.accent : colors.textPlaceholder },
              ]}
            >
              Add
            </Text>
          </Pressable>
        </View>
      )}
      {atMax && (
        <Text style={[styles.limitHint, { color: colors.textPlaceholder }]}>
          Maximum of {maxRows} value{maxRows === 1 ? '' : 's'}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: t.spacing.sm },

  // Native chip scroller
  chipScroll: { flexGrow: 0 },

  // JS fallback pills
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs + 2,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
    borderRadius: t.borderRadius.lg,
  },
  chipText: { fontSize: t.fontSize.sm },
  chipRemove: { fontSize: t.fontSize.xs },

  // Inline add field
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: t.spacing.xs,
  },
  addInput: {
    flex: 1,
    fontSize: t.fontSize.md,
    paddingVertical: t.spacing.xs,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  addButton: { fontSize: t.fontSize.sm, fontWeight: '600' },
  limitHint: { fontSize: t.fontSize.xs },
})
