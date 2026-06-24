// ---------------------------------------------------------------------------
// Value input — adapts to field type
// ---------------------------------------------------------------------------
import React from 'react'
import { FlatList, Pressable, Switch, Text, TextInput, View } from 'react-native'

import { normalizeOption } from '../../utils/schemaHelpers'
import { isMultiValueOperator } from '../../utils/filterOperators'
import type { ValueInputProps } from '../types'
import { DateValueInput } from './DateValueInput'
import { RelationValuePicker } from './RelationValuePicker'

export const ValueInput: React.FC<ValueInputProps> = ({ field, operator, value, onChange, colors, styles }) => {
  // 'exists' → boolean toggle
  if (operator === 'exists') {
    return (
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Field exists</Text>
        <Switch value={Boolean(value)} onValueChange={(v) => onChange(v)} />
      </View>
    )
  }

  // Checkbox → boolean toggle
  if (field.type === 'checkbox') {
    return (
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Value</Text>
        <Switch value={Boolean(value)} onValueChange={(v) => onChange(v)} />
      </View>
    )
  }

  // Select / radio → pick from options (multi-select for in/not_in)
  if ((field.type === 'select' || field.type === 'radio') && 'options' in field && field.options) {
    const options = (field.options as Array<string | { label: string | Record<string, string>; value: string }>).map(normalizeOption)
    const multi = operator === 'in' || operator === 'not_in'
    const selectedValues = Array.isArray(value)
      ? value.map(String)
      : value !== '' && value != null
        ? [String(value)]
        : []

    const handlePick = (optValue: string, optLabel: string) => {
      if (!multi) {
        onChange(optValue, optLabel)
        return
      }
      const next = selectedValues.includes(optValue)
        ? selectedValues.filter((v) => v !== optValue)
        : [...selectedValues, optValue]
      const labels = options.filter((o) => next.includes(o.value)).map((o) => o.label)
      onChange(next, labels.join(', ') || undefined)
    }

    return (
      <FlatList
        data={options}
        keyExtractor={(item) => item.value}
        style={styles.optionList}
        renderItem={({ item }) => {
          const selected = selectedValues.includes(item.value)
          return (
            <Pressable
              style={[styles.row, selected && styles.rowSelected]}
              onPress={() => handlePick(item.value, item.label)}
            >
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
                {item.label}
              </Text>
              {selected && <Text style={styles.checkMark}>✓</Text>}
            </Pressable>
          )
        }}
      />
    )
  }

  // Relationship / upload → minimal doc picker (multi for in/not_in)
  if (field.type === 'relationship' || field.type === 'upload') {
    const relationToRaw = (field as { relationTo?: string | string[] }).relationTo
    const relationTo = Array.isArray(relationToRaw) ? relationToRaw[0] : relationToRaw
    if (relationTo) {
      return (
        <RelationValuePicker
          relationTo={relationTo}
          multi={operator === 'in' || operator === 'not_in'}
          value={value}
          onChange={onChange}
          colors={colors}
          styles={styles}
        />
      )
    }
  }

  // in / not_in on remaining field types (text/number/date/…) →
  // comma-separated values (Payload accepts a comma-delimited string; the
  // local evaluator splits it the same way)
  if (isMultiValueOperator(operator)) {
    return (
      <TextInput
        style={styles.textInput}
        value={Array.isArray(value) ? value.map(String).join(', ') : value != null ? String(value) : ''}
        onChangeText={(v) => onChange(v)}
        placeholder={field.type === 'date' ? 'Dates, comma-separated (YYYY-MM-DD)' : 'Values, comma-separated'}
        placeholderTextColor={colors.textPlaceholder}
        keyboardType={field.type === 'number' || field.type === 'point' ? 'numbers-and-punctuation' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
    )
  }

  // Date → native date picker via the registry, text input fallback
  if (field.type === 'date') {
    return <DateValueInput value={value} onChange={onChange} colors={colors} styles={styles} />
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
        placeholderTextColor={colors.textPlaceholder}
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
      onChangeText={(v) => onChange(v)}
      placeholder="Enter a value"
      placeholderTextColor={colors.textPlaceholder}
      autoCapitalize="none"
      autoCorrect={false}
      autoFocus
    />
  )
}
