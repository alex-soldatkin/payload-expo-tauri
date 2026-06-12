/**
 * Array field — two display modes (web parity + mobile-friendly switcher):
 *
 *   1. 'stacked'  (default for ≤5 rows) — every row renders as a collapsible
 *      card, matching Payload web admin's layout. Header offers
 *      Collapse All / Expand All.
 *   2. 'switcher' (default beyond 5 rows) — a segmented control / pill bar
 *      selects which row is being edited; one row's fields show at a time.
 *
 * Per-row actions (Move Up / Move Down / Duplicate / Insert Below / Remove)
 * surface through RowActionsMenu: tap-anchored SwiftUI Menu on iOS, JC
 * ContextMenu on Android, BottomSheet fallback elsewhere. minRows blocks
 * Remove, maxRows disables Add / Duplicate / Insert.
 *
 * Row labels resolve in order:
 *   1. Custom RowLabel component (CustomComponentContext, slot 'RowLabel',
 *      keyed `${collectionSlug}.${arrayFieldPath}` — codegen registry)
 *   2. Static admin.RowLabel string / i18n record
 *   3. First text-ish sub-field value in the row (useAsTitle-ish)
 *   4. `${singularLabel} NN` (zero-padded, Payload web default)
 *
 * INTERNAL — import via the `fields/structural` barrel only.
 */
import React, { useContext, useMemo, useState } from 'react'
import { Alert, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native'

import type { ClientArrayField, ClientField, ComponentSlot, FieldComponentProps } from '../../types'
import { CONTENT_INSET, defaultTheme as t, ROW_MIN_HEIGHT } from '../../theme'
import { getFieldLabel } from '../../utils/schemaHelpers'
import { nativeComponents, useIsInsideNativeForm } from '../shared'
import { SwipeToDeleteRow } from '../../SwipeToDeleteRow'
import { useCustomComponent } from '../../contexts/CustomComponentContext'
import { useFormData } from '../../contexts/FormDataContext'
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
  RowLabelContext,
  SegmentedIndexPicker,
  SubFieldRows,
  usePalette,
  useCompactFields,
  useRenderField,
} from './common'

/** Above this many rows, the switcher mode becomes the default. */
const STACKED_DEFAULT_MAX = 5

/** Sub-field types whose string values can serve as a derived row title. */
const TITLE_FIELD_TYPES = new Set(['text', 'email', 'textarea'])

