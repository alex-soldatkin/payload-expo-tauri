/**
 * Checkbox (Switch) and Date fields.
 * Date uses a native-feeling inline picker built with ScrollView wheels.
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
import { defaultTheme as t } from '../theme'
import { getFieldDescription, getFieldLabel } from '../schemaHelpers'

// ---------------------------------------------------------------------------
// Checkbox → Switch
// ---------------------------------------------------------------------------

export const CheckboxField: React.FC<FieldComponentProps<ClientCheckboxField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => (
  <View style={styles.checkboxRow}>
    <Switch
      value={Boolean(value)}
      onValueChange={(v) => onChange(v)}
      disabled={disabled || field.admin?.readOnly}
      trackColor={{ true: t.colors.primary, false: '#ccc' }}
      thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
    />
    <View style={styles.checkboxLabel}>
      <Text style={styles.label}>{getFieldLabel(field)}</Text>
      {getFieldDescription(field) && (
        <Text style={styles.description}>{getFieldDescription(field)}</Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  </View>
)

// ---------------------------------------------------------------------------
// Date → Modal picker with scrollable columns
// ---------------------------------------------------------------------------

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return String(iso)
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  } catch {
    return String(iso)
  }
}

const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return String(iso)
    const h = d.getHours()
    const m = d.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h12}:${m.toString().padStart(2, '0')} ${ampm}`
  } catch {
    return String(iso)
  }
}

const range = (start: number, end: number) => {
  const arr: number[] = []
  for (let i = start; i <= end; i++) arr.push(i)
  return arr
}

const YEARS = range(1970, 2050)
const DAYS = range(1, 31)
const HOURS = range(0, 23)
const MINUTES = range(0, 59)

const WheelColumn: React.FC<{
  data: Array<{ label: string; value: number }>
  selected: number
  onSelect: (v: number) => void
}> = ({ data, selected, onSelect }) => (
  <FlatList
    data={data}
    keyExtractor={(item) => String(item.value)}
    style={styles.wheelColumn}
    showsVerticalScrollIndicator={false}
    initialScrollIndex={Math.max(0, data.findIndex((d) => d.value === selected))}
    getItemLayout={(_, index) => ({ length: 40, offset: 40 * index, index })}
    renderItem={({ item }) => (
      <Pressable
        style={[styles.wheelItem, item.value === selected && styles.wheelItemSelected]}
        onPress={() => onSelect(item.value)}
      >
        <Text style={[styles.wheelText, item.value === selected && styles.wheelTextSelected]}>
          {item.label}
        </Text>
      </Pressable>
    )}
  />
)

export const DateField: React.FC<FieldComponentProps<ClientDateField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
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
    const d = new Date(year, month, day, hour, minute)
    onChange(d.toISOString())
    setOpen(false)
  }

  const displayValue = value
    ? (showTime && showDate ? formatDateTime(value as string) : formatDate(value as string))
    : null

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {getFieldLabel(field)}
        {field.required && <Text style={styles.required}> *</Text>}
      </Text>

      <Pressable
        style={[styles.dateButton, error && styles.dateButtonError]}
        onPress={() => !disabled && handleOpen()}
        disabled={disabled || field.admin?.readOnly}
      >
        <Text style={[styles.dateText, !displayValue && styles.datePlaceholder]}>
          {displayValue ?? 'Select date...'}
        </Text>
      </Pressable>

      {getFieldDescription(field) && (
        <Text style={styles.description}>{getFieldDescription(field)}</Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={{ flex: 1 }} />
        </Pressable>
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.pickerCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>
              {showDate && `${MONTHS_SHORT[month]} ${day}, ${year}`}
              {showTime && showDate && ' '}
              {showTime && `${(hour % 12 || 12)}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`}
            </Text>
            <Pressable onPress={handleConfirm}>
              <Text style={styles.pickerDone}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.wheelRow}>
            {showDate && (
              <>
                <WheelColumn
                  data={MONTHS.map((m, i) => ({ label: m.slice(0, 3), value: i }))}
                  selected={month}
                  onSelect={setMonth}
                />
                <WheelColumn
                  data={DAYS.map((d) => ({ label: String(d), value: d }))}
                  selected={day}
                  onSelect={setDay}
                />
                <WheelColumn
                  data={YEARS.map((y) => ({ label: String(y), value: y }))}
                  selected={year}
                  onSelect={setYear}
                />
              </>
            )}
            {showTime && (
              <>
                <WheelColumn
                  data={HOURS.map((h) => ({ label: `${(h % 12 || 12)}${h >= 12 ? ' PM' : ' AM'}`, value: h }))}
                  selected={hour}
                  onSelect={setHour}
                />
                <WheelColumn
                  data={MINUTES.map((m) => ({ label: m.toString().padStart(2, '0'), value: m }))}
                  selected={minute}
                  onSelect={setMinute}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { marginBottom: t.spacing.lg },
  label: { fontSize: t.fontSize.sm, fontWeight: '600', color: t.colors.text, marginBottom: t.spacing.xs },
  required: { color: t.colors.error },
  description: { fontSize: t.fontSize.xs, color: t.colors.textMuted, marginTop: t.spacing.xs },
  error: { fontSize: t.fontSize.xs, color: t.colors.error, marginTop: t.spacing.xs },

  // Checkbox
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: t.spacing.lg, gap: t.spacing.md },
  checkboxLabel: { flex: 1 },

  // Date button
  dateButton: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    backgroundColor: t.colors.surface,
  },
  dateButtonError: { borderColor: t.colors.error },
  dateText: { fontSize: t.fontSize.md, color: t.colors.text },
  datePlaceholder: { color: t.colors.textPlaceholder },

  // Modal picker
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34, // safe area
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
  },
  pickerCancel: { fontSize: t.fontSize.md, color: t.colors.textMuted },
  pickerTitle: { fontSize: t.fontSize.sm, fontWeight: '600', color: t.colors.text },
  pickerDone: { fontSize: t.fontSize.md, fontWeight: '700', color: t.colors.primary },

  // Wheel columns
  wheelRow: { flexDirection: 'row', height: 200, paddingHorizontal: t.spacing.sm },
  wheelColumn: { flex: 1 },
  wheelItem: { height: 40, justifyContent: 'center', alignItems: 'center' },
  wheelItemSelected: { backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 8 },
  wheelText: { fontSize: t.fontSize.md, color: t.colors.textMuted },
  wheelTextSelected: { fontWeight: '700', color: t.colors.text },
})
