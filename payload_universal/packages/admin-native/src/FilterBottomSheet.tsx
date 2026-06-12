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
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'

import type { ClientField } from './types'
import { defaultTheme as t } from './theme'
import { getFieldLabel, normalizeOption } from './utils/schemaHelpers'
import { getOperatorsForFieldType, isFieldFilterable, isMultiValueOperator } from './utils/filterOperators'
import type { FilterOperator } from './utils/filterOperators'
import { BottomSheet } from './BottomSheet'
import { NativeHost } from './fields/NativeHost'
import { nativeComponents } from './fields/shared'
import { usePayloadNative } from './PayloadNativeProvider'
import { payloadApi } from './utils/api'
import { filtersToWhere, whereToFilterGroups } from './hooks/useDocumentListFilters'
import type { ActiveFilter, FilterCondition, WhereClause } from './hooks/useDocumentListFilters'
import { useListColors } from './hooks/useListColors'
import type { ListColorPalette } from './hooks/useListColors'

// Optional: local-first reads for the relationship doc picker
let _useLocalDB: (() => any) | null = null
try {
  _useLocalDB = require('@payload-universal/local-db').useLocalDB
} catch {
  /* local-db not available */
}

// Optional: GlassView for liquid glass group sections on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed */
}

export type FilterApplyPayload = {
  /** Present when editing an existing filter (chip tap) — update in place. */
  id?: string
  field: string
  fieldLabel: string
  operator: string
  operatorLabel: string
  value: unknown
  /** Human-readable value for chip display (doc title, formatted date, …). */
  valueLabel?: string
  /**
   * Start a new OR-group with this filter (web "+ Or"). Absent/false ⇒ the
   * filter ANDs into the current group.
   */
  newGroup?: boolean
}

type Props = {
  visible: boolean
  onClose: () => void
  fields: ClientField[]
  onApply: (filter: FilterApplyPayload) => void
  /** Pre-fill the editor with an existing filter (opens at the value step). */
  initialFilter?: ActiveFilter | null
  /**
   * All currently active filters. When provided, opening the sheet (without
   * `initialFilter`) shows the OR-group overview step: groups as glass inset
   * sections, 'OR' pill dividers, '+ Add filter' / '+ Or' actions.
   */
  activeFilters?: ActiveFilter[]
  /** Remove a filter from the overview step (✕ on a condition row). */
  onRemoveFilter?: (id: string) => void
  /**
   * Collection slug whose Payload-native query presets appear in a Presets
   * section on the overview step. Presets live in 'payload-query-presets' —
   * REST-only (local-first sync deliberately skips payload-* slugs), fetched
   * with `where[relatedCollection][equals]=<slug>`. Requires
   * `onApplyFilterGroups`. Saving posts `{ title, relatedCollection, where,
   * columns }` (columns in the web `{ accessor, active }[]` shape).
   */
  presetsCollection?: string
  /** Replace ALL active filters with a preset's parsed OR-groups. */
  onApplyFilterGroups?: (groups: FilterCondition[][]) => void
  /** Column accessors saved with a new query preset (current visible columns). */
  presetsColumns?: string[]
}

/** Minimal slice of a payload-query-presets doc the sheet works with. */
type QueryPresetDoc = {
  id: string
  title: string
  isShared?: boolean | null
  where?: unknown
  columns?: unknown
}

const presetWhereOf = (preset: QueryPresetDoc): WhereClause | undefined =>
  preset.where && typeof preset.where === 'object' && !Array.isArray(preset.where)
    ? (preset.where as WhereClause)
    : undefined

const formatDateLabel = (d: Date): string =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

const truncateLabel = (s: string): string => (s.length > 28 ? s.slice(0, 28) + '…' : s)

