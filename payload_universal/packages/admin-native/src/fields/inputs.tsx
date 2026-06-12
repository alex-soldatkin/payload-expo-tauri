/**
 * TextInput-based field components: text, email, number, textarea, code,
 * json, point.
 *
 * CANONICAL ROW CONTRACT (see FieldShell/FormSection): every text-entry field
 * here is a STACKED row — uppercase 11pt label via FieldShell, input below at
 * the shared 16pt grid (the FormSection row owns the inset; components add
 * ZERO horizontal inset, borders or separators of their own). Single-line
 * fields render native SwiftUI TextField/SecureField (iOS) or JC TextInput
 * (Android) through the registry when available, with the pure-JS RN
 * TextInput as the final fallback tier — both tiers at 16pt text so native
 * and JS rows are pixel-consistent. Multiline fields (textarea, code, json)
 * keep a subtle filled rounded-8 background WITHOUT borders. The bounded
 * stepper number is the one INLINE row (label left, control right). hasMany
 * text/number render a chip editor under a stacked label.
 *
 * Native text inputs are UNCONTROLLED (defaultValue + onChangeText) and are
 * bridged to react-hook-form via useUncontrolledTextBridge — external resets
 * are pushed in with ref.setText, keystrokes are never echoed back.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'

import type {
  ClientCodeField,
  ClientEmailField,
  ClientJSONField,
  ClientNumberField,
  ClientPointField,
  ClientTextField,
  ClientTextareaField,
  FieldComponentProps,
} from '../types'
import { defaultTheme as t } from '../theme'
import { getFieldDescription, getFieldLabel } from '../utils/schemaHelpers'
import { FieldShell, fieldShellStyles, nativeComponents } from './shared'
import { NativeHost } from './NativeHost'
import { useInputColors } from './inputs/colors'
import { useUncontrolledTextBridge } from './inputs/textBridge'
import { hasNativeSecureText, hasNativeSingleLineText, NativeTextRow } from './inputs/NativeTextRow'
import { HasManyChipsEditor } from './inputs/HasManyChips'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Password-ish text fields render as SecureField on iOS / secureTextEntry in JS. */
const isPasswordLike = (field: ClientTextField): boolean =>
  (field.admin as { autoComplete?: string } | undefined)?.autoComplete === 'password' ||
  field.name === 'password'

/** Slug/identifier-ish fields get autocorrection turned off. */
const isSlugLike = (field: { name?: string; unique?: boolean }): boolean =>
  Boolean(field.unique) || /(slug|url|uri|key|token|handle|username)/i.test(field.name ?? '')

const clampNumber = (n: number, min?: number, max?: number): number => {
  let v = n
  if (min != null && v < min) v = min
  if (max != null && v > max) v = max
  return v
}

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

// ---------------------------------------------------------------------------
// Number
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Textarea (stacked — multiline, auto-grows up to ~40% of the screen)
// ---------------------------------------------------------------------------

/** Stacked-row contract: input text is 16pt (matches the single-line tiers). */
const TEXTAREA_FONT_SIZE = 16
const TEXTAREA_LINE_HEIGHT = Math.round(TEXTAREA_FONT_SIZE * 1.4)
/**
 * Vertical padding lives on a WRAPPER View, never on the TextInput itself.
 * RN maps a multiline TextInput's padding to UITextView.textContainerInset on
 * iOS (and compound padding on Android EditText), so onContentSizeChange would
 * report a content size that already includes the padding. Adding the padding
 * again when applying the height makes the box taller than the content; a
 * non-scrollable UITextView's contentSize then tracks the new bounds, so the
 * next event reports the inflated size and the field grows by 2×pad per cycle
 * — an unbounded auto-grow loop. Zero padding on the input keeps the measured
 * size and the applied height in the same coordinate space.
 */
const TEXTAREA_V_PAD = t.spacing.sm

