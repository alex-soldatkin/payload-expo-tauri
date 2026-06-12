/**
 * Checkbox (Toggle/Switch) and Date fields — canonical INLINE rows.
 *
 * Row contract (see shared/FieldShell.tsx): minHeight-44 row, label left
 * (15pt regular), control/value right; NO field-owned borders, boxes or
 * hairline separators (FormSection owns separators); errors/descriptions
 * render below the row in 12pt, space reserved only when present.
 *
 * Uses @expo/ui native components when available (resolved per-platform
 * via shared/native.ios.ts / native.android.ts). Falls back to React
 * Native built-ins otherwise.
 */
import React, { useCallback, useState } from 'react'
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'

import type { ClientCheckboxField, ClientDateField, FieldComponentProps } from '../types'
import { defaultTheme as t, ROW_MIN_HEIGHT } from '../theme'
import { getFieldDescription, getFieldLabel } from '../utils/schemaHelpers'
import { FieldShell, fieldShellStyles, nativeComponents } from './shared'
import { NativeHost } from './NativeHost'
import { useListColors } from '../hooks/useListColors'

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

/**
 * Native checkbox — intentionally BYPASSES FieldShell: the SwiftUI Toggle
 * renders its own label-left / switch-right row, which already matches the
 * canonical inline layout. The bypass still obeys the row contract: 44pt
 * minimum row height, no borders/separators, dark-mode-aware captions below
 * with space reserved only when present.
 */
const CheckboxFieldNative: React.FC<FieldComponentProps<ClientCheckboxField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const Toggle = nativeComponents.Toggle!
  const isDisabled = disabled || field.admin?.readOnly
  const { colors: c } = useListColors()
  const description = getFieldDescription(field)
  const hasCaption = Boolean(description) || Boolean(error)

  return (
    <View style={hasCaption ? styles.checkboxContainerWithCaption : null}>
      <View style={styles.checkboxRow}>
        <NativeHost style={isDisabled ? fieldShellStyles.disabledHost : undefined}>
          <Toggle
            isOn={Boolean(value)}
            label={`${getFieldLabel(field)}${field.required ? ' *' : ''}`}
            onIsOnChange={(isOn) => { if (!isDisabled) onChange(isOn) }}
          />
        </NativeHost>
      </View>
      {description ? (
        <Text style={[styles.caption, { color: c.textPlaceholder }]}>{description}</Text>
      ) : null}
      {error ? <Text style={[styles.captionError, { color: c.error }]}>{error}</Text> : null}
    </View>
  )
}

const CheckboxFieldFallback: React.FC<FieldComponentProps<ClientCheckboxField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const { colors: c } = useListColors()
  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} error={error}>
      <View style={styles.checkboxInline}>
        <Switch
          value={Boolean(value)}
          onValueChange={(v) => onChange(v)}
          disabled={disabled || field.admin?.readOnly}
          trackColor={{ true: c.primary, false: c.border }}
          thumbColor={Platform.OS === 'android' ? c.surface : undefined}
        />
      </View>
    </FieldShell>
  )
}

export const CheckboxField: React.FC<FieldComponentProps<ClientCheckboxField>> = (props) =>
  nativeComponents.Toggle
    ? <CheckboxFieldNative {...props} />
    : <CheckboxFieldFallback {...props} />

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

/** Map Payload's pickerAppearance to @expo/ui displayedComponents. */
const getDisplayedComponents = (
  appearance?: string,
): Array<'date' | 'hourAndMinute'> => {
  switch (appearance) {
    case 'dayOnly':
    case 'monthOnly':
      return ['date']
    case 'timeOnly':
      return ['hourAndMinute']
    case 'dayAndTime':
    default:
      return ['date', 'hourAndMinute']
  }
}

