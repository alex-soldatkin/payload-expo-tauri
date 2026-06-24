/**
 * Multi-step bottom sheet for building (or editing) a structured filter:
 *   Step 0 → OR-group overview (web WhereBuilder parity; rendered when the
 *            `activeFilters` prop is provided and non-empty) — groups appear
 *            as glass inset sections separated by an 'OR' pill divider,
 *            conditions within a group carry a subtle 'and' label;
 *            '+ Add filter' ANDs into the current group, '+ Or' starts a
 *            new group
 *   Step 1 → Pick a field
 *   Step 2 → Pick an operator
 *   Step 3 → Enter a value (plus an AND/OR group choice when creating a
 *            new filter)
 *
 * Value inputs adapt to the field type:
 *  - date                 → native DatePicker via the registry (SwiftUI
 *                           graphical / Jetpack Compose), text input fallback
 *  - relationship/upload  → minimal searchable doc picker (local-first RxDB,
 *                           REST fallback); multi-select for in/not_in
 *  - select/radio         → option list (multi-select for in/not_in)
 *  - checkbox / exists    → switch
 *  - in / not_in (other)  → comma-separated text input
 *  - number / text        → keyboard input
 *
 * Pass `initialFilter` to re-open the editor pre-filled (chip tap). The
 * apply payload then carries the same `id` so the caller can update the
 * filter in place instead of adding a new one. A new filter applied with
 * the OR choice carries `newGroup: true` — `useDocumentListFilters` starts
 * a fresh OR-group for it.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native'

import type { ClientField } from '../types'
import { getFieldLabel } from '../utils/schemaHelpers'
import { getOperatorsForFieldType, isFieldFilterable, isMultiValueOperator } from '../utils/filterOperators'
import type { FilterOperator } from '../utils/filterOperators'
import { BottomSheet } from '../BottomSheet'
import type { ActiveFilter } from '../hooks/useDocumentListFilters'
import { useListColors } from '../hooks/useListColors'

import type { Props } from './types'
import { createStyles } from './styles'
import { formatDateLabel } from './utils'
import { useQueryPresets } from './hooks/useQueryPresets'
import { OverviewStep } from './components/OverviewStep'
import { ValueInput } from './components/ValueInput'

export type { FilterApplyPayload } from './types'

export const FilterBottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  fields,
  onApply,
  initialFilter,
  activeFilters,
  onRemoveFilter,
  presetsCollection,
  onApplyFilterGroups,
  presetsColumns,
}) => {
  const { colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [step, setStep] = useState<0 | 1 | 2 | 3>(1)
  const [selectedField, setSelectedField] = useState<ClientField | null>(null)
  const [selectedOp, setSelectedOp] = useState<FilterOperator | null>(null)
  const [value, setValue] = useState<unknown>('')
  const [valueLabel, setValueLabel] = useState<string | undefined>(undefined)
  /** Id of the filter being edited (chip tap or overview row tap). */
  const [editingId, setEditingId] = useState<string | null>(null)
  /** AND joins the current group, OR starts a new one (web parity). */
  const [combine, setCombine] = useState<'and' | 'or'>('and')

  // ── Query presets (payload-query-presets, REST-only) ─────────────
  const presetsEnabled = Boolean(presetsCollection && onApplyFilterGroups)
  const presets = useQueryPresets({
    visible,
    presetsEnabled,
    presetsCollection,
    presetsColumns,
    activeFilters,
    fields,
  })

  const filterableFields = fields.filter(isFieldFilterable)
  const operators = selectedField ? getOperatorsForFieldType(selectedField.type) : []

  // Presets give the overview step a reason to exist even with zero filters
  const hasOverview = Boolean(activeFilters && activeFilters.length > 0) || presetsEnabled

  // OR-groups view of the active filters (overview step)
  const overviewGroups = useMemo(() => {
    const byGroup: ActiveFilter[][] = []
    for (const f of activeFilters ?? []) {
      const gi = f.groupIndex ?? 0
      if (!byGroup[gi]) byGroup[gi] = []
      byGroup[gi].push(f)
    }
    return byGroup.filter((g) => g && g.length > 0)
  }, [activeFilters])

  const clearCondition = () => {
    setSelectedField(null)
    setSelectedOp(null)
    setValue('')
    setValueLabel(undefined)
    setEditingId(null)
    setCombine('and')
  }

  const reset = () => {
    clearCondition()
    presets.setPresetSaveOpen(false)
    presets.setPresetError(null)
    setStep(hasOverview ? 0 : 1)
  }

  /** Pre-fill field/operator/value from an existing filter and jump to the value step. */
  const prefillFromFilter = (filter: ActiveFilter) => {
    const field = fields.find((f) => f.name === filter.field) ?? null
    const op = field
      ? getOperatorsForFieldType(field.type).find((o) => o.value === filter.operator) ?? null
      : null
    setSelectedField(field)
    setSelectedOp(op)
    setValue(filter.value)
    setValueLabel(filter.valueLabel)
    setEditingId(filter.id)
    setCombine('and')
    setStep(field && op ? 3 : 1)
  }

  // On open: pre-fill for chip editing, otherwise land on the overview
  // (when active filters exist) or the field list.
  useEffect(() => {
    if (!visible) return
    if (initialFilter) {
      prefillFromFilter(initialFilter)
    } else {
      clearCondition()
      setStep((activeFilters && activeFilters.length > 0) || presetsEnabled ? 0 : 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialFilter, fields])

  const handleClose = () => {
    reset()
    onClose()
  }

  /** '+ Add filter' (AND into current group) / '+ Or' (new group) from the overview. */
  const startAdd = (mode: 'and' | 'or') => {
    clearCondition()
    setCombine(mode)
    setStep(1)
  }

  const handleFieldSelect = (field: ClientField) => {
    setSelectedField(field)
    setSelectedOp(null)
    setValue('')
    setValueLabel(undefined)
    setStep(2)
  }

  const handleOpSelect = (op: FilterOperator) => {
    setSelectedOp(op)
    if (op.value === 'exists') {
      // 'exists' needs a boolean value — default true
      setValue(true)
      setValueLabel(undefined)
    } else if (selectedField?.type === 'date' && !isMultiValueOperator(op.value)) {
      // Native pickers always show a value — default to today
      const today = new Date()
      setValue(today.toISOString())
      setValueLabel(formatDateLabel(today))
    } else {
      setValue('')
      setValueLabel(undefined)
    }
    setStep(3)
  }

  const handleValueChange = useCallback((v: unknown, label?: string) => {
    setValue(v)
    setValueLabel(label)
  }, [])

  const handleApply = () => {
    if (!selectedField?.name || !selectedOp) return
    onApply({
      ...(editingId ? { id: editingId } : {}),
      field: selectedField.name,
      fieldLabel: getFieldLabel(selectedField),
      operator: selectedOp.value,
      operatorLabel: selectedOp.label,
      value,
      ...(valueLabel ? { valueLabel } : {}),
      ...(!editingId && combine === 'or' ? { newGroup: true } : {}),
    })
    reset()
  }

  const handleBack = () => {
    if (step === 3) setStep(2)
    else if (step === 2) setStep(1)
    else if (step === 1 && hasOverview) {
      clearCondition()
      setStep(0)
    }
  }

  const showBack = step > 1 || (step === 1 && hasOverview)

  const title =
    step === 0 ? 'Filters' :
    step === 1 ? (editingId ? 'Edit filter' : 'Filter by field') :
    step === 2 ? `${getFieldLabel(selectedField!)} — operator` :
    `${getFieldLabel(selectedField!)} ${selectedOp!.label}`

  // Date pickers and doc pickers need more room than a keyboard input
  const needsTallSheet =
    step === 3 &&
    selectedOp?.value !== 'exists' &&
    !isMultiValueOperator(selectedOp?.value ?? '') &&
    (selectedField?.type === 'date' ||
      selectedField?.type === 'relationship' ||
      selectedField?.type === 'upload')

  const applyDisabled =
    value === '' || value == null || (Array.isArray(value) && value.length === 0)

  // Show the AND/OR group choice when creating a new filter. When the
  // overview is available the choice was already made via its buttons but
  // stays adjustable; without `activeFilters` knowledge (legacy callers) the
  // toggle is always offered.
  const showCombineToggle =
    step === 3 && !editingId && (activeFilters === undefined || activeFilters.length > 0)

  return (
    <BottomSheet visible={visible} onClose={handleClose} height={needsTallSheet ? 0.75 : 0.55}>
      {/* Header */}
      <View style={styles.header}>
        {showBack && (
          <Pressable onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        )}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>

      {/* Step 0: OR-group overview (web WhereBuilder parity) */}
      {step === 0 && (
        <OverviewStep
          styles={styles}
          colors={colors}
          overviewGroups={overviewGroups}
          onRemoveFilter={onRemoveFilter}
          prefillFromFilter={prefillFromFilter}
          startAdd={startAdd}
          presetsEnabled={presetsEnabled}
          presets={presets}
          activeFilters={activeFilters}
          onApplyFilterGroups={onApplyFilterGroups}
          handleClose={handleClose}
        />
      )}

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
            onChange={handleValueChange}
            colors={colors}
            styles={styles}
          />

          {/* AND / OR group choice (new filters only) */}
          {showCombineToggle && (
            <View style={styles.combineRow}>
              <Text style={styles.combineLabel}>Combine with existing filters</Text>
              <View style={styles.combineSegmentRow}>
                {(['and', 'or'] as const).map((mode) => (
                  <Pressable
                    key={mode}
                    style={[styles.combineSegment, combine === mode && styles.combineSegmentActive]}
                    onPress={() => setCombine(mode)}
                  >
                    <Text
                      style={[
                        styles.combineSegmentText,
                        combine === mode && styles.combineSegmentTextActive,
                      ]}
                    >
                      {mode === 'and' ? 'AND — same group' : 'OR — new group'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Pressable
            style={[styles.applyBtn, applyDisabled && styles.applyDisabled]}
            onPress={handleApply}
            disabled={applyDisabled}
          >
            <Text style={styles.applyText}>
              {editingId ? 'Update Filter' : 'Apply Filter'}
            </Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  )
}