/** Human-readable condition value for overview rows (mirrors chip display). */
const formatFilterValue = (filter: ActiveFilter): string => {
  if (filter.valueLabel) return truncateLabel(filter.valueLabel)
  const { value } = filter
  if (value === true) return 'true'
  if (value === false) return 'false'
  if (value == null) return ''
  if (Array.isArray(value)) return truncateLabel(value.map(String).join(', '))
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return formatDateLabel(d)
  }
  return truncateLabel(s)
}

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
  const { baseURL, auth } = usePayloadNative()

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
  const [presets, setPresets] = useState<QueryPresetDoc[]>([])
  const [presetsLoading, setPresetsLoading] = useState(false)
  const [presetSaveOpen, setPresetSaveOpen] = useState(false)
  const [presetTitle, setPresetTitle] = useState('')
  const [presetSaving, setPresetSaving] = useState(false)
  const [presetError, setPresetError] = useState<string | null>(null)
  /** Bumped after a save so the list refetches. */
  const [presetsEpoch, setPresetsEpoch] = useState(0)

  const filterableFields = fields.filter(isFieldFilterable)
  const operators = selectedField ? getOperatorsForFieldType(selectedField.type) : []

  // Presets give the overview step a reason to exist even with zero filters
  const hasOverview = Boolean(activeFilters && activeFilters.length > 0) || presetsEnabled

  useEffect(() => {
    if (!visible || !presetsEnabled || !presetsCollection) return
    let cancelled = false
    setPresetsLoading(true)
    payloadApi
      .find({ baseURL, token: auth.token }, 'payload-query-presets', {
        where: { relatedCollection: { equals: presetsCollection } },
        limit: 50,
        depth: 0,
        sort: '-updatedAt',
      })
      .then((result) => {
        if (!cancelled) setPresets(result.docs as QueryPresetDoc[])
      })
      .catch(() => {
        if (!cancelled) setPresets([])
      })
      .finally(() => {
        if (!cancelled) setPresetsLoading(false)
      })
    return () => { cancelled = true }
  }, [visible, presetsEnabled, presetsCollection, baseURL, auth.token, presetsEpoch])

  // Parse each preset's where once — flags conditions the local evaluator
  // can't run so the limitation can be noted inline on the row.
  const parsedPresets = useMemo(
    () =>
      presets.map((preset) => ({
        preset,
        ...whereToFilterGroups(presetWhereOf(preset), fields),
      })),
    [presets, fields],
  )

  const handleSavePreset = async () => {
    const title = presetTitle.trim()
    if (!title || !presetsCollection || presetSaving) return
    setPresetSaving(true)
    setPresetError(null)
    try {
      await payloadApi.create({ baseURL, token: auth.token }, 'payload-query-presets', {
        title,
        relatedCollection: presetsCollection,
        where: filtersToWhere(activeFilters ?? []) ?? {},
        ...(presetsColumns && presetsColumns.length > 0
          ? { columns: presetsColumns.map((accessor) => ({ accessor, active: true })) }
          : {}),
      })
      setPresetTitle('')
      setPresetSaveOpen(false)
      setPresetsEpoch((e) => e + 1)
    } catch (err) {
      setPresetError(err instanceof Error ? err.message : 'Failed to save preset')
    } finally {
      setPresetSaving(false)
    }
  }

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
    setPresetSaveOpen(false)
    setPresetError(null)
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
        <ScrollView
          style={styles.overviewScroll}
          contentContainerStyle={styles.overviewContent}
          showsVerticalScrollIndicator={false}
        >
          {overviewGroups.length === 0 && (
            <Text style={styles.emptyText}>No filters set</Text>
          )}
          {overviewGroups.map((group, gi) => (
            <React.Fragment key={group[0].id}>
              {gi > 0 && (
                <View style={styles.orPillRow}>
                  <View style={styles.orPillLine} />
                  <View style={styles.orPill}>
                    <Text style={styles.orPillText}>OR</Text>
                  </View>
                  <View style={styles.orPillLine} />
                </View>
              )}
              <GroupSurface styles={styles}>
                {group.map((f, fi) => (
                  <React.Fragment key={f.id}>
                    {fi > 0 && (
                      <View style={styles.andRow}>
                        <Text style={styles.andLabel}>and</Text>
                        <View style={styles.andLine} />
                      </View>
                    )}
                    <Pressable
                      style={({ pressed }) => [
                        styles.conditionRow,
                        pressed && styles.conditionRowPressed,
                      ]}
                      onPress={() => prefillFromFilter(f)}
                    >
                      <Text style={styles.conditionText} numberOfLines={2}>
                        <Text style={styles.conditionField}>{f.fieldLabel}</Text>
                        {` ${f.operatorLabel} `}
                        <Text style={styles.conditionValue}>{formatFilterValue(f)}</Text>
                      </Text>
                      {onRemoveFilter && (
                        <Pressable onPress={() => onRemoveFilter(f.id)} hitSlop={10}>
                          <Text style={styles.conditionRemove}>✕</Text>
                        </Pressable>
                      )}
                    </Pressable>
                  </React.Fragment>
                ))}
              </GroupSurface>
            </React.Fragment>
          ))}

          {/* '+ Add filter' ANDs into the current group; '+ Or' starts a new group */}
          <View style={styles.overviewActions}>
            <Pressable style={styles.addFilterBtn} onPress={() => startAdd('and')}>
              <Text style={styles.addFilterText}>+ Add filter</Text>
            </Pressable>
            {overviewGroups.length > 0 && (
              <Pressable style={styles.addOrBtn} onPress={() => startAdd('or')}>
                <Text style={styles.addOrText}>+ Or</Text>
              </Pressable>
            )}
          </View>

          {/* ── Query presets (payload-query-presets, REST-only) ───────── */}
          {presetsEnabled && (
            <View style={styles.presetSection}>
              <Text style={styles.presetHeading}>Presets</Text>
              {presetsLoading && presets.length === 0 ? (
                <ActivityIndicator style={styles.presetLoading} />
              ) : parsedPresets.length === 0 ? (
                <Text style={styles.presetEmpty}>No saved presets</Text>
              ) : (
                parsedPresets.map(({ preset, groups: presetGroups, unsupported }) => (
                  <Pressable
                    key={preset.id}
                    style={({ pressed }) => [styles.presetRow, pressed && styles.conditionRowPressed]}
                    onPress={() => {
                      onApplyFilterGroups?.(presetGroups)
                      handleClose()
                    }}
                  >
                    <View style={styles.presetRowBody}>
                      <Text style={styles.presetTitle} numberOfLines={1}>{preset.title}</Text>
                      {unsupported.length > 0 && (
                        <Text style={styles.presetWarn} numberOfLines={2}>
                          Includes conditions this device can't filter locally
                          {` (${unsupported.join(', ')})`}
                        </Text>
                      )}
                    </View>
                    {preset.isShared ? (
                      <View style={styles.presetBadge}>
                        <Text style={styles.presetBadgeText}>Shared</Text>
                      </View>
                    ) : null}
                  </Pressable>
                ))
              )}

              {/* Save the current filters as a new query preset */}
              {(activeFilters?.length ?? 0) > 0 && (
                presetSaveOpen ? (
                  <View style={styles.presetSaveBox}>
                    <TextInput
                      style={styles.textInput}
                      value={presetTitle}
                      onChangeText={setPresetTitle}
                      placeholder="Preset title"
                      placeholderTextColor={colors.textPlaceholder}
                      autoCapitalize="sentences"
                      autoCorrect={false}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleSavePreset}
                    />
                    {presetError && <Text style={styles.presetError}>{presetError}</Text>}
                    <View style={styles.presetSaveActions}>
                      <Pressable
                        style={[
                          styles.addFilterBtn,
                          (!presetTitle.trim() || presetSaving) && styles.applyDisabled,
                        ]}
                        disabled={!presetTitle.trim() || presetSaving}
                        onPress={handleSavePreset}
                      >
                        <Text style={styles.addFilterText}>
                          {presetSaving ? 'Saving…' : 'Save preset'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.addOrBtn}
                        onPress={() => {
                          setPresetSaveOpen(false)
                          setPresetError(null)
                        }}
                      >
                        <Text style={styles.addOrText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.presetRow, pressed && styles.conditionRowPressed]}
                    onPress={() => setPresetSaveOpen(true)}
                  >
                    <Text style={styles.presetSaveLink}>+ Save filters as preset…</Text>
                  </Pressable>
                )
              )}
            </View>
          )}
        </ScrollView>
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