export const TextareaField: React.FC<FieldComponentProps<ClientTextareaField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const c = useInputColors()
  const { height: screenHeight } = useWindowDimensions()

  const adminRows = (field.admin as { rows?: number } | undefined)?.rows
  // Bounds in TEXT-CONTENT space (padding excluded) — the same space the
  // (zero-padding) input's onContentSizeChange reports in.
  const minContentHeight = adminRows != null
    ? Math.max(44 - TEXTAREA_V_PAD * 2, adminRows * TEXTAREA_LINE_HEIGHT)
    : 100 - TEXTAREA_V_PAD * 2
  const maxContentHeight = Math.max(
    minContentHeight,
    Math.round(screenHeight * 0.4) - TEXTAREA_V_PAD * 2,
  )

  const [contentHeight, setContentHeight] = useState(minContentHeight)
  // Re-clamp at render time too — rotation can shrink maxContentHeight after
  // a larger value was stored.
  const height = Math.min(Math.max(contentHeight, minContentHeight), maxContentHeight)
  const atMax = height >= maxContentHeight

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      <View style={[styles.multilineWrapper, { backgroundColor: c.fill }]}>
        <TextInput
          style={[styles.multilineInput, { color: c.text, height }, disabled && styles.disabled]}
          value={value != null ? String(value) : ''}
          onChangeText={(v) => onChange(v)}
          onContentSizeChange={(e) => {
            // Clamp BEFORE storing (the stored value can never exceed the
            // cap), and ignore ≤2px deltas: iOS echoes bounds-derived
            // contentSize after we apply a height, Android rounds through
            // density/font padding — neither may re-trigger a set.
            const next = Math.min(
              Math.max(e.nativeEvent.contentSize.height, minContentHeight),
              maxContentHeight,
            )
            setContentHeight((prev) => (Math.abs(next - prev) > 2 ? next : prev))
          }}
          placeholder={field.admin?.placeholder}
          placeholderTextColor={c.textPlaceholder}
          editable={!disabled && !field.admin?.readOnly}
          maxLength={field.maxLength}
          multiline
          scrollEnabled={atMax}
          textAlignVertical="top"
        />
      </View>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Code (stacked — monospaced with a line-number gutter and horizontal scroll)
// ---------------------------------------------------------------------------

const CODE_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' })
const CODE_LINE_HEIGHT = 18
/** Rough monospace advance width at fontSize.sm — used to size the no-wrap canvas. */
const CODE_CHAR_WIDTH = t.fontSize.sm * 0.62

export const CodeField: React.FC<FieldComponentProps<ClientCodeField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const c = useInputColors()
  const [availableWidth, setAvailableWidth] = useState(0)
  const text = value != null ? String(value) : ''

  const lineCount = useMemo(() => Math.max(text.split('\n').length, 1), [text])
  const longestLine = useMemo(
    () => text.split('\n').reduce((m, line) => Math.max(m, line.length), 0),
    [text],
  )
  const gutterNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1).join('\n'),
    [lineCount],
  )
  // Wide enough that lines never wrap → gutter rows stay aligned and long
  // lines scroll horizontally.
  const contentWidth = Math.max(availableWidth, longestLine * CODE_CHAR_WIDTH + t.spacing.xl)

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      {/* Filled rounded-8 box, NO border (row contract); the gutter's extra
          fill stacks on the box fill for a subtly darker line-number strip. */}
      <View style={[styles.codeContainer, { backgroundColor: c.fill }]}>
        <Text style={[styles.codeGutter, { color: c.textPlaceholder, backgroundColor: c.fill }]}>
          {gutterNumbers}
        </Text>
        <ScrollView
          horizontal
          bounces={false}
          keyboardShouldPersistTaps="handled"
          style={styles.codeScroll}
          onLayout={(e) => {
            // Guard against fractional re-layout jitter feeding a render loop
            // (measured width → contentWidth → layout → measured width).
            const w = e.nativeEvent.layout.width
            setAvailableWidth((prev) => (Math.abs(w - prev) > 1 ? w : prev))
          }}
        >
          <TextInput
            style={[styles.codeInput, { color: c.text, width: contentWidth }, disabled && styles.disabled]}
            value={text}
            onChangeText={(v) => onChange(v)}
            placeholder={field.admin?.placeholder}
            placeholderTextColor={c.textPlaceholder}
            editable={!disabled && !field.admin?.readOnly}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </ScrollView>
      </View>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// JSON (stacked — monospaced with live validity indicator + pretty-print)
// ---------------------------------------------------------------------------

const deriveJsonText = (value: unknown): string =>
  typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2) ?? ''

type JsonValidity = { valid: boolean; message?: string } | null

