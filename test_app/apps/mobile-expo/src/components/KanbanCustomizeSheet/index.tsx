/**
 * KanbanCustomizeSheet — board customisation for the collection kanban view.
 *
 * Sections:
 *   1. Status field picker — eligible select (hasMany: false) / radio fields
 *   2. Columns — visibility toggle + drag-to-reorder + per-column colour
 *      (the trailing "No <status>" column is fixed last, toggle/colour only)
 *   3. Colour editor — native SwiftUI ColorPicker via the admin-native
 *      registry (null-checked) with a curated 8-swatch fallback row
 *      (see ./ColorEditorSection)
 *   4. Card fields — multi-select + drag-to-reorder (summary-picker UX)
 *
 * All changes buffer into a local draft; the ✓ button flushes the draft via
 * `onSave` (the parent persists through useKanbanConfig).
 *
 * Drag rules (memory-bank 013 'Drag-to-Reorder'):
 *   - react-native-reanimated-dnd Sortable/SortableItem via try/catch require
 *   - onMove is a NO-OP; state updates only in onDrop (allPositions)
 *   - lucide icons ONLY inside Sortable trees (no @expo/ui there) — the
 *     native ColorPicker section renders OUTSIDE both Sortables
 *   - items use stable string ids; useFlatList={false} inside fixed-height
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Check, Circle, CircleCheck } from 'lucide-react-native'
import {
  BottomSheet,
  DEFAULT_KANBAN_PALETTE,
  getFieldLabel,
  NO_STATUS_COLUMN_COLOR,
  NO_STATUS_COLUMN_VALUE,
  useListColors,
} from '@payload-universal/admin-native'

import type { KanbanConfig } from '@/src/hooks/useKanbanConfig'

import { ColorEditorSection } from './ColorEditorSection'
import { Sortable, SortableItem } from './dnd'
import { createStyles } from './styles'
import type { KanbanCustomizeSheetProps } from './types'
import { useKanbanRenderers } from './useKanbanRenderers'
import { ROW_HEIGHT, optionsOf } from './utils'

export type { KanbanCustomizeSheetProps } from './types'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KanbanCustomizeSheet({
  visible,
  onClose,
  statusFieldCandidates,
  cardFieldCandidates,
  config,
  onSave,
}: KanbanCustomizeSheetProps) {
  const { colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  // ── Buffered draft (flushed on ✓) ────────────────────────────────────
  const [draft, setDraft] = useState<KanbanConfig>(config)
  const [colorTarget, setColorTarget] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setDraft(config)
      setColorTarget(null)
    }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Active status field ──────────────────────────────────────────────
  const activeField = useMemo(() => {
    const byName = draft.statusField
      ? statusFieldCandidates.find((f) => f.name === draft.statusField)
      : undefined
    return byName ?? statusFieldCandidates[0]
  }, [draft.statusField, statusFieldCandidates])

  const options = useMemo(() => optionsOf(activeField), [activeField])

  // Display order: draft.columnOrder filtered to known values, missing
  // options appended in natural order (mirrors buildKanbanColumns).
  const displayOrder = useMemo(() => {
    const known = new Set(options.map((o) => o.value))
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const v of draft.columnOrder ?? []) {
      if (known.has(v) && !seen.has(v)) {
        seen.add(v)
        ordered.push(v)
      }
    }
    for (const o of options) {
      if (!seen.has(o.value)) ordered.push(o.value)
    }
    return ordered
  }, [draft.columnOrder, options])

  const optionIndexByValue = useMemo(
    () => new Map(options.map((o, i) => [o.value, i])),
    [options],
  )
  const labelByValue = useMemo(
    () => new Map(options.map((o) => [o.value, o.label])),
    [options],
  )

  const resolveColor = useCallback(
    (value: string): string => {
      if (value === NO_STATUS_COLUMN_VALUE) {
        return draft.columnColors[NO_STATUS_COLUMN_VALUE] ?? NO_STATUS_COLUMN_COLOR
      }
      return (
        draft.columnColors[value] ??
        DEFAULT_KANBAN_PALETTE[(optionIndexByValue.get(value) ?? 0) % DEFAULT_KANBAN_PALETTE.length]
      )
    },
    [draft.columnColors, optionIndexByValue],
  )

  // ── Section 1: status field ──────────────────────────────────────────
  const handleStatusFieldSelect = useCallback((name: string) => {
    setColorTarget(null)
    setDraft((prev) => {
      if (prev.statusField === name) return prev
      // Column-shaped state is keyed by the old field's option values —
      // reset it when the driving field changes.
      return { ...prev, statusField: name, columnOrder: null, hiddenColumns: [], columnColors: {} }
    })
  }, [])

  // ── Section 2: columns ───────────────────────────────────────────────
  const columnItems = useMemo(
    () => displayOrder.map((value) => ({ id: value, value })),
    [displayOrder],
  )

  const toggleColumnVisibility = useCallback((value: string) => {
    setDraft((prev) => ({
      ...prev,
      hiddenColumns: prev.hiddenColumns.includes(value)
        ? prev.hiddenColumns.filter((v) => v !== value)
        : [...prev.hiddenColumns, value],
    }))
  }, [])

  // onMove must stay a no-op (state updates mid-drag remount the Sortable);
  // the final order is read once from onDrop's allPositions.
  const noopMove = useCallback(() => {}, [])

  const handleColumnDrop = useCallback(
    (_id: string, _position: number, allPositions?: Record<string, number>) => {
      if (!allPositions) return
      setDraft((prev) => {
        const next = Object.keys(allPositions).sort((a, b) => allPositions[a] - allPositions[b])
        return { ...prev, columnOrder: next }
      })
    },
    [],
  )

  const setColumnColor = useCallback((value: string, color: string) => {
    setDraft((prev) => ({ ...prev, columnColors: { ...prev.columnColors, [value]: color } }))
  }, [])

  const resetColumnColor = useCallback((value: string) => {
    setDraft((prev) => {
      const next = { ...prev.columnColors }
      delete next[value]
      return { ...prev, columnColors: next }
    })
  }, [])

  // ── Section 4: card fields ───────────────────────────────────────────
  const cardFieldMap = useMemo(
    () => new Map(cardFieldCandidates.filter((f) => f.name).map((f) => [f.name!, f])),
    [cardFieldCandidates],
  )
  const activeCardItems = useMemo(
    () =>
      draft.cardFields
        .filter((name) => cardFieldMap.has(name))
        .map((name) => ({ id: name, field: cardFieldMap.get(name)! })),
    [draft.cardFields, cardFieldMap],
  )
  const availableCardFields = useMemo(
    () => cardFieldCandidates.filter((f) => f.name && !draft.cardFields.includes(f.name)),
    [cardFieldCandidates, draft.cardFields],
  )

  const toggleCardField = useCallback((name: string) => {
    setDraft((prev) => ({
      ...prev,
      cardFields: prev.cardFields.includes(name)
        ? prev.cardFields.filter((f) => f !== name)
        : [...prev.cardFields, name],
    }))
  }, [])

  const handleCardFieldDrop = useCallback(
    (_id: string, _position: number, allPositions?: Record<string, number>) => {
      if (!allPositions) return
      setDraft((prev) => {
        const sortable = prev.cardFields.filter((name) => allPositions[name] != null)
        sortable.sort((a, b) => allPositions[a] - allPositions[b])
        const rest = prev.cardFields.filter((name) => allPositions[name] == null)
        return { ...prev, cardFields: [...sortable, ...rest] }
      })
    },
    [],
  )

  // ── Save ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    onSave({
      ...draft,
      statusField: activeField?.name ?? null,
      // Persist the explicit display order so newly added options still
      // append behind it (buildKanbanColumns appends missing values).
      columnOrder: displayOrder,
    })
    onClose()
  }, [draft, activeField, displayOrder, onSave, onClose])

  // ── Renderers ────────────────────────────────────────────────────────
  const { renderColumnRowInner, renderSortableColumn, renderSortableCardField } =
    useKanbanRenderers({
      hiddenColumns: draft.hiddenColumns,
      colorTarget,
      setColorTarget,
      resolveColor,
      toggleColumnVisibility,
      toggleCardField,
      noopMove,
      handleColumnDrop,
      handleCardFieldDrop,
      labelByValue,
      styles,
    })

  // ── Colour editor (OUTSIDE the Sortable trees — @expo/ui allowed) ────
  const colorSection =
    colorTarget != null ? (
      <ColorEditorSection
        colorTarget={colorTarget}
        activeField={activeField}
        labelByValue={labelByValue}
        resolveColor={resolveColor}
        setColumnColor={setColumnColor}
        resetColumnColor={resetColumnColor}
        styles={styles}
      />
    ) : null

  const dndAvailable = Boolean(Sortable && SortableItem)
  const noStatusLabel = `No ${activeField ? getFieldLabel(activeField) : 'Status'}`

  return (
    <BottomSheet visible={visible} onClose={onClose} detents={['medium', 'large']}>
      {/* Header — title + save */}
      <View style={styles.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetTitle}>Board Settings</Text>
          <Text style={styles.sheetHint}>Columns, colors and card fields.</Text>
        </View>
        <Pressable onPress={handleSave} hitSlop={8}>
          <View style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
            <Check size={20} color={colors.primaryText} />
          </View>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── Status field ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>STATUS FIELD</Text>
        {statusFieldCandidates.map((field) => {
          const selected = field.name === activeField?.name
          return (
            <Pressable
              key={field.name}
              style={styles.row}
              onPress={() => field.name && handleStatusFieldSelect(field.name)}
            >
              <View style={styles.dragHandlePlaceholder} />
              <View style={styles.checkbox}>
                {selected ? (
                  <CircleCheck size={22} color={colors.primary} />
                ) : (
                  <Circle size={22} color={colors.border} />
                )}
              </View>
              <View style={styles.fieldInfo}>
                <Text style={styles.rowLabel}>{getFieldLabel(field)}</Text>
                <Text style={styles.fieldType}>{field.type}</Text>
              </View>
            </Pressable>
          )
        })}

        {/* ── Columns ──────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>
          {dndAvailable ? 'COLUMNS — drag to reorder' : 'COLUMNS'}
        </Text>
        {dndAvailable && columnItems.length > 0 ? (
          <View style={{ height: columnItems.length * ROW_HEIGHT }}>
            <Sortable
              data={columnItems}
              renderItem={renderSortableColumn}
              itemHeight={ROW_HEIGHT}
              useFlatList={false}
              style={{ backgroundColor: 'transparent' }}
              contentContainerStyle={{ backgroundColor: 'transparent' }}
            />
          </View>
        ) : (
          columnItems.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.dragHandlePlaceholder} />
              {renderColumnRowInner(item.value, labelByValue.get(item.value) ?? item.value, true)}
            </View>
          ))
        )}
        {/* Trailing no-status column — fixed last, toggle/colour only */}
        <View style={styles.row}>
          <View style={styles.dragHandlePlaceholder} />
          {renderColumnRowInner(NO_STATUS_COLUMN_VALUE, noStatusLabel, false)}
        </View>

        {colorSection}

        {/* ── Card fields ──────────────────────────────────────────── */}
        {activeCardItems.length > 0 && (
          <Text style={styles.sectionLabel}>
            {dndAvailable ? 'CARD FIELDS — drag to reorder' : 'CARD FIELDS'}
          </Text>
        )}
        {dndAvailable && activeCardItems.length > 0 ? (
          <View style={{ height: activeCardItems.length * ROW_HEIGHT }}>
            <Sortable
              data={activeCardItems}
              renderItem={renderSortableCardField}
              itemHeight={ROW_HEIGHT}
              useFlatList={false}
              style={{ backgroundColor: 'transparent' }}
              contentContainerStyle={{ backgroundColor: 'transparent' }}
            />
          </View>
        ) : (
          activeCardItems.map((item) => (
            <Pressable key={item.id} style={styles.row} onPress={() => toggleCardField(item.id)}>
              <View style={styles.dragHandlePlaceholder} />
              <View style={styles.checkbox}>
                <CircleCheck size={22} color={colors.primary} />
              </View>
              <View style={styles.fieldInfo}>
                <Text style={styles.rowLabel}>{getFieldLabel(item.field)}</Text>
                <Text style={styles.fieldType}>{item.field.type}</Text>
              </View>
            </Pressable>
          ))
        )}
        {availableCardFields.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>AVAILABLE CARD FIELDS</Text>
            {availableCardFields.map((field) => (
              <Pressable
                key={field.name}
                style={styles.row}
                onPress={() => field.name && toggleCardField(field.name)}
              >
                <View style={styles.dragHandlePlaceholder} />
                <View style={styles.checkbox}>
                  <Circle size={22} color={colors.border} />
                </View>
                <View style={styles.fieldInfo}>
                  <Text style={styles.rowLabel}>{getFieldLabel(field)}</Text>
                  <Text style={styles.fieldType}>{field.type}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  )
}
