/**
 * Radio field.
 *
 * - iOS: SwiftUI Picker — segmented for small option sets, menu otherwise.
 * - Android: JC Picker — radio variant (Material), segmented when the web
 *   admin declares a horizontal layout with few options.
 * - Fallback: pure JS respecting admin.layout ('horizontal' chips /
 *   'vertical' radio rows).
 */
import React from 'react'
import { StyleSheet } from 'react-native'

import type { ClientRadioField, FieldComponentProps } from '../../types'
import { getFieldDescription, getFieldLabel, normalizeOption } from '../../utils/schemaHelpers'
import { FieldShell, fieldShellStyles, nativeComponents } from '../shared'
import { NativeHost } from '../NativeHost'
import { OptionChipList, RadioOptionRows } from './shared'
import { SEGMENTED_THRESHOLD } from './select'

// ---------------------------------------------------------------------------
// iOS — SwiftUI Picker (segmented <= threshold, else menu)
// ---------------------------------------------------------------------------

const RadioFieldNative: React.FC<FieldComponentProps<ClientRadioField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const NativePicker = nativeComponents.Picker!
  const NativeText = nativeComponents.Text!
  const tag = nativeComponents.tag!
  const psModifier = nativeComponents.pickerStyle!
  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly
  const useSegmented = options.length <= SEGMENTED_THRESHOLD

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <NativeHost matchContents={{ height: true }} style={[styles.hostFullWidth, isDisabled && fieldShellStyles.disabledHost]}>
        <NativePicker
          selection={value != null ? String(value) : ''}
          onSelectionChange={(s: any) => { if (!isDisabled) onChange(s === '' ? null : s) }}
          modifiers={useSegmented ? [psModifier('segmented')] : undefined}
        >
          {!useSegmented && <NativeText modifiers={[tag('')]}>Select...</NativeText>}
          {options.map((opt) => (
            <NativeText key={opt.value} modifiers={[tag(String(opt.value))]}>{opt.label}</NativeText>
          ))}
        </NativePicker>
      </NativeHost>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Android — JC Picker (radio / segmented)
// ---------------------------------------------------------------------------

const RadioFieldJC: React.FC<FieldComponentProps<ClientRadioField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const JCPicker = nativeComponents.JCPicker!
  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly
  const layout = field.admin?.layout ?? 'horizontal'
  const selectedIdx = options.findIndex((o) => o.value === String(value ?? ''))
  // Horizontal web layout with few options → Material segmented buttons;
  // everything else → radio list (web-admin parity for radio groups).
  const variant: 'segmented' | 'radio' =
    layout === 'horizontal' && options.length <= SEGMENTED_THRESHOLD ? 'segmented' : 'radio'

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
      layout={variant === 'radio' ? 'stacked' : 'inline'}
    >
      <NativeHost matchContents={{ height: true }} style={[styles.hostFullWidth, isDisabled && fieldShellStyles.disabledHost]}>
        <JCPicker
          variant={variant}
          options={options.map((o) => o.label)}
          selectedIndex={selectedIdx >= 0 ? selectedIdx : null}
          onOptionSelected={(e) => {
            if (isDisabled) return
            onChange(options[e.nativeEvent.index]?.value ?? null)
          }}
        />
      </NativeHost>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// JS fallback — respects admin.layout
// ---------------------------------------------------------------------------

const RadioFieldFallback: React.FC<FieldComponentProps<ClientRadioField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly
  const layout = field.admin?.layout ?? 'horizontal'

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
      layout={layout === 'vertical' ? 'stacked' : 'inline'}
    >
      {layout === 'vertical' ? (
        <RadioOptionRows
          options={options}
          selected={(value as string) ?? null}
          onChange={onChange}
          disabled={isDisabled}
        />
      ) : (
        <OptionChipList
          options={options}
          selected={(value as string) ?? null}
          onChange={onChange}
          disabled={isDisabled}
          clearable={false}
        />
      )}
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export const RadioField: React.FC<FieldComponentProps<ClientRadioField>> = (props) => {
  if (nativeComponents.Picker && nativeComponents.Text && nativeComponents.tag && nativeComponents.pickerStyle) {
    return <RadioFieldNative {...props} />
  }
  if (nativeComponents.Host && nativeComponents.JCPicker) return <RadioFieldJC {...props} />
  return <RadioFieldFallback {...props} />
}

const styles = StyleSheet.create({
  hostFullWidth: { alignSelf: 'stretch' },
})
