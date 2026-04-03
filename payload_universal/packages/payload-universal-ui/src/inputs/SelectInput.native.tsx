/**
 * SelectInput — Native implementation.
 * Uses a simple list-based picker for native feel.
 */
import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View, FlatList, Modal } from 'react-native'
import { FieldShell } from '@payload-universal/admin-native/fields'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Option = { label: string; value: string }

type Props = {
  value?: string | string[]
  onChange?: (value: string | string[]) => void
  options?: Array<Option | string>
  label?: string
  required?: boolean
  disabled?: boolean
  error?: string
  description?: string
  hasMany?: boolean
  isClearable?: boolean
  placeholder?: string
  className?: string
  style?: any
}

function normalizeOption(opt: Option | string): Option {
  return typeof opt === 'string' ? { label: opt, value: opt } : opt
}

export const SelectInput: React.FC<Props> = ({
  value,
  onChange,
  options = [],
  label,
  required,
  disabled,
  error,
  description,
  hasMany,
  placeholder = 'Select...',
}) => {
  const [open, setOpen] = useState(false)
  const normalized = options.map(normalizeOption)

  const selectedLabels = (() => {
    if (!value) return placeholder
    if (Array.isArray(value)) {
      return value
        .map((v) => normalized.find((o) => o.value === v)?.label ?? v)
        .join(', ') || placeholder
    }
    return normalized.find((o) => o.value === value)?.label ?? String(value)
  })()

  const handleSelect = (optValue: string) => {
    if (hasMany) {
      const current = Array.isArray(value) ? value : value ? [value] : []
      const next = current.includes(optValue)
        ? current.filter((v) => v !== optValue)
        : [...current, optValue]
      onChange?.(next)
    } else {
      onChange?.(optValue)
      setOpen(false)
    }
  }

  const content = (
    <>
      <Pressable onPress={() => !disabled && setOpen(true)} style={styles.trigger}>
        <Text style={[styles.triggerText, !value && styles.placeholder]} numberOfLines={1}>
          {selectedLabels}
        </Text>
        <Text style={styles.chevron}>{'>'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide">
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{label ?? 'Select'}</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={normalized}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const isSelected = Array.isArray(value)
                ? value.includes(item.value)
                : value === item.value
              return (
                <Pressable onPress={() => handleSelect(item.value)} style={styles.option}>
                  <Text style={[styles.optionText, isSelected && styles.optionSelected]}>
                    {item.label}
                  </Text>
                  {isSelected && <Text style={styles.check}>{'check'}</Text>}
                </Pressable>
              )
            }}
          />
        </View>
      </Modal>
    </>
  )

  if (label) {
    return (
      <FieldShell label={label} required={required} error={error} description={description}>
        {content}
      </FieldShell>
    )
  }

  return content
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', flex: 1, minHeight: 36 },
  triggerText: { flex: 1, fontSize: t.fontSize.md, color: t.colors.text },
  placeholder: { color: t.colors.textPlaceholder },
  chevron: { fontSize: 14, color: t.colors.textMuted, marginLeft: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '50%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
  sheetTitle: { fontSize: t.fontSize.lg, fontWeight: '600' },
  done: { fontSize: t.fontSize.md, color: t.colors.primary, fontWeight: '600' },
  option: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
  optionText: { flex: 1, fontSize: t.fontSize.md },
  optionSelected: { fontWeight: '600' },
  check: { fontSize: 14, color: t.colors.primary },
})
