/**
 * Multi-step bottom sheet for building a filter:
 *   Step 1 → Pick a field
 *   Step 2 → Pick an operator
 *   Step 3 → Enter a value
 */
import React, { useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'

import type { ClientField } from './types'
import { defaultTheme as t } from './theme'
import { getFieldLabel, normalizeOption } from './schemaHelpers'
import { getOperatorsForFieldType, isFieldFilterable } from './filterOperators'
import type { FilterOperator } from './filterOperators'
import { BottomSheet } from './BottomSheet'

type ApplyPayload = {
  field: string
  fieldLabel: string
  operator: string
  operatorLabel: string
  value: unknown
}

type Props = {
  visible: boolean
  onClose: () => void
  fields: ClientField[]
  onApply: (filter: ApplyPayload) => void
}

export const FilterBottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  fields,
  onApply,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedField, setSelectedField] = useState<ClientField | null>(null)
  const [selectedOp, setSelectedOp] = useState<FilterOperator | null>(null)
  const [value, setValue] = useState<unknown>('')

  const filterableFields = fields.filter(isFieldFilterable)
  const operators = selectedField ? getOperatorsForFieldType(selectedField.type) : []

  const reset = () => {
    setStep(1)
    setSelectedField(null)
    setSelectedOp(null)
    setValue('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFieldSelect = (field: ClientField) => {
    setSelectedField(field)
    setSelectedOp(null)
    setValue('')
    setStep(2)
  }

  const handleOpSelect = (op: FilterOperator) => {
    setSelectedOp(op)
    // 'exists' needs a boolean value — skip to apply
    if (op.value === 'exists') {
      setValue(true)
      setStep(3)
    } else {
      setValue('')
      setStep(3)
    }
  }

  const handleApply = () => {
    if (!selectedField?.name || !selectedOp) return
    onApply({
      field: selectedField.name,
      fieldLabel: getFieldLabel(selectedField),
      operator: selectedOp.value,
      operatorLabel: selectedOp.label,
      value,
    })
    reset()
  }

  const handleBack = () => {
    if (step === 3) setStep(2)
    else if (step === 2) setStep(1)
  }

  const title =
    step === 1 ? 'Filter by field' :
    step === 2 ? `${getFieldLabel(selectedField!)} — operator` :
    `${getFieldLabel(selectedField!)} ${selectedOp!.label}`

  return (
    <BottomSheet visible={visible} onClose={handleClose} height={0.55}>
      {/* Header */}
      <View style={styles.header}>
        {step > 1 && (
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        )}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>

      {/* Step 1: Field list */}
      {step === 1 && (
        <FlatList
          data={filterableFields}
          keyExtractor={(item) => item.name || item.type}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => handleFieldSelect(item)}>
              <Text style={styles.rowLabel}>{getFieldLabel(item)}</Text>
              <Text style={styles.rowType}>{item.type}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No filterable fields</Text>
          }
        />
      )}

      {/* Step 2: Operator list */}
      {step === 2 && (
        <FlatList
          data={operators}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => handleOpSelect(item)}>
              <Text style={styles.rowLabel}>{item.label}</Text>
            </Pressable>
          )}
        />
      )}

      {/* Step 3: Value input */}
      {step === 3 && selectedField && selectedOp && (
        <View style={styles.valueContainer}>
          <ValueInput
            field={selectedField}
            operator={selectedOp.value}
            value={value}
            onChange={setValue}
          />
          <Pressable
            style={[styles.applyBtn, (value === '' || value == null) && styles.applyDisabled]}
            onPress={handleApply}
            disabled={value === '' || value == null}
          >
            <Text style={styles.applyText}>Apply Filter</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  )
}

// ---------------------------------------------------------------------------
// Value input — adapts to field type
// ---------------------------------------------------------------------------

const ValueInput: React.FC<{
  field: ClientField
  operator: string
  value: unknown
  onChange: (v: unknown) => void
}> = ({ field, operator, value, onChange }) => {
  // 'exists' → boolean toggle
  if (operator === 'exists') {
    return (
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Field exists</Text>
        <Switch value={Boolean(value)} onValueChange={onChange} />
      </View>
    )
  }

  // Checkbox → boolean toggle
  if (field.type === 'checkbox') {
    return (
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Value</Text>
        <Switch value={Boolean(value)} onValueChange={onChange} />
      </View>
    )
  }

  // Select / radio → pick from options
  if ((field.type === 'select' || field.type === 'radio') && 'options' in field && field.options) {
    const options = (field.options as Array<string | { label: string | Record<string, string>; value: string }>).map(normalizeOption)
    return (
      <FlatList
        data={options}
        keyExtractor={(item) => item.value}
        style={styles.optionList}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, item.value === value && styles.rowSelected]}
            onPress={() => onChange(item.value)}
          >
            <Text style={[styles.rowLabel, item.value === value && styles.rowLabelSelected]}>
              {item.label}
            </Text>
            {item.value === value && <Text style={styles.checkMark}>✓</Text>}
          </Pressable>
        )}
      />
    )
  }

  // Date → text input for ISO date (YYYY-MM-DD)
  if (field.type === 'date') {
    return (
      <TextInput
        style={styles.textInput}
        value={value != null ? String(value) : ''}
        onChangeText={(v) => {
          // Accept ISO strings or try to parse common formats
          onChange(v)
        }}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={t.colors.textPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
    )
  }

  // Number → decimal keyboard
  if (field.type === 'number' || field.type === 'point') {
    return (
      <TextInput
        style={styles.textInput}
        value={value != null ? String(value) : ''}
        onChangeText={(v) => {
          if (v === '' || v === '-') { onChange(v); return }
          const n = Number(v)
          onChange(Number.isNaN(n) ? value : n)
        }}
        placeholder="Enter a number"
        placeholderTextColor={t.colors.textPlaceholder}
        keyboardType="decimal-pad"
        returnKeyType="done"
        autoFocus
      />
    )
  }

  // Default: text input
  return (
    <TextInput
      style={styles.textInput}
      value={value != null ? String(value) : ''}
      onChangeText={onChange}
      placeholder="Enter a value"
      placeholderTextColor={t.colors.textPlaceholder}
      autoCapitalize="none"
      autoCorrect={false}
      autoFocus
    />
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: t.spacing.md, gap: t.spacing.sm },
  backBtn: { paddingRight: t.spacing.sm },
  backText: { fontSize: t.fontSize.md, color: t.colors.primary, fontWeight: '600' },
  title: { fontSize: t.fontSize.lg, fontWeight: '700', color: t.colors.text, flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
  },
  rowSelected: { backgroundColor: '#f5f5f5' },
  rowLabel: { fontSize: t.fontSize.md, color: t.colors.text },
  rowLabelSelected: { fontWeight: '600' },
  rowType: { fontSize: t.fontSize.xs, color: t.colors.textMuted, textTransform: 'uppercase' },
  checkMark: { fontSize: 16, color: t.colors.primary },

  emptyText: { textAlign: 'center', padding: t.spacing.xl, color: t.colors.textMuted },

  valueContainer: { flex: 1 },
  textInput: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    fontSize: t.fontSize.md,
    color: t.colors.text,
    backgroundColor: t.colors.surface,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: t.spacing.md,
  },
  switchLabel: { fontSize: t.fontSize.md, color: t.colors.text },
  optionList: { maxHeight: 220 },

  applyBtn: {
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.sm,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
    marginTop: t.spacing.lg,
  },
  applyDisabled: { opacity: 0.4 },
  applyText: { color: t.colors.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },
})
