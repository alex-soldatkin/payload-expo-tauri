/**
 * Summary Fields Picker — sortable list with drag handles + list settings
 * (per-page selector, table pin toggles). Changes are buffered until "Save".
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'

import type { ClientField } from '../../types'
import { getFieldLabel } from '../../utils/schemaHelpers'
import { useListColors } from '../../hooks/useListColors'
import { BottomSheet } from '../../BottomSheet'
import {
  CheckIcon,
  CircleCheckIcon,
  CircleIcon,
  GripVerticalIcon,
  Sortable,
  SortableItem,
  XIcon,
} from '../icons'
import { createSfStyles } from '../styles'
import { SORTABLE_ITEM_HEIGHT } from '../types'
import type { TablePins } from '../types'
import { PageSizeSelector } from './PageSizeSelector'
import { PinToggleRow } from './PinToggleRow'

type SummaryFieldsPickerProps = {
  visible: boolean
  onClose: () => void
  fields: ClientField[]
  summaryFields: string[]
  onSummaryFieldsChange: (fields: string[]) => void
  collection: string
  pageSize: number
  pageSizeOptions: number[]
  onPageSizeChange: (pageSize: number) => void
  /** Table-mode pin state — section hidden when undefined (card mode). */
  tablePins?: TablePins
  /** Applies immediately (like the per-page selector — not draft-buffered). */
  onTablePinsChange?: (pins: TablePins) => void
}

