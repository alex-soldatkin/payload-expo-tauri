/**
 * Select field.
 *
 * Single value:
 *   - iOS: SwiftUI Picker (menu style) via the nativeComponents registry.
 *   - Android: JC Picker — inline segmented for small option sets, radio list
 *     in a bottom sheet otherwise (Material dialog idiom).
 *   - Fallback: @react-native-picker/picker wheel, else pure-JS chips.
 *
 * hasMany:
 *   - Toggleable option chips (glass chips on iOS 26+, Material FilterChips
 *     on Android via JCChip) + an ordered "selected" strip with JS reorder
 *     buttons when admin.isSortable (web-admin parity).
 *
 * isClearable renders a clear affordance (defaults: !required for single,
 * true for hasMany — matching the web admin).
 */
import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { ClientSelectField, FieldComponentProps } from '../../types'
import { defaultTheme as t } from '../../theme'
import { getFieldDescription, getFieldLabel, normalizeOption } from '../../utils/schemaHelpers'
import { BottomSheet } from '../../BottomSheet'
import { FieldShell, fieldShellStyles, nativeComponents, ROW_MIN_HEIGHT } from '../shared'
import { NativeHost } from '../NativeHost'
import {
  GlassChip,
  LucideIcon,
  OptionChipList,
  sharedStyles,
  usePickerPalette,
} from './shared'

// Dynamic import — @react-native-picker/picker requires a native module
// not available in Expo Go. Falls back to a simple Pressable-based picker.
let RNPicker: any = null
try { RNPicker = require('@react-native-picker/picker').Picker } catch { /* not available */ }

export const SEGMENTED_THRESHOLD = 5

// ---------------------------------------------------------------------------
// hasMany — sortable chip row (shared across platforms)
// ---------------------------------------------------------------------------