const checkJson = (text: string): JsonValidity => {
  if (!text.trim()) return null
  try {
    JSON.parse(text)
    return { valid: true }
  } catch (e) {
    return { valid: false, message: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

export const JSONField: React.FC<FieldComponentProps<ClientJSONField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const c = useInputColors()
  const [text, setText] = useState(() => deriveJsonText(value))
  const [validity, setValidity] = useState<JsonValidity>(() => checkJson(deriveJsonText(value)))
  const lastEmittedRef = useRef<unknown>(value)

  // External value change (reset / load) — re-derive the editor text.
  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value
      setText(deriveJsonText(value))
    }
  }, [value])

  // Debounced validity check.
  useEffect(() => {
    const handle = setTimeout(() => setValidity(checkJson(text)), 350)
    return () => clearTimeout(handle)
  }, [text])

  // Store the parsed object when valid; keep the raw string (and surface the
  // error via the indicator) while invalid.
  const handleChange = (raw: string) => {
    setText(raw)
    try {
      const parsed = JSON.parse(raw)
      lastEmittedRef.current = parsed
      onChange(parsed)
    } catch {
      lastEmittedRef.current = raw
      onChange(raw)
    }
  }

  const isEditable = !disabled && !field.admin?.readOnly
  const canPrettify = validity?.valid === true && isEditable

  const prettify = () => {
    try {
      const parsed = JSON.parse(text)
      const pretty = JSON.stringify(parsed, null, 2)
      setText(pretty)
      lastEmittedRef.current = parsed
      onChange(parsed)
    } catch {
      // indicator is already surfacing the parse error
    }
  }

  const dotColor = validity == null ? c.textPlaceholder : validity.valid ? c.success : c.error

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error} layout="stacked">
      <TextInput
        style={[styles.jsonInput, { color: c.text, backgroundColor: c.fill }, disabled && styles.disabled]}
        value={text}
        onChangeText={handleChange}
        placeholder="{}"
        placeholderTextColor={c.textPlaceholder}
        editable={isEditable}
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />
      <View style={styles.jsonToolbar}>
        <View style={[styles.jsonDot, { backgroundColor: dotColor }]} />
        <Text
          numberOfLines={1}
          style={[styles.jsonStatus, { color: validity?.valid === false ? c.error : c.textMuted }]}
        >
          {validity == null ? 'Empty' : validity.valid ? 'Valid JSON' : validity.message}
        </Text>
        {canPrettify && (
          <Pressable onPress={prettify} hitSlop={8}>
            <Text style={[styles.jsonFormatButton, { color: c.accent }]}>Format</Text>
          </Pressable>
        )}
      </View>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Point (lng/lat — labeled pair with range validation)
// ---------------------------------------------------------------------------

/** In-progress numeric input that shouldn't trigger a validation message yet. */
const isPartialNumber = (raw: string) => raw === '' || raw === '-' || raw === '.' || raw === '-.'

type AxisCheck = { ok: boolean; n?: number; message?: string }

const checkAxis = (raw: string, axis: 'lng' | 'lat'): AxisCheck => {
  const [lo, hi] = axis === 'lng' ? [-180, 180] : [-90, 90]
  const label = axis === 'lng' ? 'Longitude' : 'Latitude'
  if (isPartialNumber(raw)) return { ok: false }
  const n = Number(raw)
  if (Number.isNaN(n)) return { ok: false, message: `${label} must be a number` }
  if (n < lo || n > hi) return { ok: false, message: `${label} must be between ${lo} and ${hi}` }
  return { ok: true, n }
}