// ---------------------------------------------------------------------------
// Group surface — liquid glass inset section on iOS 26+, themed fallback
// ---------------------------------------------------------------------------

const GroupSurface: React.FC<{
  styles: ReturnType<typeof createStyles>
  children: React.ReactNode
}> = ({ styles, children }) => {
  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView style={styles.groupSection} glassEffectStyle="regular">
        {children}
      </GlassView>
    )
  }
  return <View style={[styles.groupSection, styles.groupSectionFallback]}>{children}</View>
}

// ---------------------------------------------------------------------------
// Value input — adapts to field type
// ---------------------------------------------------------------------------

type ValueInputProps = {
  field: ClientField
  operator: string
  value: unknown
  onChange: (v: unknown, label?: string) => void
  colors: ListColorPalette
  styles: ReturnType<typeof createStyles>
}

const ValueInput: React.FC<ValueInputProps> = ({ field, operator, value, onChange, colors, styles }) => {
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

// ---------------------------------------------------------------------------
// Date value input — registry DatePicker (iOS) / JCDateTimePicker (Android),
// YYYY-MM-DD text input fallback
// ---------------------------------------------------------------------------

const DateValueInput: React.FC<{
  value: unknown
  onChange: (v: unknown, label?: string) => void
  colors: ListColorPalette
  styles: ReturnType<typeof createStyles>
}> = ({ value, onChange, colors, styles }) => {
  const NativeDatePicker = nativeComponents.DatePicker
  const dpStyleMod = nativeComponents.datePickerStyle
  const JCDatePicker = nativeComponents.JCDateTimePicker

  const parsed = typeof value === 'string' && value ? new Date(value) : new Date()
  const selection = isNaN(parsed.getTime()) ? new Date() : parsed

  const handleDate = useCallback(
    (d: Date) => onChange(d.toISOString(), formatDateLabel(d)),
    [onChange],
  )

  if (NativeDatePicker) {
    return (
      <View style={styles.dateWrap}>
        <NativeHost matchContents={{ height: true }}>
          <NativeDatePicker
            selection={selection}
            onDateChange={handleDate}
            displayedComponents={['date']}
            modifiers={dpStyleMod ? [dpStyleMod('graphical')] : undefined}
          />
        </NativeHost>
      </View>
    )
  }

  if (JCDatePicker) {
    return (
      <View style={styles.dateWrap}>
        <NativeHost matchContents={{ height: true }}>
          <JCDatePicker
            initialDate={typeof value === 'string' && value ? value : null}
            onDateSelected={handleDate}
            variant="picker"
            displayedComponents="date"
          />
        </NativeHost>
      </View>
    )
  }

  // Pure-JS fallback — ISO date text entry
  return (
    <TextInput
      style={styles.textInput}
      value={value != null ? String(value) : ''}
      onChangeText={(v) => onChange(v)}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={colors.textPlaceholder}
      autoCapitalize="none"
      autoCorrect={false}
      autoFocus
    />
  )
}

// ---------------------------------------------------------------------------
// Relationship value picker — minimal searchable doc list
// (local-first RxDB when available, REST fallback)
// ---------------------------------------------------------------------------

const docDisplayTitle = (doc: Record<string, unknown>, useAsTitle?: string): string => {
  if (useAsTitle && doc[useAsTitle] != null) return String(doc[useAsTitle])
  return String(doc.title ?? doc.name ?? doc.email ?? doc.filename ?? doc.id ?? '')
}

const RelationValuePicker: React.FC<{
  relationTo: string
  multi: boolean
  value: unknown
  onChange: (v: unknown, label?: string) => void
  colors: ListColorPalette
  styles: ReturnType<typeof createStyles>
}> = ({ relationTo, multi, value, onChange, colors, styles }) => {
  const { baseURL, auth, schema } = usePayloadNative()
  const [search, setSearch] = useState('')
  const [docs, setDocs] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  const useAsTitle = schema?.menuModel?.collections.find(
    (c) => c.slug === relationTo,
  )?.useAsTitle

  const localDB = _useLocalDB ? _useLocalDB() : null
  const localCollection = localDB?.collections?.[relationTo]

  useEffect(() => {
    let cancelled = false
    const loadDocs = async () => {
      setLoading(true)
      try {
        if (localCollection) {
          const results = await localCollection
            .find({ selector: { _deleted: { $eq: false } }, sort: [{ updatedAt: 'desc' }], limit: 50 })
            .exec()
          if (!cancelled) setDocs(results.map((r: any) => r.toJSON()))
        } else {
          const result = await payloadApi.find({ baseURL, token: auth.token }, relationTo, {
            limit: 50,
            depth: 0,
            sort: '-updatedAt',
          })
          if (!cancelled) setDocs(result.docs)
        }
      } catch {
        if (!cancelled) setDocs([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadDocs()
    return () => { cancelled = true }
  }, [localCollection, baseURL, auth.token, relationTo])

  const filtered = useMemo(() => {
    if (!search.trim()) return docs
    const q = search.toLowerCase()
    return docs.filter((doc) => {
      const candidates = new Set(['title', 'name', 'email', 'filename', 'id'])
      if (useAsTitle) candidates.add(useAsTitle)
      return Array.from(candidates).some((f) => {
        const val = doc[f]
        return val != null && String(val).toLowerCase().includes(q)
      })
    })
  }, [docs, search, useAsTitle])

  const selectedIds = useMemo(
    () =>
      Array.isArray(value)
        ? value.map(String)
        : value !== '' && value != null
          ? [String(value)]
          : [],
    [value],
  )

  const handleSelect = (doc: Record<string, unknown>) => {
    const id = String(doc.id)
    const title = docDisplayTitle(doc, useAsTitle)
    if (!multi) {
      onChange(id, title)
      return
    }
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    const labels = next.map((nid) => {
      const d = docs.find((dd) => String(dd.id) === nid)
      return d ? docDisplayTitle(d, useAsTitle) : nid
    })
    onChange(next, labels.join(', ') || undefined)
  }

  return (
    <View style={styles.relationContainer}>
      <TextInput
        style={styles.textInput}
        value={search}
        onChangeText={setSearch}
        placeholder={`Search ${relationTo}...`}
        placeholderTextColor={colors.textPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading ? (
        <ActivityIndicator style={styles.relationLoading} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          style={styles.relationList}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const selected = selectedIds.includes(String(item.id))
            return (
              <Pressable
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => handleSelect(item)}
              >
                <Text
                  style={[styles.rowLabel, selected && styles.rowLabelSelected]}
                  numberOfLines={1}
                >
                  {docDisplayTitle(item, useAsTitle)}
                </Text>
                {selected && <Text style={styles.checkMark}>✓</Text>}
              </Pressable>
            )
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No documents found</Text>
          }
        />
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: t.spacing.md, gap: t.spacing.sm },
    backBtn: { paddingRight: t.spacing.sm },
    backText: { fontSize: t.fontSize.md, color: c.primary, fontWeight: '600' },
    title: { fontSize: t.fontSize.lg, fontWeight: '700', color: c.text, flex: 1 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    rowSelected: { backgroundColor: c.pressed },
    rowLabel: { fontSize: t.fontSize.md, color: c.text, flexShrink: 1 },
    rowLabelSelected: { fontWeight: '600' },
    rowType: { fontSize: t.fontSize.xs, color: c.textMuted, textTransform: 'uppercase' },
    checkMark: { fontSize: 16, color: c.primary },

    emptyText: { textAlign: 'center', padding: t.spacing.xl, color: c.textMuted },

    valueContainer: { flex: 1 },
    textInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: t.borderRadius.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm + 2,
      fontSize: t.fontSize.md,
      color: c.text,
      backgroundColor: c.surface,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: t.spacing.md,
    },
    switchLabel: { fontSize: t.fontSize.md, color: c.text },
    optionList: { maxHeight: 220 },

    dateWrap: { marginBottom: t.spacing.sm },

    relationContainer: { flex: 1 },
    relationList: { flex: 1, marginTop: t.spacing.sm },
    relationLoading: { paddingVertical: t.spacing.xl },

    applyBtn: {
      backgroundColor: c.primary,
      borderRadius: t.borderRadius.sm,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      marginTop: t.spacing.lg,
    },
    applyDisabled: { opacity: 0.4 },
    applyText: { color: c.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },

    // ── Step 0: OR-group overview ─────────────────────────────────
    overviewScroll: { flex: 1 },
    overviewContent: { paddingBottom: t.spacing.lg },
    groupSection: {
      borderRadius: t.borderRadius.lg,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
      overflow: 'hidden',
    },
    groupSectionFallback: {
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    conditionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.spacing.sm,
      paddingVertical: t.spacing.sm + 2,
    },
    conditionRowPressed: { opacity: 0.6 },
    conditionText: { flex: 1, fontSize: t.fontSize.sm, color: c.textMuted },
    conditionField: { color: c.text, fontWeight: '600' },
    conditionValue: { color: c.text, fontWeight: '500' },
    conditionRemove: { fontSize: 13, color: c.textMuted, fontWeight: '700' },
    andRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    andLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    andLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.hairline },
    orPillRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      marginVertical: t.spacing.sm + 2,
    },
    orPillLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.hairline },
    orPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.pressed,
      paddingHorizontal: t.spacing.md,
      paddingVertical: 3,
    },
    orPillText: {
      fontSize: 10,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 1,
    },
    overviewActions: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      marginTop: t.spacing.lg,
    },
    addFilterBtn: {
      flex: 1,
      borderRadius: t.borderRadius.sm,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      backgroundColor: c.primary,
    },
    addFilterText: { color: c.primaryText, fontSize: t.fontSize.sm, fontWeight: '600' },
    addOrBtn: {
      flex: 1,
      borderRadius: t.borderRadius.sm,
      paddingVertical: t.spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.primary,
      borderStyle: 'dashed',
    },
    addOrText: { color: c.primary, fontSize: t.fontSize.sm, fontWeight: '600' },

    // ── Step 0: query presets section ─────────────────────────────
    presetSection: { marginTop: t.spacing.xl },
    presetHeading: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: t.spacing.xs,
    },
    presetLoading: { paddingVertical: t.spacing.md },
    presetEmpty: { color: c.textMuted, fontSize: t.fontSize.sm, paddingVertical: t.spacing.sm },
    presetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingVertical: t.spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    presetRowBody: { flex: 1 },
    presetTitle: { fontSize: t.fontSize.md, color: c.text, fontWeight: '500' },
    presetWarn: { fontSize: t.fontSize.xs, color: c.warning, marginTop: 2 },
    presetBadge: {
      borderRadius: 999,
      backgroundColor: c.pressed,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 2,
    },
    presetBadgeText: { fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 0.5 },
    presetSaveLink: { fontSize: t.fontSize.sm, fontWeight: '600', color: c.primary },
    presetSaveBox: { marginTop: t.spacing.sm },
    presetSaveActions: { flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.sm },
    presetError: { fontSize: t.fontSize.xs, color: c.error, marginTop: t.spacing.xs },

    // ── Step 3: AND/OR group choice ───────────────────────────────
    combineRow: { marginTop: t.spacing.lg },
    combineLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: t.spacing.xs,
    },
    combineSegmentRow: {
      flexDirection: 'row',
      backgroundColor: c.pressed,
      borderRadius: t.borderRadius.sm,
      padding: 3,
    },
    combineSegment: {
      flex: 1,
      paddingVertical: t.spacing.sm,
      alignItems: 'center',
      borderRadius: t.borderRadius.sm - 2,
    },
    combineSegmentActive: { backgroundColor: c.surface },
    combineSegmentText: { fontSize: t.fontSize.xs, color: c.textMuted, fontWeight: '500' },
    combineSegmentTextActive: { color: c.text, fontWeight: '600' },
  })