export function SummaryFieldsPicker({
  visible,
  onClose,
  fields,
  summaryFields,
  onSummaryFieldsChange,
  collection,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  tablePins,
  onTablePinsChange,
}: SummaryFieldsPickerProps) {
  const { colors } = useListColors()
  const sfStyles = useMemo(() => createSfStyles(colors), [colors])

  // ── Local draft state — changes are buffered until "Save" ──────────
  const [draft, setDraft] = useState<string[]>(summaryFields)

  // Sync draft when the sheet opens or external state changes while closed
  useEffect(() => {
    if (visible) setDraft(summaryFields)
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  // Animated save button state: 'idle' | 'success' | 'error'
  const [saveState, setSaveState] = useState<'idle' | 'success' | 'error'>('idle')
  const saveBtnScale = useRef(new Animated.Value(1)).current

  const handleSave = useCallback(() => {
    // Bounce animation
    Animated.sequence([
      Animated.timing(saveBtnScale, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.spring(saveBtnScale, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }),
    ]).start()

    try {
      onSummaryFieldsChange(draft)
      setSaveState('success')
      // Flash green then close
      setTimeout(() => {
        setSaveState('idle')
        onClose()
      }, 600)
    } catch {
      setSaveState('error')
      // Flash red then reset
      setTimeout(() => setSaveState('idle'), 1200)
    }
  }, [draft, onSummaryFieldsChange, onClose, saveBtnScale])

  // Reset save state when sheet opens
  useEffect(() => {
    if (visible) setSaveState('idle')
  }, [visible])

  // ── Derived data from draft (not summaryFields) ────────────────────
  const displayableFields = fields.filter(
    (f) =>
      f.name &&
      !['id', 'createdAt', 'updatedAt'].includes(f.name) &&
      ['text', 'email', 'number', 'date', 'select', 'radio', 'checkbox', 'relationship', 'upload', 'textarea', 'richText', 'point', 'json'].includes(f.type),
  )
  const fieldMap = new Map(displayableFields.map((f) => [f.name!, f]))

  // Memoize selectedItems so Sortable doesn't remount on every render.
  // Sortable uses a hash of all item IDs as a React key — new object refs
  // with the same IDs still trigger a full remount, killing animations.
  const selectedItems = useMemo(
    () => draft
      .filter((name) => fieldMap.has(name))
      .map((name) => ({ id: name, field: fieldMap.get(name)! })),
    [draft, fieldMap],
  )

  const unselectedItems = displayableFields.filter(
    (f) => f.name && !draft.includes(f.name),
  )

  const handleToggle = useCallback((fieldName: string) => {
    setDraft((prev) => {
      const isSelected = prev.includes(fieldName)
      return isSelected
        ? prev.filter((f) => f !== fieldName)
        : [...prev, fieldName]
    })
  }, [])

  // onMove: the library requires this to update the data array (gotcha #11).
  // However, updating state during drag triggers Sortable remount (gotcha #23),
  // killing the animation. So onMove is a no-op — we defer to onDrop.
  const noopMove = useCallback(() => {}, [])

  // onDrop: called when the item is released. allPositions maps id → final index.
  // We read the final ordering from allPositions and update draft once.
  const handleDrop = useCallback(
    (_id: string, _position: number, allPositions?: Record<string, number>) => {
      if (!allPositions) return
      setDraft((prev) => {
        // allPositions maps item id → new index. Build the reordered array.
        const items = prev.filter((name) => allPositions[name] != null)
        const sorted = items.sort((a, b) => allPositions[a] - allPositions[b])
        // Preserve any fields in draft that aren't in the sortable (shouldn't happen, but safe)
        const rest = prev.filter((name) => allPositions[name] == null)
        return [...sorted, ...rest]
      })
    },
    [],
  )

  const handleClear = useCallback(() => setDraft([]), [])

  // Sortable render callback — must spread ...props (gotcha from SKILL.md)
  const renderSortableItem = useCallback(
    ({ item, ...props }: any) => (
      <SortableItem
        key={item.id}
        id={item.id}
        data={item}
        onMove={noopMove}
        onDrop={handleDrop}
        {...props}
      >
        <View style={sfStyles.fieldRow}>
          <SortableItem.Handle>
            <View style={sfStyles.dragHandle}>
              {GripVerticalIcon ? (
                <GripVerticalIcon size={18} color={colors.textMuted} />
              ) : (
                <Text style={sfStyles.dragIcon}>☰</Text>
              )}
            </View>
          </SortableItem.Handle>
          <Pressable
            style={sfStyles.fieldRowInner}
            onPress={() => handleToggle(item.id)}
          >
            {CircleCheckIcon ? (
              <View style={sfStyles.checkboxNative}>
                <CircleCheckIcon size={22} color={colors.primary} />
              </View>
            ) : (
              <View style={[sfStyles.checkbox, sfStyles.checkboxSelected]}>
                <Text style={sfStyles.checkmark}>✓</Text>
              </View>
            )}
            <View style={sfStyles.fieldInfo}>
              <Text style={sfStyles.fieldLabel}>{getFieldLabel(item.field)}</Text>
              <Text style={sfStyles.fieldType}>{item.field.type}</Text>
            </View>
          </Pressable>
        </View>
      </SortableItem>
    ),
    [noopMove, handleDrop, handleToggle, sfStyles, colors],
  )

  const sortableHeight = selectedItems.length * SORTABLE_ITEM_HEIGHT

  return (
    <BottomSheet visible={visible} onClose={onClose} height={0.7}>
      {/* Header row — title + Save button (zIndex keeps it above dragged items) */}
      <View style={sfStyles.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={sfStyles.sheetTitle}>List Settings</Text>
          <Text style={sfStyles.sheetHint}>
            Select fields to show as card details or table columns. Drag to reorder.
          </Text>
        </View>
        <Pressable onPress={handleSave}>
          <Animated.View style={[
            sfStyles.saveBtn,
            saveState === 'success' && sfStyles.saveBtnSuccess,
            saveState === 'error' && sfStyles.saveBtnError,
            { transform: [{ scale: saveBtnScale }] },
          ]}>
            {saveState === 'success' ? (
              CheckIcon ? <CheckIcon size={20} color={colors.primaryText} /> : <Text style={sfStyles.saveBtnText}>✓</Text>
            ) : saveState === 'error' ? (
              XIcon ? <XIcon size={20} color={colors.primaryText} /> : <Text style={sfStyles.saveBtnText}>✕</Text>
            ) : (
              CheckIcon ? <CheckIcon size={20} color={colors.primaryText} /> : <Text style={sfStyles.saveBtnText}>✓</Text>
            )}
          </Animated.View>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {/* Per-page selector — applies immediately */}
        <Text style={sfStyles.sectionLabel}>DOCUMENTS PER PAGE</Text>
        <PageSizeSelector
          pageSize={pageSize}
          options={pageSizeOptions}
          onChange={onPageSizeChange}
          sfStyles={sfStyles}
        />

        {/* Table pin toggles — table mode only; applies immediately. Plain
            rows OUTSIDE the Sortable tree below (native switches must never
            sit inside drag trees). */}
        {tablePins && onTablePinsChange && (
          <>
            <Text style={sfStyles.sectionLabel}>TABLE PINNING</Text>
            <PinToggleRow
              label="Pin header"
              value={tablePins.header}
              onChange={(v) => onTablePinsChange({ ...tablePins, header: v })}
              colors={colors}
              sfStyles={sfStyles}
            />
            <PinToggleRow
              label="Pin first column"
              value={tablePins.firstColumn}
              onChange={(v) => onTablePinsChange({ ...tablePins, firstColumn: v })}
              colors={colors}
              sfStyles={sfStyles}
            />
          </>
        )}

        {/* Active fields — Sortable with drag handles */}
        {selectedItems.length > 0 && Sortable && SortableItem ? (
          <>
            <Text style={sfStyles.sectionLabel}>ACTIVE — drag to reorder</Text>
            <View style={{ height: sortableHeight }}>
              <Sortable
                data={selectedItems}
                renderItem={renderSortableItem}
                itemHeight={SORTABLE_ITEM_HEIGHT}
                useFlatList={false}
                style={{ backgroundColor: 'transparent' }}
                contentContainerStyle={{ backgroundColor: 'transparent' }}
              />
            </View>
          </>
        ) : selectedItems.length > 0 ? (
          <>
            <Text style={sfStyles.sectionLabel}>ACTIVE</Text>
            {selectedItems.map((si) => (
              <Pressable key={si.id} style={sfStyles.fieldRow} onPress={() => handleToggle(si.id)}>
                <View style={sfStyles.dragHandle}>
                  {GripVerticalIcon ? (
                    <GripVerticalIcon size={18} color={colors.textMuted} />
                  ) : (
                    <Text style={sfStyles.dragIcon}>☰</Text>
                  )}
                </View>
                <View style={sfStyles.fieldRowInner}>
                  {CircleCheckIcon ? (
                    <View style={sfStyles.checkboxNative}>
                      <CircleCheckIcon size={22} color={colors.primary} />
                    </View>
                  ) : (
                    <View style={[sfStyles.checkbox, sfStyles.checkboxSelected]}>
                      <Text style={sfStyles.checkmark}>✓</Text>
                    </View>
                  )}
                  <View style={sfStyles.fieldInfo}>
                    <Text style={sfStyles.fieldLabel}>{getFieldLabel(si.field)}</Text>
                    <Text style={sfStyles.fieldType}>{si.field.type}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}

        {/* Available fields — plain list */}
        {unselectedItems.length > 0 && (
          <>
            <Text style={sfStyles.sectionLabel}>AVAILABLE</Text>
            {unselectedItems.map((field) => (
              <Pressable
                key={field.name}
                style={sfStyles.fieldRow}
                onPress={() => handleToggle(field.name!)}
              >
                <View style={sfStyles.dragHandlePlaceholder} />
                <View style={sfStyles.fieldRowInner}>
                  {CircleIcon ? (
                    <View style={sfStyles.checkboxNative}>
                      <CircleIcon size={22} color={colors.border} />
                    </View>
                  ) : (
                    <View style={sfStyles.checkbox} />
                  )}
                  <View style={sfStyles.fieldInfo}>
                    <Text style={sfStyles.fieldLabel}>{getFieldLabel(field)}</Text>
                    <Text style={sfStyles.fieldType}>{field.type}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {displayableFields.length === 0 && (
          <Text style={sfStyles.emptyText}>No displayable fields</Text>
        )}

        {draft.length > 0 && (
          <Pressable style={sfStyles.clearBtn} onPress={handleClear}>
            <Text style={sfStyles.clearText}>Clear all</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  )
}