const SelectFieldMultiChips: React.FC<FieldComponentProps<ClientSelectField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const palette = usePickerPalette()
  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly
  const selected: string[] = Array.isArray(value)
    ? (value as unknown[]).map(String)
    : value != null && value !== '' ? [String(value)] : []
  const sortable = field.admin?.isSortable ?? true
  const clearable = field.admin?.isClearable ?? true

  const JCChip = nativeComponents.JCChip
  const hasJCChip = Boolean(JCChip && nativeComponents.Host)

  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v])

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= selected.length) return
    const next = [...selected]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(next)
  }

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      {/* All options as toggle chips */}
      <View style={sharedStyles.chipContainer}>
        {options.map((opt) => {
          const on = selected.includes(opt.value)
          if (hasJCChip && JCChip) {
            return (
              <NativeHost key={opt.value} matchContents>
                <JCChip
                  variant="filter"
                  label={opt.label}
                  selected={on}
                  enabled={!isDisabled}
                  onPress={() => { if (!isDisabled) toggle(opt.value) }}
                />
              </NativeHost>
            )
          }
          return (
            <GlassChip
              key={opt.value}
              label={opt.label}
              selected={on}
              disabled={isDisabled}
              onPress={() => toggle(opt.value)}
              palette={palette}
              trailing={on ? <LucideIcon name="Check" size={13} color={palette.primaryText} /> : undefined}
            />
          )
        })}
      </View>

      {/* Ordered selection with JS reorder buttons (web parity: isSortable).
          Borderless fill-bg sub-list — FormSection owns all separators. */}
      {sortable && selected.length > 1 && (
        <View style={[styles.orderList, { backgroundColor: palette.fill }]}>
          {selected.map((v, i) => (
            <View key={`${v}-${i}`} style={styles.orderRow}>
              <Text style={[styles.orderIndex, { color: palette.placeholder }]}>{i + 1}</Text>
              <Text style={[styles.orderLabel, { color: palette.text }]} numberOfLines={1}>{labelFor(v)}</Text>
              {!isDisabled && (
                <View style={styles.orderActions}>
                  <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6} style={i === 0 && styles.actionDisabled}>
                    <LucideIcon name="ChevronUp" size={18} color={palette.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => move(i, 1)} disabled={i === selected.length - 1} hitSlop={6} style={i === selected.length - 1 && styles.actionDisabled}>
                    <LucideIcon name="ChevronDown" size={18} color={palette.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => toggle(v)} hitSlop={6}>
                    <LucideIcon name="X" size={16} color={palette.textMuted} />
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {clearable && selected.length > 0 && !isDisabled && (
        <Pressable style={styles.clearBtn} onPress={() => onChange([])} hitSlop={6}>
          <Text style={[styles.clearText, { color: palette.destructive }]}>Clear all</Text>
        </Pressable>
      )}
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Single — iOS SwiftUI Picker (menu)
// ---------------------------------------------------------------------------

const SelectFieldNative: React.FC<FieldComponentProps<ClientSelectField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const NativePicker = nativeComponents.Picker!
  const NativeText = nativeComponents.Text!
  const tag = nativeComponents.tag!
  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly
  const clearable = field.admin?.isClearable ?? !field.required
  // The empty-tag row is the clear affordance in the native menu picker.
  const showEmptyOption = clearable || value == null || value === ''

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <NativeHost matchContents={{ height: true }} style={[styles.hostFullWidth, isDisabled && fieldShellStyles.disabledHost]}>
        <NativePicker
          selection={value != null ? String(value) : ''}
          onSelectionChange={(s: any) => { if (!isDisabled) onChange(s === '' ? null : s) }}
        >
          {showEmptyOption && <NativeText modifiers={[tag('')]}>Select...</NativeText>}
          {options.map((opt) => (
            <NativeText key={opt.value} modifiers={[tag(String(opt.value))]}>{opt.label}</NativeText>
          ))}
        </NativePicker>
      </NativeHost>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Single — Android JC Picker (segmented inline / radio in sheet)
// ---------------------------------------------------------------------------

const SelectFieldJC: React.FC<FieldComponentProps<ClientSelectField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const JCPicker = nativeComponents.JCPicker!
  const palette = usePickerPalette()
  const [open, setOpen] = useState(false)
  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly
  const clearable = field.admin?.isClearable ?? !field.required
  const selectedIdx = options.findIndex((o) => o.value === String(value ?? ''))
  const selectedLabel = selectedIdx >= 0 ? options[selectedIdx].label : null

  // Small option sets: inline Material segmented buttons.
  if (options.length <= SEGMENTED_THRESHOLD) {
    return (
      <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
        <View>
          <NativeHost matchContents={{ height: true }} style={[styles.hostFullWidth, isDisabled && fieldShellStyles.disabledHost]}>
            <JCPicker
              variant="segmented"
              options={options.map((o) => o.label)}
              selectedIndex={selectedIdx >= 0 ? selectedIdx : null}
              onOptionSelected={(e) => {
                if (isDisabled) return
                onChange(options[e.nativeEvent.index]?.value ?? null)
              }}
            />
          </NativeHost>
          {clearable && selectedIdx >= 0 && !isDisabled && (
            <Pressable style={styles.clearBtn} onPress={() => onChange(null)} hitSlop={6}>
              <Text style={[styles.clearText, { color: palette.destructive }]}>Clear</Text>
            </Pressable>
          )}
        </View>
      </FieldShell>
    )
  }

  // Larger sets: trigger row opens a sheet with a Material radio list.
  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <Pressable
        style={styles.triggerRow}
        onPress={() => !isDisabled && setOpen(true)}
        disabled={isDisabled}
      >
        <Text
          style={[styles.triggerText, { color: selectedLabel ? palette.text : palette.placeholder }]}
          numberOfLines={1}
        >
          {selectedLabel ?? 'Select...'}
        </Text>
        {clearable && selectedLabel != null && !isDisabled && (
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <LucideIcon name="X" size={16} color={palette.textMuted} />
          </Pressable>
        )}
        <Text style={[styles.chevron, { color: palette.textMuted }]}>›</Text>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} height={0.6}>
        <Text style={[sharedStyles.sheetTitle, { color: palette.text }]}>{getFieldLabel(field)}</Text>
        <ScrollView showsVerticalScrollIndicator>
          <NativeHost matchContents={{ height: true }} style={styles.hostFullWidth}>
            <JCPicker
              variant="radio"
              options={options.map((o) => o.label)}
              selectedIndex={selectedIdx >= 0 ? selectedIdx : null}
              onOptionSelected={(e) => {
                onChange(options[e.nativeEvent.index]?.value ?? null)
                setOpen(false)
              }}
            />
          </NativeHost>
        </ScrollView>
        {clearable && selectedLabel != null && (
          <Pressable style={styles.clearBtn} onPress={() => { onChange(null); setOpen(false) }}>
            <Text style={[styles.clearText, { color: palette.destructive }]}>Clear selection</Text>
          </Pressable>
        )}
      </BottomSheet>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Single — JS fallback (RN wheel picker or chips)
// ---------------------------------------------------------------------------

const SelectFieldFallback: React.FC<FieldComponentProps<ClientSelectField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const palette = usePickerPalette()
  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly
  const clearable = field.admin?.isClearable ?? !field.required

  if (!RNPicker) {
    return (
      <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
        <OptionChipList
          options={options}
          selected={(value as string) ?? null}
          onChange={onChange}
          disabled={isDisabled}
          clearable={clearable}
        />
      </FieldShell>
    )
  }

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <View style={styles.wheelWrapper}>
        <RNPicker
          selectedValue={value ?? ''} onValueChange={(v: any) => onChange(v === '' ? null : v)}
          enabled={!isDisabled} style={styles.wheelPicker} itemStyle={[styles.wheelItem, { color: palette.text }]}
        >
          <RNPicker.Item label="Select..." value="" color={palette.placeholder} />
          {options.map((opt: any) => <RNPicker.Item key={opt.value} label={opt.label} value={opt.value} color={palette.text} />)}
        </RNPicker>
      </View>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export const SelectField: React.FC<FieldComponentProps<ClientSelectField>> = (props) => {
  if (props.field.hasMany) return <SelectFieldMultiChips {...props} />
  if (nativeComponents.Picker && nativeComponents.Text && nativeComponents.tag) {
    return <SelectFieldNative {...props} />
  }
  if (nativeComponents.Host && nativeComponents.JCPicker) return <SelectFieldJC {...props} />
  return <SelectFieldFallback {...props} />
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  hostFullWidth: { alignSelf: 'stretch' },

  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    minHeight: ROW_MIN_HEIGHT,
  },
  triggerText: { fontSize: t.fontSize.md, flex: 1 },
  chevron: { fontSize: 18, marginLeft: t.spacing.xs },

  // Fill-bg rounded-8 sub-list — NO borders (row contract: FormSection is
  // the only separator owner; field chrome stays borderless).
  orderList: {
    marginTop: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
    overflow: 'hidden',
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
  },
  orderIndex: { fontSize: t.fontSize.xs, width: 16, textAlign: 'center' },
  orderLabel: { flex: 1, fontSize: t.fontSize.sm },
  orderActions: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  actionDisabled: { opacity: 0.3 },

  clearBtn: { paddingVertical: t.spacing.sm, alignSelf: 'flex-start' },
  clearText: { fontSize: t.fontSize.sm },

  wheelWrapper: { backgroundColor: 'transparent', overflow: 'hidden' },
  wheelPicker: { marginHorizontal: -8 },
  wheelItem: { fontSize: t.fontSize.md },
})