/** Derive a row title from the first text-ish sub-field with a value. */
const deriveRowTitle = (
  row: Record<string, unknown> | undefined,
  subFields: ClientField[],
): string | null => {
  if (!row) return null
  for (const sub of subFields) {
    if (!sub.name || !TITLE_FIELD_TYPES.has(sub.type)) continue
    const v = row[sub.name]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

/** Deep-clone a row for Duplicate, stripping the row `id` (server treats it as new). */
const cloneRow = (row: Record<string, unknown>): Record<string, unknown> => {
  try {
    const cloned = JSON.parse(JSON.stringify(row ?? {})) as Record<string, unknown>
    delete cloned.id
    return cloned
  } catch {
    const { id: _id, ...rest } = row ?? {}
    return { ...rest }
  }
}

export const ArrayField: React.FC<FieldComponentProps<ClientArrayField>> = ({
  field, value, onChange, path, disabled, error,
}) => {
  const renderField = useRenderField()
  const compact = useCompactFields()
  const insideNativeForm = useIsInsideNativeForm()
  const palette = usePalette()
  const errors = useContext(ErrorMapContext)
  const NativeSection = nativeComponents.Section

  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : []
  const subFields = field.fields ?? []

  // Labels — Payload defaults: singular = "Row", plural = field label
  const fieldLabel = getFieldLabel(field)
  const singularLabel = field.labels?.singular || 'Row'
  const pluralLabel = field.labels?.plural || fieldLabel

  // Custom RowLabel component (codegen registry; one component per array field)
  const formCtx = useFormData()
  const RowLabelComp = useCustomComponent(formCtx?.slug, path, 'RowLabel' as ComponentSlot)
  const staticRowLabel = resolveI18nText(field.admin?.RowLabel, '')

  // ── Display state ──
  const defaultExpanded = !(field.admin?.initCollapsed ?? false)
  const [mode, setMode] = useState<'stacked' | 'switcher'>(() =>
    items.length > STACKED_DEFAULT_MAX ? 'switcher' : 'stacked')
  const [activeIndex, setActiveIndex] = useState(0)
  const [expandedRows, setExpandedRows] = useState<boolean[]>(() => items.map(() => defaultExpanded))
  // Bumped on structural mutations (move/duplicate/insert/remove) to remount
  // row subtrees — uncontrolled native text fields would otherwise show stale
  // values for shifted index paths.
  const [generation, setGeneration] = useState(0)

  const safeIndex = Math.min(activeIndex, Math.max(0, items.length - 1))
  const isRowExpanded = (i: number) => expandedRows[i] ?? defaultExpanded
  const anyExpanded = items.some((_, i) => isRowExpanded(i))

  const atMax = field.maxRows != null && items.length >= field.maxRows
  const atMin = field.minRows != null && items.length <= field.minRows
  const canRemove = !disabled && !atMin

  const rowErrorCounts = useMemo(
    () => items.map((_, i) => countErrorsForPrefix(errors, `${path}.${i}`)),
    [errors, items, path],
  )

  // ── Row titles ──
  const rowTitle = (index: number): string => {
    if (staticRowLabel) return staticRowLabel
    return (
      deriveRowTitle(items[index], subFields) ||
      `${singularLabel} ${String(index + 1).padStart(2, '0')}`
    )
  }

  const rowLabelNode = (index: number): React.ReactNode => {
    if (RowLabelComp) {
      const rowCtx = {
        data: items[index] ?? {},
        rowNumber: index + 1,
        index,
        path: `${path}.${index}`,
      }
      return (
        <RowLabelContext.Provider value={rowCtx}>
          <View style={styles.rowLabelCustom}>
            <RowLabelComp data={rowCtx.data} index={index} rowNumber={index + 1} path={rowCtx.path} />
          </View>
        </RowLabelContext.Provider>
      )
    }
    return (
      <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
        {rowTitle(index)}
      </Text>
    )
  }

  // ── Mutations ──
  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)

  const addRow = () => {
    if (disabled || atMax) return
    animate()
    const newItems = [...items, {}]
    onChange(newItems)
    setExpandedRows((prev) => { const next = [...prev]; next[newItems.length - 1] = true; return next })
    setActiveIndex(newItems.length - 1)
  }

  const removeRow = (index: number) => {
    if (!canRemove) return
    animate()
    const newItems = items.filter((_, i) => i !== index)
    onChange(newItems)
    setExpandedRows((prev) => { const next = [...prev]; next.splice(index, 1); return next })
    if (safeIndex >= newItems.length) setActiveIndex(Math.max(0, newItems.length - 1))
    setGeneration((g) => g + 1)
  }

  const moveRow = (from: number, to: number) => {
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
    if (safeIndex === from) setActiveIndex(to)
    setGeneration((g) => g + 1)
  }

  const insertRowAt = (index: number, row: Record<string, unknown>) => {
    if (disabled || atMax) return
    animate()
    const newItems = [...items]
    newItems.splice(index, 0, row)
    onChange(newItems)
    setExpandedRows((prev) => { const next = [...prev]; next.splice(index, 0, true); return next })
    setActiveIndex(index)
    setGeneration((g) => g + 1)
  }

  const duplicateRow = (index: number) => insertRowAt(index + 1, cloneRow(items[index]))
  const insertBelow = (index: number) => insertRowAt(index + 1, {})

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

  const toggleMode = () => {
    animate()
    setMode((m) => (m === 'stacked' ? 'switcher' : 'stacked'))
  }

  const actionsForRow = (index: number) =>
    buildRowActions({
      index,
      count: items.length,
      minRows: field.minRows,
      maxRows: field.maxRows,
      onMove: moveRow,
      onDuplicate: duplicateRow,
      onInsertBelow: insertBelow,
      onRemove: removeRow,
    })

  // ── Header with label, count, collapse-all and mode toggle ──
  const headerActions = (
    <>
      {mode === 'stacked' && items.length > 1 && (
        <Pressable onPress={() => setAllExpanded(!anyExpanded)} hitSlop={8}>
          <Text style={[styles.headerAction, { color: palette.primary }]}>
            {anyExpanded ? 'Collapse All' : 'Expand All'}
          </Text>
        </Pressable>
      )}
      {items.length > 1 && (
        <Pressable onPress={toggleMode} hitSlop={8}>
          <Text style={[styles.modeToggle, { color: palette.textMuted }]}>{mode === 'stacked' ? '▤' : '☰'}</Text>
        </Pressable>
      )}
    </>
  )

  const header = (
    <View style={styles.arrayHeader}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
          {pluralLabel}
          {field.required && <Text style={{ color: t.colors.error }}> *</Text>}
        </Text>
        <Text style={[styles.arrayCount, { color: palette.textFaint }]}>
          {items.length} {items.length === 1 ? singularLabel.toLowerCase() : pluralLabel.toLowerCase()}
        </Text>
      </View>
      {liquidGlassAvailable && GlassView ? (
        <GlassView style={styles.glassHeaderActions} glassEffectStyle="regular">{headerActions}</GlassView>
      ) : (
        <View style={styles.headerActions}>{headerActions}</View>
      )}
    </View>
  )

  // ── Add button (disabled at maxRows) ──
  const addButton = !disabled ? (
    <AddRowButton label={`Add ${singularLabel}`} onPress={addRow} disabled={atMax} />
  ) : null

  // ── Inside a SwiftUI Form: native Section per row ──
  if (insideNativeForm && NativeSection) {
    return (
      <>
        <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>
          {pluralLabel}
          {field.required && <Text style={{ color: t.colors.error }}> *</Text>}
        </Text>
        {error && <Text style={[styles.error, { color: palette.destructive }]}>{error}</Text>}
        {items.map((_, index) => (
          <NativeSection
            key={`${path}.${index}`}
            title={rowTitle(index)}
            isExpanded={isRowExpanded(index)}
            onIsExpandedChange={(expanded) => {
              setExpandedRows((prev) => {
                const next = items.map((__, i) => prev[i] ?? defaultExpanded)
                next[index] = expanded
                return next
              })
            }}
          >
            <View key={`g${generation}`}>
              {renderSubFieldsWithWidth(subFields, (sub) => `${path}.${index}.${sub.name ?? ''}`, renderField, `arr-${index}`, compact)}
            </View>
            {canRemove && (
              <Pressable onPress={() => removeRow(index)}>
                <Text style={[styles.removeText, { color: palette.destructive }]}>Remove</Text>
              </Pressable>
            )}
          </NativeSection>
        ))}
        {addButton}
      </>
    )
  }

  // ── Switcher mode: segmented control selects the row being edited ──
  const switcherContent = (
    <>
      {items.length > 1 && (
        <SegmentedIndexPicker
          labels={items.map((_, i) => `${singularLabel} ${i + 1}`)}
          selectedIndex={safeIndex}
          onSelect={setActiveIndex}
          errorCounts={rowErrorCounts}
        />
      )}
      {items.length > 0 && (
        <>
          <View style={styles.switcherToolbar}>
            <View style={styles.switcherTitle}>{rowLabelNode(safeIndex)}</View>
            <ErrorBadge count={rowErrorCounts[safeIndex] ?? 0} />
            {!disabled && <RowActionsMenu title={rowTitle(safeIndex)} actions={actionsForRow(safeIndex)} />}
          </View>
          <View key={`g${generation}-${safeIndex}`}>
            {renderSubFieldsWithWidth(subFields, (sub) => `${path}.${safeIndex}.${sub.name ?? ''}`, renderField, `arr-${safeIndex}`, compact)}
          </View>
        </>
      )}
    </>
  )

  // ── Stacked mode: every row is a collapsible card (web parity) ──
  // Each card wraps in SwipeToDeleteRow: swipe-left reveals Remove with a
  // destructive confirm. minRows keeps the gesture but blocks the action
  // with an alert; the RowActionsMenu Remove entry stays alongside.
  const stackedContent = items.map((_, index) => {
    const expanded = isRowExpanded(index)
    const rowInner = (
      <>
        <View style={styles.rowHeader}>
          <Pressable style={styles.rowHeaderPress} onPress={() => toggleRow(index)} hitSlop={4}>
            <Text style={[styles.rowChevron, { color: palette.textMuted }]}>{expanded ? '▾' : '▸'}</Text>
            {rowLabelNode(index)}
          </Pressable>
          <ErrorBadge count={rowErrorCounts[index] ?? 0} />
          {!disabled && <RowActionsMenu title={rowTitle(index)} actions={actionsForRow(index)} />}
        </View>
        {expanded && (
          <View key={`g${generation}`} style={styles.rowBody}>
            <SubFieldRows>
              {renderSubFieldsWithWidth(subFields, (sub) => `${path}.${index}.${sub.name ?? ''}`, renderField, `arr-${index}`, compact)}
            </SubFieldRows>
          </View>
        )}
      </>
    )
    const card = liquidGlassAvailable && GlassView ? (
      <GlassView style={[styles.glassRowCard, styles.rowCardInSwipe]} glassEffectStyle="regular">
        {rowInner}
      </GlassView>
    ) : (
      <View
        style={[styles.rowCard, styles.rowCardInSwipe, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
      >
        {rowInner}
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
            `At least ${field.minRows} ${field.minRows === 1 ? singularLabel.toLowerCase() : pluralLabel.toLowerCase()} ${field.minRows === 1 ? 'is' : 'are'} required.`,
          )
        }
        onDelete={() => removeRow(index)}
        confirmTitle={`Remove ${rowTitle(index)}?`}
        confirmMessage="This row and its contents will be removed."
        actionLabel="Remove"
        style={styles.rowSwipeWrap}
        actionStyle={styles.rowSwipeAction}
      >
        {card}
      </SwipeToDeleteRow>
    )
  })

  return (
    <View style={styles.container}>
      {header}
      {error && <Text style={[styles.error, { color: palette.destructive }]}>{error}</Text>}
      {mode === 'switcher' ? switcherContent : stackedContent}
      {addButton}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: t.spacing.xs },
  // Colour injected at render (palette.destructive) — dark-mode aware.
  error: { fontSize: 12, marginTop: 2 },

  // Field header
  arrayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginTop: t.spacing.sm,
    gap: t.spacing.sm,
  },
  // Section-header style (matches FormSection title chrome) — the array is a
  // sub-section: header above the row cards at the grid the section provides.
  fieldLabel: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  arrayCount: { fontSize: 12, marginTop: 1 },
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
  modeToggle: { fontSize: 18, paddingHorizontal: 2 },

  // Stacked row cards — the card keeps its glass/border tier but owns NO
  // horizontal padding: the header row and SubFieldRows rows carry the
  // canonical CONTENT_INSET so inner separators inset like FormSection's.
  rowCard: {
    borderRadius: t.borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 2,
    marginBottom: t.spacing.xs,
  },
  glassRowCard: {
    borderRadius: t.borderRadius.md,
    paddingVertical: 2,
    marginBottom: t.spacing.xs,
    overflow: 'hidden',
  },
  // Swipe wrapper owns the row margin so the revealed action layer aligns
  // flush with the card (a bottom margin inside the wrapper would leak red).
  rowSwipeWrap: { marginBottom: t.spacing.xs },
  rowCardInSwipe: { marginBottom: 0 },
  rowSwipeAction: { borderRadius: t.borderRadius.md },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_MIN_HEIGHT,
    gap: t.spacing.xs,
    paddingHorizontal: CONTENT_INSET,
  },
  rowHeaderPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
  rowChevron: { fontSize: 13, width: 14, textAlign: 'center' },
  rowTitle: { fontSize: t.fontSize.md, fontWeight: '500', flexShrink: 1 },
  rowLabelCustom: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowBody: { paddingBottom: t.spacing.sm },

  // Switcher mode
  switcherToolbar: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, marginBottom: 2, minHeight: ROW_MIN_HEIGHT },
  switcherTitle: { flex: 1, flexDirection: 'row', alignItems: 'center' },

  removeText: { fontSize: t.fontSize.sm },
})
