/**
 * Text + email field components.
 *
 * Both render the canonical STACKED row: a native single-line input
 * (SwiftUI TextField / SecureField on iOS, JC TextInput on Android) through
 * NativeTextRow when available, with the pure-JS RN TextInput as the final
 * fallback tier — both at 16pt so native and JS rows are pixel-consistent.
 * hasMany text renders a chip editor under a stacked label.
 */
import React from 'react'
import { TextInput } from 'react-native'

import type {
  ClientEmailField,
  ClientTextField,
  FieldComponentProps,
} from '../../types'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { FieldShell } from '../shared'
import { useInputColors } from './colors'
import { useUncontrolledTextBridge } from './textBridge'
import { hasNativeSecureText, hasNativeSingleLineText, NativeTextRow } from './NativeTextRow'
import { HasManyChipsEditor } from './HasManyChips'
import { isPasswordLike, isSlugLike } from './utils'
import { styles } from './styles'

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const TextFieldNative: React.FC<FieldComponentProps<ClientTextField> & { secure: boolean }> = ({
  field, value, onChange, disabled, error, secure,
}) => {
  const isDisabled = disabled || field.admin?.readOnly
  const maxLength = field.maxLength
  const externalText = value != null ? String(value) : ''

  const bridge = useUncontrolledTextBridge(externalText, (raw) => {
    let next = raw
    if (maxLength != null && next.length > maxLength) {
      next = next.slice(0, maxLength)
      void bridge.ref.current?.setText(next)
    }
    onChange(next)
    return next
  })

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      <NativeTextRow
        bridge={bridge}
        secure={secure}
        placeholder={field.admin?.placeholder}
        keyboardType="default"
        autocorrection={!isSlugLike(field)}
        disabled={isDisabled}
      />
    </FieldShell>
  )
}

const TextFieldFallback: React.FC<FieldComponentProps<ClientTextField> & { secure: boolean }> = ({
  field, value, onChange, disabled, error, secure,
}) => {
  const c = useInputColors()
  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      <TextInput
        style={[styles.stackedInput, { color: c.text }, disabled && styles.disabled]}
        value={value != null ? String(value) : ''}
        onChangeText={(v) => onChange(v)}
        placeholder={field.admin?.placeholder}
        placeholderTextColor={c.textPlaceholder}
        editable={!disabled && !field.admin?.readOnly}
        maxLength={field.maxLength}
        autoCapitalize="none"
        autoCorrect={isSlugLike(field) ? false : undefined}
        secureTextEntry={secure}
        textContentType={secure ? 'password' : undefined}
      />
    </FieldShell>
  )
}

const HasManyTextField: React.FC<FieldComponentProps<ClientTextField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const values = Array.isArray(value) ? (value as Array<string | number>).map(String) : []
  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      <HasManyChipsEditor
        kind="text"
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

export const TextField: React.FC<FieldComponentProps<ClientTextField>> = (props) => {
  if (props.field.hasMany) return <HasManyTextField {...props} />
  const secure = isPasswordLike(props.field)
  const canNative = secure ? hasNativeSecureText : hasNativeSingleLineText
  return canNative
    ? <TextFieldNative {...props} secure={secure} />
    : <TextFieldFallback {...props} secure={secure} />
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

const EmailFieldNative: React.FC<FieldComponentProps<ClientEmailField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const externalText = value != null ? String(value) : ''
  const bridge = useUncontrolledTextBridge(externalText, (raw) => {
    onChange(raw)
    return raw
  })

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      <NativeTextRow
        bridge={bridge}
        placeholder={field.admin?.placeholder || 'email@example.com'}
        keyboardType="email-address"
        autocorrection={false}
        disabled={disabled || field.admin?.readOnly}
      />
    </FieldShell>
  )
}

const EmailFieldFallback: React.FC<FieldComponentProps<ClientEmailField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const c = useInputColors()
  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      <TextInput
        style={[styles.stackedInput, { color: c.text }, disabled && styles.disabled]}
        value={value != null ? String(value) : ''}
        onChangeText={(v) => onChange(v)}
        placeholder={field.admin?.placeholder || 'email@example.com'}
        placeholderTextColor={c.textPlaceholder}
        editable={!disabled && !field.admin?.readOnly}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
    </FieldShell>
  )
}

export const EmailField: React.FC<FieldComponentProps<ClientEmailField>> = (props) =>
  hasNativeSingleLineText
    ? <EmailFieldNative {...props} />
    : <EmailFieldFallback {...props} />
