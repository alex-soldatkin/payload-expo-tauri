/**
 * useKanbanRenderers — the row render callbacks for the kanban customise sheet
 * (the shared column-row body + the two Sortable render callbacks).
 *
 * Drag rules (memory-bank 013 'Drag-to-Reorder'): lucide icons ONLY inside
 * Sortable trees; onMove is a NO-OP; the handle is a direct child of
 * SortableItem with ...props spread onto SortableItem.
 */
import React, { useCallback } from 'react'
import { Pressable, Text, View } from 'react-native'
import { CircleCheck, Eye, EyeOff, GripVertical } from 'lucide-react-native'
import { getFieldLabel, useListColors } from '@payload-universal/admin-native'

import { SortableItem } from './dnd'
import type { KanbanSheetStyles } from './styles'

export function useKanbanRenderers({
  hiddenColumns,
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
}: {
  hiddenColumns: string[]
  colorTarget: string | null
  setColorTarget: React.Dispatch<React.SetStateAction<string | null>>
  resolveColor: (value: string) => string
  toggleColumnVisibility: (value: string) => void
  toggleCardField: (name: string) => void
  noopMove: () => void
  handleColumnDrop: (
    id: string,
    position: number,
    allPositions?: Record<string, number>,
  ) => void
  handleCardFieldDrop: (
    id: string,
    position: number,
    allPositions?: Record<string, number>,
  ) => void
  labelByValue: Map<string, string>
  styles: KanbanSheetStyles
}) {
  const { colors } = useListColors()

  const renderColumnRowInner = useCallback(
    (value: string, label: string, draggable: boolean) => {
      const hidden = hiddenColumns.includes(value)
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
    [hiddenColumns, resolveColor, toggleColumnVisibility, colorTarget, colors, styles, setColorTarget],
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

  return { renderColumnRowInner, renderSortableColumn, renderSortableCardField }
}
