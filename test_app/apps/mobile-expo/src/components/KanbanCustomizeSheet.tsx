/**
 * KanbanCustomizeSheet — board customisation for the collection kanban view.
 *
 * Sections:
 *   1. Status field picker — eligible select (hasMany: false) / radio fields
 *   2. Columns — visibility toggle + drag-to-reorder + per-column colour
 *      (the trailing "No <status>" column is fixed last, toggle/colour only)
 *   3. Colour editor — native SwiftUI ColorPicker via the admin-native
 *      registry (null-checked) with a curated 8-swatch fallback row
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
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  Check,
  Circle,
  CircleCheck,
  Eye,
  EyeOff,
  GripVertical,
} from 'lucide-react-native'
import {
  BottomSheet,
  DEFAULT_KANBAN_PALETTE,
  getFieldLabel,
  NO_STATUS_COLUMN_COLOR,
  NO_STATUS_COLUMN_VALUE,
  normalizeOption,
  useListColors,
  type ClientField,
  type ListColorPalette,
} from '@payload-universal/admin-native'
import { nativeComponents, NativeHost } from '@payload-universal/admin-native/fields'

import type { KanbanConfig } from '@/src/hooks/useKanbanConfig'

// Optional drag-to-reorder (react-native-reanimated-dnd v2 + worklets 0.7.x
// are installed in the app; keep the require guarded for Expo Go parity with
// the DocumentList summary-fields picker precedent)
let Sortable: any = null
let SortableItem: any = null
try {
  const dnd = require('react-native-reanimated-dnd')
  Sortable = dnd.Sortable
  SortableItem = dnd.SortableItem
} catch {
  /* drag unavailable — lists stay toggle-only */
}

const ROW_HEIGHT = 54
/** Curated quick-pick swatches (also the fallback when ColorPicker is null). */
const SWATCHES = DEFAULT_KANBAN_PALETTE.slice(0, 8)

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type KanbanCustomizeSheetProps = {
  visible: boolean
  onClose: () => void
  /** Eligible status fields: plain selects (hasMany false) and radios. */
  statusFieldCandidates: ClientField[]
  /** Fields offered in the card-fields multi-select. */
  cardFieldCandidates: ClientField[]
  config: KanbanConfig
  onSave: (next: KanbanConfig) => void
}

type OptionLike = { label: string; value: string }

type FieldWithOptions = ClientField & { options?: Array<string | { label: string | Record<string, string>; value: string }> }

