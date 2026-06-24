/**
 * Number field component.
 *
 * The bounded stepper (iOS) is the one INLINE row (label left, control right):
 * it renders only when the field is fully bounded with an integer step. Plain
 * number entry is a STACKED row like text/email. hasMany number renders a chip
 * editor under a stacked label.
 */
import React, { useRef } from 'react'
import { TextInput } from 'react-native'

import type { ClientNumberField, FieldComponentProps } from '../../types'
import { defaultTheme as t } from '../../theme'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { FieldShell, fieldShellStyles, nativeComponents } from '../shared'
import { NativeHost } from '../NativeHost'
import { useInputColors } from './colors'
import { useUncontrolledTextBridge } from './textBridge'
import { hasNativeSingleLineText, NativeTextRow } from './NativeTextRow'
import { HasManyChipsEditor } from './HasManyChips'
import { clampNumber } from './utils'
import { styles } from './styles'

const NumberFieldNative: React.FC<FieldComponentProps<ClientNumberField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const isDisabled = disabled || field.admin?.readOnly
  const { min, max } = field
  const step = (field.admin as { step?: number } | undefined)?.step ?? 1
  const externalText = value != null ? String(value) : ''
  // Negative values need a keyboard with a minus key.
  const keyboardType = min == null || min < 0 ? 'numbers-and-punctuation' : 'decimal-pad'

  const valueRef = useRef(value)
  valueRef.current = value

  const bridge = useUncontrolledTextBridge(externalText, (raw) => {
    if (raw === '' || raw === '-') {
      onChange(raw)
      return raw
    }
    const n = Number(raw)
    if (Number.isNaN(n)) return undefined // in-progress/garbage — form unchanged
    onChange(n)
    return String(n)
  })

  // Blur: normalize leftover partial input and clamp into [min, max].
  const handleBlur = () => {
    const current = valueRef.current
    const n =
      typeof current === 'number'
        ? current
        : typeof current === 'string' && current !== '' && current !== '-'
          ? Number(current)
          : NaN
    if (!Number.isFinite(n)) return
    const clamped = clampNumber(n, min, max)
    if (current !== clamped) onChange(clamped)
    bridge.setText(String(clamped))
  }

  // ── Stepper (iOS): only when the field is fully bounded with an integer step ──
  const Stepper = nativeComponents.Stepper
  const HStack = nativeComponents.HStack
  const NativeTextField = nativeComponents.TextField
  const showStepper =
    Stepper != null && HStack != null && NativeTextField != null &&
    min != null && max != null && Number.isInteger(step) && step > 0

  const numericValue =
    typeof value === 'number' ? value : value != null && value !== '' ? Number(value) : NaN
  const stepperBase = Number.isFinite(numericValue) ? clampNumber(numericValue, min, max) : (min ?? 0)

  // STABLE @expo/ui: the SwiftUI Stepper is CONTROLLED (value/onValueChange)
  // — the canary uncontrolled defaultValue/onValueChanged + epoch-remount
  // echo workaround is obsolete.
  const handleStepper = (v: number) => {
    if (isDisabled) return
    const clamped = clampNumber(v, min, max)
    bridge.setText(String(clamped))
    onChange(clamped)
  }

  let content: React.ReactNode
  if (showStepper && NativeTextField && Stepper && HStack) {
    const stepperModifiers = [
      ...(nativeComponents.fixedSize ? [nativeComponents.fixedSize({ horizontal: true, vertical: false })] : []),
      ...(isDisabled && nativeComponents.disabled ? [nativeComponents.disabled(true)] : []),
    ]
    // Stable @expo/ui: keyboardType / autocorrection / onSubmit are MODIFIERS
    // (the canary TextField props died); initial text via bridge.attachRef.
    // font 16 keeps number-entry text the same size whether or not the
    // bounded stepper is present (NativeTextRow applies the same size).
    const textFieldModifiers = [
      ...(nativeComponents.font ? [nativeComponents.font({ size: 16 })] : []),
      ...(nativeComponents.keyboardType ? [nativeComponents.keyboardType(keyboardType)] : []),
      ...(nativeComponents.autocorrectionDisabled ? [nativeComponents.autocorrectionDisabled(true)] : []),
      ...(nativeComponents.onSubmit ? [nativeComponents.onSubmit(() => { void bridge.ref.current?.blur?.() })] : []),
      ...(isDisabled && nativeComponents.disabled ? [nativeComponents.disabled(true)] : []),
    ]
    content = (
      <NativeHost matchContents={{ height: true }} style={isDisabled ? fieldShellStyles.disabledHost : undefined}>
        <HStack spacing={t.spacing.sm}>
          <NativeTextField
            ref={bridge.attachRef}
            placeholder={field.admin?.placeholder}
            onTextChange={bridge.handleChangeText}
            onFocusChange={(focused: boolean) => { if (!focused) handleBlur() }}
            modifiers={textFieldModifiers.length > 0 ? textFieldModifiers : undefined}
          />
          <Stepper
            label=""
            value={stepperBase}
            min={min}
            max={max}
            step={step}
            onValueChange={handleStepper}
            modifiers={stepperModifiers.length > 0 ? stepperModifiers : undefined}
          />
        </HStack>
      </NativeHost>
    )
  } else {
    content = (
      <NativeTextRow
        bridge={bridge}
        placeholder={field.admin?.placeholder}
        keyboardType={keyboardType}
        autocorrection={false}
        disabled={isDisabled}
        onBlur={handleBlur}
      />
    )
  }

  // Row contract: the bounded stepper is an INLINE row (label left, control
  // right); a plain number entry is a STACKED row like text/email.
  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
      layout={showStepper ? 'inline' : 'stacked'}
    >
      {content}
    </FieldShell>
  )
}

const NumberFieldFallback: React.FC<FieldComponentProps<ClientNumberField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const c = useInputColors()
  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      <TextInput
        style={[styles.stackedInput, { color: c.text }, disabled && styles.disabled]}
        value={value != null ? String(value) : ''}
        onChangeText={(v) => {
          if (v === '' || v === '-') { onChange(v); return }
          const n = Number(v)
          onChange(Number.isNaN(n) ? value : n)
        }}
        onBlur={() => {
          if (typeof value !== 'number') return
          const clamped = clampNumber(value, field.min, field.max)
          if (clamped !== value) onChange(clamped)
        }}
        placeholder={field.admin?.placeholder}
        placeholderTextColor={c.textPlaceholder}
        editable={!disabled && !field.admin?.readOnly}
        keyboardType="decimal-pad"
        returnKeyType="done"
      />
    </FieldShell>
  )
}

const HasManyNumberField: React.FC<FieldComponentProps<ClientNumberField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const values = Array.isArray(value)
    ? (value as Array<string | number>).filter((v): v is number => typeof v === 'number')
    : []
  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      <HasManyChipsEditor
        kind="number"
        values={values}
        onChangeValues={(next) => onChange(next)}
        placeholder={field.admin?.placeholder}
        minRows={field.minRows}
        maxRows={field.maxRows}
        disabled={disabled || field.admin?.readOnly}
      />
    </FieldShell>
  )
}

export const NumberField: React.FC<FieldComponentProps<ClientNumberField>> = (props) => {
  if (props.field.hasMany) return <HasManyNumberField {...props} />
  return hasNativeSingleLineText
    ? <NumberFieldNative {...props} />
    : <NumberFieldFallback {...props} />
}
