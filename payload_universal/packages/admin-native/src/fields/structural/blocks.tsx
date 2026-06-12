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
import React, { useContext, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Image as RNImage,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import type { ClientBlocksField, FieldComponentProps } from '../../types'
import { defaultTheme as t } from '../../theme'
import { getFieldLabel } from '../../utils/schemaHelpers'
import { nativeComponents, useIsInsideNativeForm } from '../shared'
import { BottomSheet } from '../../BottomSheet'
import { SwipeToDeleteRow } from '../../SwipeToDeleteRow'
import {
  AddRowButton,
  buildRowActions,
  countErrorsForPrefix,
  ErrorBadge,
  ErrorMapContext,
  GlassView,
  liquidGlassAvailable,
  renderSubFieldsWithWidth,
  resolveI18nText,
  RowActionsMenu,
  usePalette,
  useCompactFields,
  useRenderField,
  withErrorSuffix,
  type StructuralPalette,
} from './common'

type BlockConfig = NonNullable<ClientBlocksField['blocks']>[number]
type BlockItem = Record<string, unknown> & { blockType?: string; blockName?: string }

const blockLabelFor = (block: BlockConfig | undefined, item: BlockItem): string =>
  block?.labels?.singular || item.blockType || 'Block'

/** Group key for the picker — Payload block configs may carry admin.group. */
const blockGroupFor = (block: BlockConfig): string => {
  const raw = (block as any)?.admin?.group ?? (block as any)?.group
  return resolveI18nText(raw, '')
}

/** Deep-clone a block row for Duplicate, stripping the row `id`. */
const cloneBlock = (row: BlockItem): BlockItem => {
  try {
    const cloned = JSON.parse(JSON.stringify(row ?? {})) as BlockItem
    delete (cloned as Record<string, unknown>).id
    return cloned
  } catch {
    const { id: _id, ...rest } = row ?? {}
    return { ...rest }
  }
}

// ---------------------------------------------------------------------------
// Block picker — searchable, grouped list in the package BottomSheet
// ---------------------------------------------------------------------------

const BlockPickerSheet: React.FC<{
  visible: boolean
  onClose: () => void
  blocks: BlockConfig[]
  onSelect: (slug: string) => void
  palette: StructuralPalette
}> = ({ visible, onClose, blocks, onSelect, palette }) => {
  const [query, setQuery] = useState('')

  // Clear the search when the sheet closes so it reopens fresh.
  useEffect(() => {
    if (!visible) setQuery('')
  }, [visible])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = blocks.filter((block) => {
      if (!q) return true
      const label = (block.labels?.singular || block.slug).toLowerCase()
      const desc = resolveI18nText(block.description, '').toLowerCase()
      return label.includes(q) || block.slug.toLowerCase().includes(q) || desc.includes(q)
    })
    const map = new Map<string, BlockConfig[]>()
    for (const block of filtered) {
      const group = blockGroupFor(block)
      const list = map.get(group) ?? []
      list.push(block)
      map.set(group, list)
    }
    return [...map.entries()]
  }, [blocks, query])

  const showGroupHeaders = groups.length > 1 || (groups.length === 1 && groups[0][0] !== '')

  return (
    <BottomSheet visible={visible} onClose={onClose} height={0.6}>
      <Text style={[styles.pickerTitle, { color: palette.text }]}>Add Block</Text>
      <View style={[styles.searchBox, { backgroundColor: palette.inputBg }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search blocks"
          placeholderTextColor={palette.textFaint}
          style={[styles.searchInput, { color: palette.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {groups.length === 0 && (
          <Text style={[styles.pickerEmpty, { color: palette.textFaint }]}>
            No blocks match “{query.trim()}”
          </Text>
        )}
        {groups.map(([group, groupBlocks]) => (
          <View key={group || '_ungrouped'}>
            {showGroupHeaders && (
              <Text style={[styles.pickerGroup, { color: palette.textMuted }]}>
                {group || 'Blocks'}
              </Text>
            )}
            {groupBlocks.map((block) => {
              const label = block.labels?.singular || block.slug
              const description = resolveI18nText(block.description, '')
              return (
                <Pressable
                  key={block.slug}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    { borderBottomColor: palette.separator },
                    pressed && { backgroundColor: palette.cardBg },
                  ]}
                  onPress={() => onSelect(block.slug)}
                >
                  {block.imageURL ? (
                    <RNImage
                      source={{ uri: block.imageURL }}
                      style={styles.pickerThumb}
                      accessibilityLabel={block.imageAltText || label}
                    />
                  ) : (
                    <View style={[styles.pickerThumb, styles.pickerThumbFallback, { backgroundColor: palette.inputBg }]}>
                      <Text style={[styles.pickerThumbLetter, { color: palette.textMuted }]}>
                        {label.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.pickerRowText}>
                    <Text style={[styles.pickerRowLabel, { color: palette.text }]}>{label}</Text>
                    {!!description && (
                      <Text style={[styles.pickerRowDesc, { color: palette.textFaint }]} numberOfLines={2}>
                        {description}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.pickerRowPlus, { color: palette.primary }]}>+</Text>
                </Pressable>
              )
            })}
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  )
}

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
          style={[styles.blockNameInput, { color: palette.text, borderBottomColor: palette.separator }]}
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
        {error && <Text style={styles.error}>{error}</Text>}
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
      {error && <Text style={styles.error}>{error}</Text>}

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
                {renderSubFieldsWithWidth(block?.fields ?? [], (sub) => `${path}.${index}.${sub.name ?? ''}`, renderField, `blk-${index}`, compact)}
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

const styles = StyleSheet.create({
  container: { marginBottom: t.spacing.xs },
  error: { fontSize: 12, color: t.colors.error, marginTop: 2 },

  // Field header
  blocksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: t.spacing.sm,
    gap: t.spacing.sm,
  },
  fieldLabel: { fontSize: t.fontSize.sm, fontWeight: '600' },
  blockCount: { fontSize: 12, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  glassHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    paddingHorizontal: t.spacing.md,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  headerAction: { fontSize: t.fontSize.sm, fontWeight: '500' },

  // Block row cards
  rowCard: {
    borderRadius: t.borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 2,
    marginBottom: t.spacing.xs,
  },
  glassRowCard: {
    borderRadius: t.borderRadius.md,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 2,
    marginBottom: t.spacing.xs,
    overflow: 'hidden',
  },
  // Swipe wrapper owns the row margin so the revealed action layer aligns
  // flush with the card (a bottom margin inside the wrapper would leak red).
  rowSwipeWrap: { marginBottom: t.spacing.xs },
  rowCardInSwipe: { marginBottom: 0 },
  rowSwipeAction: { borderRadius: t.borderRadius.md },
  rowHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: t.spacing.xs },
  rowHeaderPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  rowChevron: { fontSize: 13, width: 14, textAlign: 'center' },
  rowTitleArea: { flex: 1 },
  blockTypeLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  blockName: { fontSize: t.fontSize.md, fontWeight: '500', marginTop: 1 },
  blockNameEditHint: { fontSize: 11, fontWeight: '400' },
  blockNameInput: {
    fontSize: t.fontSize.md,
    fontWeight: '500',
    paddingVertical: 2,
    paddingHorizontal: 0,
    marginTop: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { paddingBottom: t.spacing.sm },
  removeText: { fontSize: t.fontSize.sm },

  // Block picker sheet
  pickerTitle: { fontSize: t.fontSize.lg, fontWeight: '700', marginBottom: t.spacing.sm },
  searchBox: {
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.sm,
    marginBottom: t.spacing.sm,
  },
  searchInput: { fontSize: t.fontSize.md, paddingVertical: 8 },
  pickerEmpty: { fontSize: t.fontSize.sm, textAlign: 'center', paddingVertical: t.spacing.xl },
  pickerGroup: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: t.spacing.sm,
    marginBottom: 2,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: t.borderRadius.sm,
  },
  pickerThumb: { width: 40, height: 40, borderRadius: t.borderRadius.sm },
  pickerThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  pickerThumbLetter: { fontSize: t.fontSize.lg, fontWeight: '600' },
  pickerRowText: { flex: 1 },
  pickerRowLabel: { fontSize: t.fontSize.md, fontWeight: '500' },
  pickerRowDesc: { fontSize: 12, marginTop: 1 },
  pickerRowPlus: { fontSize: 20, fontWeight: '500', paddingHorizontal: 4 },
})
