/**
 * Blocks field — stacked block cards (web parity) with:
 *   - a proper block picker presented in the package BottomSheet:
 *     searchable, grouped, showing block labels + description / imageURL
 *     thumbnails when present in the block config
 *   - per-block-row actions (Move Up / Move Down / Duplicate / Remove) via
 *     RowActionsMenu (tap-anchored SwiftUI Menu → JC ContextMenu → JS sheet)
 *   - editable blockName (small text affordance in the block header)
 *   - minRows (blocks Remove) / maxRows (disables Add / Duplicate)
 *
 * INTERNAL — import via the `fields/structural` barrel only.
 */
import React, { useContext, useMemo, useState } from 'react'
import {
  Alert,
  LayoutAnimation,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'

import type { ClientBlocksField, FieldComponentProps } from '../../../types'
import { defaultTheme as t } from '../../../theme'
import { getFieldLabel } from '../../../utils/schemaHelpers'
import { nativeComponents, useIsInsideNativeForm } from '../../shared'
import { SwipeToDeleteRow } from '../../../SwipeToDeleteRow'
import {
  AddRowButton,
  buildRowActions,
  countErrorsForPrefix,
  ErrorBadge,
  ErrorMapContext,
  GlassView,
  liquidGlassAvailable,
  renderSubFieldsWithWidth,
  RowActionsMenu,
  SubFieldRows,
  usePalette,
  useCompactFields,
  useRenderField,
  withErrorSuffix,
} from '../common'
import { BlockPickerSheet } from './components/BlockPickerSheet'
import type { BlockItem } from './types'
import { blockLabelFor, cloneBlock } from './utils'
import { styles } from './styles'

// ---------------------------------------------------------------------------
// BlocksField
// ---------------------------------------------------------------------------

export const BlocksField: React.FC<FieldComponentProps<ClientBlocksField>> = ({
  field, value, onChange, path, disabled, error,
}) => {
  const renderField = useRenderField()
  const compact = useCompactFields()
  const insideNativeForm = useIsInsideNativeForm()
  const palette = usePalette()
  const errors = useContext(ErrorMapContext)
  const NativeSection = nativeComponents.Section

  const items = Array.isArray(value) ? (value as BlockItem[]) : []
  const blocks = field.blocks ?? []

  const defaultExpanded = !(field.admin?.initCollapsed ?? false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [expandedRows, setExpandedRows] = useState<boolean[]>(() => items.map(() => defaultExpanded))
  const [editingNameIndex, setEditingNameIndex] = useState<number | null>(null)
  // Bumped on structural mutations to remount row subtrees (see array.tsx).
  const [generation, setGeneration] = useState(0)

  const isRowExpanded = (i: number) => expandedRows[i] ?? defaultExpanded
  const anyExpanded = items.some((_, i) => isRowExpanded(i))

  const atMax = field.maxRows != null && items.length >= field.maxRows
  const atMin = field.minRows != null && items.length <= field.minRows
  const canRemove = !disabled && !atMin

  const rowErrorCounts = useMemo(
    () => items.map((_, i) => countErrorsForPrefix(errors, `${path}.${i}`)),
    [errors, items, path],
  )

  // ── Mutations ──
  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)

  const addBlock = (slug: string) => {
    if (disabled || atMax) return
    animate()
    const newItems = [...items, { blockType: slug } as BlockItem]
    onChange(newItems)
    setExpandedRows((prev) => { const next = [...prev]; next[newItems.length - 1] = true; return next })
    setPickerVisible(false)
  }

  const removeBlock = (index: number) => {
    if (!canRemove) return
    animate()
    onChange(items.filter((_, i) => i !== index))
    setExpandedRows((prev) => { const next = [...prev]; next.splice(index, 1); return next })
    setEditingNameIndex(null)
    setGeneration((g) => g + 1)
  }

  const moveBlock = (from: number, to: number) => {
    if (disabled || to < 0 || to >= items.length) return
    animate()
    const newItems = [...items]
    const [moved] = newItems.splice(from, 1)
    newItems.splice(to, 0, moved)
    onChange(newItems)
    setExpandedRows((prev) => {
      const next = [...prev]
      const [movedExp] = next.splice(from, 1)
      next.splice(to, 0, movedExp ?? defaultExpanded)
      return next
    })
    setEditingNameIndex(null)
    setGeneration((g) => g + 1)
  }

  const duplicateBlock = (index: number) => {
    if (disabled || atMax) return
    animate()
    const newItems = [...items]
    newItems.splice(index + 1, 0, cloneBlock(items[index]))
    onChange(newItems)
    setExpandedRows((prev) => { const next = [...prev]; next.splice(index + 1, 0, true); return next })
    setEditingNameIndex(null)
    setGeneration((g) => g + 1)
  }

  const updateBlockName = (index: number, name: string) => {
    onChange(items.map((item, i) => (i === index ? { ...item, blockName: name } : item)))
  }

  const toggleRow = (index: number) => {
    animate()
    setExpandedRows((prev) => {
      const next = items.map((_, i) => prev[i] ?? defaultExpanded)
      next[index] = !next[index]
      return next
    })
  }

  const setAllExpanded = (expanded: boolean) => {
    animate()
    setExpandedRows(items.map(() => expanded))
  }

  const actionsForRow = (index: number) =>
    buildRowActions({
      index,
      count: items.length,
      minRows: field.minRows,
      maxRows: field.maxRows,
      onMove: moveBlock,
      onDuplicate: duplicateBlock,
      onRemove: removeBlock,
    })

  const rowTitle = (index: number): string => {
    const item = items[index]
    const block = blocks.find((b) => b.slug === item?.blockType)
    return item?.blockName || `${blockLabelFor(block, item ?? {})} ${String(index + 1).padStart(2, '0')}`
  }

  // ── Block name: small editable text affordance in the block header ──
  const blockNameNode = (index: number, blockLabel: string) => {
    if (editingNameIndex === index) {
      return (
        <TextInput
          value={String(items[index]?.blockName ?? '')}
          onChangeText={(text) => updateBlockName(index, text)}
          onBlur={() => setEditingNameIndex(null)}
          onSubmitEditing={() => setEditingNameIndex(null)}
          placeholder={`${blockLabel} ${String(index + 1).padStart(2, '0')}`}
          placeholderTextColor={palette.textFaint}
          style={[styles.blockNameInput, { color: palette.text }]}
          autoFocus
          returnKeyType="done"
        />
      )
    }
    return (
      <Pressable onPress={() => !disabled && setEditingNameIndex(index)} hitSlop={4}>
        <Text style={[styles.blockName, { color: palette.text }]} numberOfLines={1}>
          {rowTitle(index)}
          {!disabled && <Text style={[styles.blockNameEditHint, { color: palette.textFaint }]}>{'  ✎'}</Text>}
        </Text>
      </Pressable>
    )
  }

  const pickerSheet = (
    <BlockPickerSheet
      visible={pickerVisible}
      onClose={() => setPickerVisible(false)}
      blocks={blocks}
      onSelect={addBlock}
      palette={palette}
    />
  )

  const addButton = !disabled ? (
    <AddRowButton label="Add Block" onPress={() => setPickerVisible(true)} disabled={atMax} />
  ) : null

  // ── Inside a SwiftUI Form: native Section per block ──
  if (insideNativeForm && NativeSection) {
    return (
      <>
        <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
          {getFieldLabel(field)}
          {field.required && <Text style={{ color: t.colors.error }}> *</Text>}
        </Text>
        {error && <Text style={[styles.error, { color: palette.destructive }]}>{error}</Text>}
        {items.map((item, index) => {
          const block = blocks.find((b) => b.slug === item.blockType)
          return (
            <NativeSection
              key={`${path}.${index}`}
              title={withErrorSuffix(rowTitle(index), rowErrorCounts[index] ?? 0)}
            >
              <View key={`g${generation}`}>
                {renderSubFieldsWithWidth(block?.fields ?? [], (sub) => `${path}.${index}.${sub.name ?? ''}`, renderField, `blk-${index}`, compact)}
              </View>
              {canRemove && (
                <Pressable onPress={() => removeBlock(index)}>
                  <Text style={[styles.removeText, { color: palette.destructive }]}>Remove</Text>
                </Pressable>
              )}
            </NativeSection>
          )
        })}
        {addButton}
        {pickerSheet}
      </>
    )
  }

  // ── Header with label, count, collapse-all ──
  const headerActions = items.length > 1 ? (
    <Pressable onPress={() => setAllExpanded(!anyExpanded)} hitSlop={8}>
      <Text style={[styles.headerAction, { color: palette.primary }]}>
        {anyExpanded ? 'Collapse All' : 'Expand All'}
      </Text>
    </Pressable>
  ) : null

  return (
    <View style={styles.container}>
      <View style={styles.blocksHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
            {getFieldLabel(field)}
            {field.required && <Text style={{ color: t.colors.error }}> *</Text>}
          </Text>
          <Text style={[styles.blockCount, { color: palette.textFaint }]}>
            {items.length} {items.length === 1 ? 'block' : 'blocks'}
          </Text>
        </View>
        {headerActions && (
          liquidGlassAvailable && GlassView ? (
            <GlassView style={styles.glassHeaderActions} glassEffectStyle="regular">{headerActions}</GlassView>
          ) : (
            <View style={styles.headerActions}>{headerActions}</View>
          )
        )}
      </View>
      {error && <Text style={[styles.error, { color: palette.destructive }]}>{error}</Text>}

      {/* Each block card wraps in SwipeToDeleteRow: swipe-left reveals Remove
          with a destructive confirm. minRows keeps the gesture but blocks the
          action with an alert; the RowActionsMenu Remove entry stays. */}
      {items.map((item, index) => {
        const block = blocks.find((b) => b.slug === item.blockType)
        const blockLabel = blockLabelFor(block, item)
        const expanded = isRowExpanded(index)
        const blockInner = (
          <>
            <View style={styles.rowHeader}>
              <Pressable style={styles.rowHeaderPress} onPress={() => toggleRow(index)} hitSlop={4}>
                <Text style={[styles.rowChevron, { color: palette.textMuted }]}>{expanded ? '▾' : '▸'}</Text>
                <View style={styles.rowTitleArea}>
                  <Text style={[styles.blockTypeLabel, { color: palette.textMuted }]} numberOfLines={1}>
                    {blockLabel.toUpperCase()}
                  </Text>
                  {blockNameNode(index, blockLabel)}
                </View>
              </Pressable>
              <ErrorBadge count={rowErrorCounts[index] ?? 0} />
              {!disabled && <RowActionsMenu title={rowTitle(index)} actions={actionsForRow(index)} />}
            </View>
            {expanded && (
              <View key={`g${generation}`} style={styles.rowBody}>
                <SubFieldRows>
                  {renderSubFieldsWithWidth(block?.fields ?? [], (sub) => `${path}.${index}.${sub.name ?? ''}`, renderField, `blk-${index}`, compact)}
                </SubFieldRows>
              </View>
            )}
          </>
        )
        const card = liquidGlassAvailable && GlassView ? (
          <GlassView style={[styles.glassRowCard, styles.rowCardInSwipe]} glassEffectStyle="regular">
            {blockInner}
          </GlassView>
        ) : (
          <View
            style={[styles.rowCard, styles.rowCardInSwipe, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
          >
            {blockInner}
          </View>
        )
        return (
          <SwipeToDeleteRow
            key={`${path}.${index}`}
            enabled={!disabled}
            canDelete={!atMin}
            onDeleteBlocked={() =>
              Alert.alert(
                'Cannot Remove',
                `At least ${field.minRows} ${field.minRows === 1 ? 'block is' : 'blocks are'} required.`,
              )
            }
            onDelete={() => removeBlock(index)}
            confirmTitle={`Remove ${rowTitle(index)}?`}
            confirmMessage="This block and its contents will be removed."
            actionLabel="Remove"
            style={styles.rowSwipeWrap}
            actionStyle={styles.rowSwipeAction}
          >
            {card}
          </SwipeToDeleteRow>
        )
      })}

      {addButton}
      {pickerSheet}
    </View>
  )
}