const DateFieldNative: React.FC<FieldComponentProps<ClientDateField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const DatePicker = nativeComponents.DatePicker!
  const isDisabled = disabled || field.admin?.readOnly
  const label = getFieldLabel(field)
  const description = getFieldDescription(field)

  const currentDate = value ? new Date(value as string) : new Date()
  const validDate = isNaN(currentDate.getTime()) ? new Date() : currentDate

  const handleDateChange = useCallback((date: Date) => {
    if (!isDisabled) onChange(date.toISOString())
  }, [isDisabled, onChange])

  // Compact style → the iOS Settings capsule pickers. Modifiers are FACTORY
  // CALLS from the registry, null-checked (never object literals).
  const pickerModifiers = nativeComponents.datePickerStyle
    ? [nativeComponents.datePickerStyle('compact')]
    : undefined

  return (
    <FieldShell label={label} description={description} required={field.required} error={error}>
      {/* Inline row: the content-sized native picker hugs the right edge. */}
      <View style={styles.dateControl}>
        <NativeHost style={isDisabled ? fieldShellStyles.disabledHost : undefined}>
          <DatePicker
            selection={validDate}
            displayedComponents={getDisplayedComponents(field.admin?.date?.pickerAppearance)}
            onDateChange={handleDateChange}
            modifiers={pickerModifiers}
          />
        </NativeHost>
      </View>
    </FieldShell>
  )
}

export const DateField: React.FC<FieldComponentProps<ClientDateField>> = (props) =>
  nativeComponents.DatePicker
    ? <DateFieldNative {...props} />
    : <DateFieldFallback {...props} />

// ---------------------------------------------------------------------------
// Date fallback — custom wheel picker modal
// ---------------------------------------------------------------------------

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const range = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i)
const YEARS = range(1970, 2050)
const DAYS = range(1, 31)
const HOURS = range(0, 23)
const MINUTES = range(0, 59)

const formatDate = (iso: string): string => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

const formatDateTime = (iso: string): string => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

const WheelColumn: React.FC<{
  data: Array<{ label: string; value: number }>
  selected: number
  onSelect: (v: number) => void
}> = ({ data, selected, onSelect }) => {
  const { colors: c } = useListColors()
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.value)}
      style={styles.wheelColumn}
      showsVerticalScrollIndicator={false}
      initialScrollIndex={Math.max(0, data.findIndex((d) => d.value === selected))}
      getItemLayout={(_, index) => ({ length: 40, offset: 40 * index, index })}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.wheelItem, item.value === selected && { backgroundColor: c.pressed, borderRadius: 8 }]}
          onPress={() => onSelect(item.value)}
        >
          <Text style={[styles.wheelText, { color: c.textMuted }, item.value === selected && { fontWeight: '700', color: c.text }]}>
            {item.label}
          </Text>
        </Pressable>
      )}
    />
  )
}