const optionsOf = (field: ClientField | undefined): OptionLike[] => {
  const raw = (field as FieldWithOptions | undefined)?.options
  if (!Array.isArray(raw)) return []
  return raw.map((o) => normalizeOption(o))
}

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
  const { dark, colors } = useListColors()
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

  const renderColumnRowInner = useCallback(
    (value: string, label: string, draggable: boolean) => {
      const hidden = draft.hiddenColumns.includes(value)
      const color = resolveColor(value)
      return (
        <>
          <Pressable
            style={styles.rowToggle}
            hitSlop={6}
            onPress={() => toggleColumnVisibility(value)}
          >
            {hidden ? (
              <EyeOff size={20} color={colors.textPlaceholder} />
            ) : (
              <Eye size={20} color={colors.primary} />
            )}
          </Pressable>
          <Text
            style={[styles.rowLabel, hidden && styles.rowLabelHidden]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {!draggable && <Text style={styles.fixedTag}>always last</Text>}
          <Pressable
            hitSlop={8}
            onPress={() => setColorTarget((cur) => (cur === value ? null : value))}
            style={[
              styles.swatch,
              { backgroundColor: color },
              colorTarget === value && { borderColor: colors.text, borderWidth: 2 },
            ]}
          />
        </>
      )
    },
    [draft.hiddenColumns, resolveColor, toggleColumnVisibility, colorTarget, colors, styles],
  )

  // Sortable render callback — spread ...props; handle is a direct child.
  const renderSortableColumn = useCallback(
    ({ item, ...props }: any) => (
      <SortableItem
        key={item.id}
        id={item.id}
        data={item}
        onMove={noopMove}
        onDrop={handleColumnDrop}
        {...props}
      >
        <View style={styles.row}>
          <SortableItem.Handle>
            <View style={styles.dragHandle}>
              <GripVertical size={18} color={colors.textMuted} />
            </View>
          </SortableItem.Handle>
          {renderColumnRowInner(item.value, labelByValue.get(item.value) ?? item.value, true)}
        </View>
      </SortableItem>
    ),
    [noopMove, handleColumnDrop, renderColumnRowInner, labelByValue, colors, styles],
  )

  const renderSortableCardField = useCallback(
    ({ item, ...props }: any) => (
      <SortableItem
        key={item.id}
        id={item.id}
        data={item}
        onMove={noopMove}
        onDrop={handleCardFieldDrop}
        {...props}
      >
        <View style={styles.row}>
          <SortableItem.Handle>
            <View style={styles.dragHandle}>
              <GripVertical size={18} color={colors.textMuted} />
            </View>
          </SortableItem.Handle>
          <Pressable style={styles.rowInner} onPress={() => toggleCardField(item.id)}>
            <View style={styles.checkbox}>
              <CircleCheck size={22} color={colors.primary} />
            </View>
            <View style={styles.fieldInfo}>
              <Text style={styles.rowLabel}>{getFieldLabel(item.field)}</Text>
              <Text style={styles.fieldType}>{item.field.type}</Text>
            </View>
          </Pressable>
        </View>
      </SortableItem>
    ),
    [noopMove, handleCardFieldDrop, toggleCardField, colors, styles],
  )

  // ── Colour editor (OUTSIDE the Sortable trees — @expo/ui allowed) ────
  const NativeColorPicker = nativeComponents.ColorPicker
  const colorSection =
    colorTarget != null ? (
      <View style={styles.colorSection}>
        <View style={styles.colorHeader}>
          <Text style={styles.sectionLabel}>
            {`COLOR — ${
              colorTarget === NO_STATUS_COLUMN_VALUE
                ? `No ${activeField ? getFieldLabel(activeField) : 'Status'}`
                : labelByValue.get(colorTarget) ?? colorTarget
            }`}
          </Text>
          <Pressable hitSlop={8} onPress={() => resetColumnColor(colorTarget)}>
            <Text style={styles.colorReset}>Reset</Text>
          </Pressable>
        </View>
        {NativeColorPicker ? (
          <View style={styles.colorPickerWrap}>
            <NativeHost matchContents>
              <NativeColorPicker
                selection={resolveColor(colorTarget)}
                label="Column color"
                supportsOpacity={false}
                onSelectionChange={(hex) => setColumnColor(colorTarget, hex)}
              />
            </NativeHost>
          </View>
        ) : (
          <View style={styles.swatchRow}>
            {SWATCHES.map((hex) => {
              const selected = resolveColor(colorTarget).toLowerCase() === hex.toLowerCase()
              return (
                <Pressable
                  key={hex}
                  onPress={() => setColumnColor(colorTarget, hex)}
                  style={[
                    styles.swatchLarge,
                    { backgroundColor: hex },
                    selected && { borderColor: colors.text, borderWidth: 2 },
                  ]}
                />
              )
            })}
          </View>
        )}
      </View>
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

// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 8,
      zIndex: 10,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 4 },
    sheetHint: { fontSize: 13, color: c.textMuted },
    saveBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginTop: 14,
      marginBottom: 4,
      paddingHorizontal: 8,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      height: ROW_HEIGHT,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
      backgroundColor: 'transparent',
    },
    rowInner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    rowToggle: {
      width: 32,
      height: ROW_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 6,
    },
    rowLabel: { flex: 1, fontSize: 15, color: c.text, fontWeight: '500' },
    rowLabelHidden: { color: c.textPlaceholder },
    fixedTag: { fontSize: 11, color: c.textMuted, marginRight: 8 },

    dragHandle: {
      width: 32,
      height: ROW_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dragHandlePlaceholder: { width: 32 },

    checkbox: { marginRight: 12 },
    fieldInfo: { flex: 1 },
    fieldType: { fontSize: 11, color: c.textMuted, marginTop: 1 },

    swatch: {
      width: 24,
      height: 24,
      borderRadius: 12,
      marginLeft: 8,
    },
    colorSection: {
      marginTop: 4,
      paddingBottom: 4,
    },
    colorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: 8,
    },
    colorReset: { fontSize: 13, fontWeight: '600', color: c.destructive },
    colorPickerWrap: { paddingHorizontal: 8, paddingVertical: 6 },
    swatchRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 8,
      paddingVertical: 8,
      flexWrap: 'wrap',
    },
    swatchLarge: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
  })