export const PointField: React.FC<FieldComponentProps<ClientPointField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const c = useInputColors()
  const initial = Array.isArray(value) ? value : [null, null]
  const [lngText, setLngText] = useState(initial[0] != null ? String(initial[0]) : '')
  const [latText, setLatText] = useState(initial[1] != null ? String(initial[1]) : '')
  const [localError, setLocalError] = useState<string | undefined>(undefined)
  const lastEmittedRef = useRef<unknown>(value)

  // External value change (reset / load) — re-derive the input texts.
  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value
      const coords = Array.isArray(value) ? value : [null, null]
      setLngText(coords[0] != null ? String(coords[0]) : '')
      setLatText(coords[1] != null ? String(coords[1]) : '')
      setLocalError(undefined)
    }
  }, [value])

  const handleAxis = (axis: 'lng' | 'lat', raw: string) => {
    const nextLng = axis === 'lng' ? raw : lngText
    const nextLat = axis === 'lat' ? raw : latText
    if (axis === 'lng') setLngText(raw)
    else setLatText(raw)

    if (nextLng.trim() === '' && nextLat.trim() === '') {
      setLocalError(undefined)
      lastEmittedRef.current = null
      onChange(null)
      return
    }

    const lng = checkAxis(nextLng, 'lng')
    const lat = checkAxis(nextLat, 'lat')
    if (lng.ok && lat.ok) {
      setLocalError(undefined)
      const next: [number, number] = [lng.n!, lat.n!]
      lastEmittedRef.current = next
      onChange(next)
    } else {
      // Do NOT coerce invalid input to 0 — keep the last valid form value
      // and surface the problem instead.
      setLocalError(lng.message ?? lat.message)
    }
  }

  const editable = !disabled && !field.admin?.readOnly
  const keyboardType = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error ?? localError}
      layout="stacked"
    >
      <View style={styles.pointRow}>
        <View style={styles.pointCol}>
          <Text style={[styles.pointAxisLabel, { color: c.textPlaceholder }]}>LNG</Text>
          <TextInput
            style={[styles.stackedInput, { color: c.text }, disabled && styles.disabled]}
            value={lngText}
            onChangeText={(v) => handleAxis('lng', v)}
            placeholder="-180 to 180"
            placeholderTextColor={c.textPlaceholder}
            keyboardType={keyboardType}
            editable={editable}
          />
        </View>
        <View style={styles.pointCol}>
          <Text style={[styles.pointAxisLabel, { color: c.textPlaceholder }]}>LAT</Text>
          <TextInput
            style={[styles.stackedInput, { color: c.text }, disabled && styles.disabled]}
            value={latText}
            onChangeText={(v) => handleAxis('lat', v)}
            placeholder="-90 to 90"
            placeholderTextColor={c.textPlaceholder}
            keyboardType={keyboardType}
            editable={editable}
          />
        </View>
      </View>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Stacked single-line input — borderless, zero horizontal inset (the
  // FormSection row owns the 16pt grid), 16pt text per the row contract.
  // Matches the native NativeTextRow tier (font({ size: 16 })) pixel-for-pixel.
  stackedInput: {
    fontSize: 16,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    textAlign: 'left',
  },
  // Multiline textarea — subtle filled rounded-8 box, NO border (row
  // contract); fill color injected at render (useInputColors). Padding sits
  // on the wrapper so the input's measured content size never includes it
  // (see TEXTAREA_V_PAD).
  multilineWrapper: {
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: TEXTAREA_V_PAD,
  },
  multilineInput: {
    fontSize: TEXTAREA_FONT_SIZE,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
  },
  disabled: { opacity: 0.5 },

  // Code — filled rounded-8 box, NO border (fill injected at render).
  codeContainer: {
    flexDirection: 'row',
    borderRadius: t.borderRadius.sm,
    overflow: 'hidden',
    minHeight: 140,
  },
  codeGutter: {
    fontFamily: CODE_FONT,
    fontSize: t.fontSize.sm,
    lineHeight: CODE_LINE_HEIGHT,
    paddingVertical: t.spacing.sm,
    paddingLeft: t.spacing.sm,
    paddingRight: t.spacing.xs + 2,
    textAlign: 'right',
    minWidth: 32,
    includeFontPadding: false,
  },
  codeScroll: { flex: 1 },
  codeInput: {
    fontFamily: CODE_FONT,
    fontSize: t.fontSize.sm,
    lineHeight: CODE_LINE_HEIGHT,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.sm,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
    includeFontPadding: false,
  },

  // JSON — filled rounded-8 box, NO border (fill injected at render).
  jsonInput: {
    fontFamily: CODE_FONT,
    fontSize: t.fontSize.sm,
    lineHeight: CODE_LINE_HEIGHT,
    minHeight: 140,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.sm,
    textAlignVertical: 'top',
  },
  // Toolbar aligns to the box edge (= the 16pt grid; no extra inset).
  jsonToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs + 2,
    marginTop: t.spacing.xs,
  },
  jsonDot: { width: 8, height: 8, borderRadius: 4 },
  jsonStatus: { flex: 1, fontSize: t.fontSize.xs },
  jsonFormatButton: { fontSize: t.fontSize.sm, fontWeight: '600' },

  // Point — two borderless axis columns under the stacked label.
  pointRow: { flexDirection: 'row', gap: t.spacing.md },
  pointCol: { flex: 1 },
  pointAxisLabel: { fontSize: t.fontSize.xs, letterSpacing: 0.5, marginBottom: 2 },
})