const DateFieldFallback: React.FC<FieldComponentProps<ClientDateField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const { colors: c } = useListColors()
  const [open, setOpen] = useState(false)
  const current = value ? new Date(value as string) : new Date()
  const validDate = isNaN(current.getTime()) ? new Date() : current

  const [year, setYear] = useState(validDate.getFullYear())
  const [month, setMonth] = useState(validDate.getMonth())
  const [day, setDay] = useState(validDate.getDate())
  const [hour, setHour] = useState(validDate.getHours())
  const [minute, setMinute] = useState(validDate.getMinutes())

  const appearance = field.admin?.date?.pickerAppearance
  const showTime = appearance === 'dayAndTime' || appearance === 'timeOnly' || !appearance
  const showDate = appearance !== 'timeOnly'

  const handleOpen = useCallback(() => {
    const d = value ? new Date(value as string) : new Date()
    const v = isNaN(d.getTime()) ? new Date() : d
    setYear(v.getFullYear())
    setMonth(v.getMonth())
    setDay(v.getDate())
    setHour(v.getHours())
    setMinute(v.getMinutes())
    setOpen(true)
  }, [value])

  const handleConfirm = () => {
    onChange(new Date(year, month, day, hour, minute).toISOString())
    setOpen(false)
  }

  const displayValue = value
    ? (showTime && showDate ? formatDateTime(value as string) : formatDate(value as string))
    : null

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
    >
      {/* Borderless inline value row — value text right-aligned; the error
          surfaces via FieldShell below the row (no border/box treatment). */}
      <Pressable
        style={styles.dateValueRow}
        onPress={() => !disabled && handleOpen()}
        disabled={disabled || field.admin?.readOnly}
      >
        <Text style={[styles.dateText, { color: displayValue ? c.text : c.textPlaceholder }]}>
          {displayValue ?? 'Select date...'}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={{ flex: 1 }} />
        </Pressable>
        <View style={[styles.pickerSheet, { backgroundColor: c.card }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: c.separator }]}>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={[styles.pickerCancel, { color: c.textMuted }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.pickerTitle, { color: c.text }]}>
              {showDate && `${MONTHS_SHORT[month]} ${day}, ${year}`}
              {showTime && showDate && ' '}
              {showTime && `${hour % 12 || 12}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`}
            </Text>
            <Pressable onPress={handleConfirm}>
              <Text style={[styles.pickerDone, { color: c.primary }]}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.wheelRow}>
            {showDate && (
              <>
                <WheelColumn data={MONTHS_FULL.map((m, i) => ({ label: m.slice(0, 3), value: i }))} selected={month} onSelect={setMonth} />
                <WheelColumn data={DAYS.map((d) => ({ label: String(d), value: d }))} selected={day} onSelect={setDay} />
                <WheelColumn data={YEARS.map((y) => ({ label: String(y), value: y }))} selected={year} onSelect={setYear} />
              </>
            )}
            {showTime && (
              <>
                <WheelColumn data={HOURS.map((h) => ({ label: `${h % 12 || 12}${h >= 12 ? ' PM' : ' AM'}`, value: h }))} selected={hour} onSelect={setHour} />
                <WheelColumn data={MINUTES.map((m) => ({ label: m.toString().padStart(2, '0'), value: m }))} selected={minute} onSelect={setMinute} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Native checkbox bypass — canonical inline row metrics; captions reserve
  // space below ONLY when present (no layout jump), mirroring FieldShell.
  checkboxRow: { minHeight: ROW_MIN_HEIGHT, justifyContent: 'center' },
  checkboxContainerWithCaption: { paddingBottom: 10 },
  caption: { fontSize: 12, marginTop: 2 },
  captionError: { fontSize: 12, marginTop: 4 },

  // Checkbox fallback — switch aligned right in the inline row
  checkboxInline: { alignItems: 'flex-end' },

  // Native date — content-sized picker hugging the row's right edge
  dateControl: { alignItems: 'flex-end' },

  // Date fallback — borderless inline value row, right-aligned (44pt tap
  // target; the FieldShell inline row supplies label/error chrome)
  dateValueRow: {
    minHeight: ROW_MIN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  dateText: { fontSize: t.fontSize.md, textAlign: 'right' },

  // Modal picker
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  pickerSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingBottom: 34, shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 20,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator,
  },
  pickerCancel: { fontSize: t.fontSize.md, color: t.colors.textMuted },
  pickerTitle: { fontSize: t.fontSize.sm, fontWeight: '600', color: t.colors.text },
  pickerDone: { fontSize: t.fontSize.md, fontWeight: '700', color: t.colors.primary },

  // Wheel columns (selected-state colours are injected inline via useListColors)
  wheelRow: { flexDirection: 'row', height: 200, paddingHorizontal: t.spacing.sm },
  wheelColumn: { flex: 1 },
  wheelItem: { height: 40, justifyContent: 'center', alignItems: 'center' },
  wheelText: { fontSize: t.fontSize.md, color: t.colors.textMuted },
})
