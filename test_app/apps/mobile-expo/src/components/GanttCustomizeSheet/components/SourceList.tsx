/**
 * SourceList — the Sources section of the gantt list view: drag-to-reorder
 * rows (colour swatch, label, start → end subtitle) with edit / remove
 * actions, plus the tap-only fallback when dnd is unavailable.
 *
 * Drag rules (memory-bank 013 'Drag-to-Reorder'):
 *   - react-native-reanimated-dnd Sortable/SortableItem via try/catch require
 *   - onMove is a NO-OP; state updates only in onDrop (allPositions)
 *   - lucide icons ONLY inside Sortable trees (no @expo/ui there)
 *   - items use stable string ids; useFlatList={false} inside fixed-height
 */
import React, { useCallback, useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import { GripVertical, Pencil, Trash2 } from 'lucide-react-native'
import { type CalendarSource, type ListColorPalette } from '@payload-universal/admin-native'

import { ROW_HEIGHT, type SheetStyles } from '../styles'

// Optional drag-to-reorder (react-native-reanimated-dnd v2 + worklets 0.7.x
// are installed in the app; keep the require guarded for Expo Go parity with
// the Kanban/CalendarCustomizeSheet precedent)
let Sortable: any = null
let SortableItem: any = null
try {
  const dnd = require('react-native-reanimated-dnd')
  Sortable = dnd.Sortable
  SortableItem = dnd.SortableItem
} catch {
  /* drag unavailable — lists stay tap-only */
}

export const dndAvailable = Boolean(Sortable && SortableItem)

type SourceItem = { id: string; source: CalendarSource; index: number }

export type SourceListProps = {
  sources: CalendarSource[]
  styles: SheetStyles
  colors: ListColorPalette
  fieldLabel: (name: string | null | undefined) => string
  openEditSource: (source: CalendarSource, index: number) => void
  removeSource: (id: string) => void
  noopMove: () => void
  handleSourceDrop: (
    id: string,
    position: number,
    allPositions?: Record<string, number>,
  ) => void
}

export function SourceList({
  sources,
  styles,
  colors,
  fieldLabel,
  openEditSource,
  removeSource,
  noopMove,
  handleSourceDrop,
}: SourceListProps) {
  const renderSourceRowInner = useCallback(
    (source: CalendarSource, index: number) => (
      <>
        <Pressable
          style={styles.rowInner}
          hitSlop={4}
          onPress={() => openEditSource(source, index)}
        >
          <View style={[styles.swatch, { backgroundColor: source.color }]} />
          <View style={styles.fieldInfo}>
            <Text style={styles.rowLabel} numberOfLines={1}>
              {source.label}
            </Text>
            <Text style={styles.fieldType} numberOfLines={1}>
              {fieldLabel(source.startField)}
              {source.endField ? ` → ${fieldLabel(source.endField)}` : ''}
            </Text>
          </View>
          <Pencil size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable
          hitSlop={8}
          style={styles.rowAction}
          onPress={() => removeSource(source.id)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${source.label}`}
        >
          <Trash2 size={18} color={colors.destructive} />
        </Pressable>
      </>
    ),
    [openEditSource, removeSource, fieldLabel, colors, styles],
  )

  // Sortable render callback — spread ...props; handle is a direct child.
  const renderSortableSource = useCallback(
    ({ item, ...props }: any) => (
      <SortableItem
        key={item.id}
        id={item.id}
        data={item}
        onMove={noopMove}
        onDrop={handleSourceDrop}
        {...props}
      >
        <View style={styles.row}>
          <SortableItem.Handle>
            <View style={styles.dragHandle}>
              <GripVertical size={18} color={colors.textMuted} />
            </View>
          </SortableItem.Handle>
          {renderSourceRowInner(item.source, item.index)}
        </View>
      </SortableItem>
    ),
    [noopMove, handleSourceDrop, renderSourceRowInner, colors, styles],
  )

  const sourceItems = useMemo<SourceItem[]>(
    () => sources.map((source, index) => ({ id: source.id, source, index })),
    [sources],
  )

  return (
    <>
      <Text style={styles.sectionLabel}>
        {dndAvailable && sourceItems.length > 1 ? 'SOURCES — drag to reorder' : 'SOURCES'}
      </Text>
      {sourceItems.length === 0 && (
        <Text style={styles.emptyText}>No sources — add one below.</Text>
      )}
      {dndAvailable && sourceItems.length > 0 ? (
        <View style={{ height: sourceItems.length * ROW_HEIGHT }}>
          <Sortable
            data={sourceItems}
            renderItem={renderSortableSource}
            itemHeight={ROW_HEIGHT}
            useFlatList={false}
            style={{ backgroundColor: 'transparent' }}
            contentContainerStyle={{ backgroundColor: 'transparent' }}
          />
        </View>
      ) : (
        sourceItems.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.dragHandlePlaceholder} />
            {renderSourceRowInner(item.source, item.index)}
          </View>
        ))
      )}
    </>
  )
}
