/**
 * Structural (layout) fields: array, blocks, group, collapsible, row, tabs.
 * These contain sub-fields and use the FieldRendererContext to render them.
 *
 * Mobile translations:
 *   - Group (named)   → Card section with title, optional left gutter border
 *   - Group (unnamed) → Fields render inline into parent (no wrapper)
 *   - Collapsible     → Animated accordion with chevron + initCollapsed support
 *   - Row             → Horizontal flex layout
 *   - Tabs            → Segmented control / tab bar
 *   - Array           → Cards with add/remove
 *   - Blocks          → Typed cards with block picker
 */
import React, { createContext, useContext, useMemo, useRef, useState } from 'react'
import { Animated, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native'

import type {
  ClientArrayField,
  ClientBlocksField,
  ClientCollapsibleField,
  ClientField,
  ClientGroupField,
  ClientRowField,
  ClientTabsField,
  FieldComponentProps,
  FormErrors,
} from '../types'
import { defaultTheme as t } from '../theme'
import { getFieldDescription, getFieldLabel } from '../schemaHelpers'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// ---------------------------------------------------------------------------
// Context for recursive field rendering
// ---------------------------------------------------------------------------

type RenderFieldFn = (field: ClientField, basePath: string) => React.ReactNode

export const FieldRendererContext = createContext<RenderFieldFn | null>(null)

const useRenderField = (): RenderFieldFn => {
  const fn = useContext(FieldRendererContext)
  if (!fn) throw new Error('FieldRendererContext is required for structural fields')
  return fn
}

// ---------------------------------------------------------------------------
// Error map context – shared by DocumentForm so structural fields can count
// child errors (e.g. tab badges, collapsible error dots)
// ---------------------------------------------------------------------------

export const ErrorMapContext = createContext<FormErrors>({})

/** Count errors whose path starts with a given prefix. */
const useErrorCountForPrefix = (prefix: string): number => {
  const errors = useContext(ErrorMapContext)
  return useMemo(() => {
    let count = 0
    for (const path in errors) {
      if (errors[path] && (path === prefix || path.startsWith(prefix + '.'))) {
        count++
      }
    }
    return count
  }, [errors, prefix])
}

/** Count errors for a set of fields under a base path. */
const useErrorCountForFields = (fields: ClientField[], basePath: string): number => {
  const errors = useContext(ErrorMapContext)
  return useMemo(() => {
    let count = 0
    for (const field of fields) {
      const fieldPath = field.name ? (basePath ? `${basePath}.${field.name}` : field.name) : basePath
      for (const path in errors) {
        if (errors[path] && (path === fieldPath || path.startsWith(fieldPath + '.'))) {
          count++
        }
      }
    }
    return count
  }, [errors, fields, basePath])
}

// ---------------------------------------------------------------------------
// Group
//
// Named groups: card with title + description + optional left gutter
// Unnamed groups: fields render inline (no visual wrapper)
// ---------------------------------------------------------------------------

export const GroupField: React.FC<FieldComponentProps<ClientGroupField>> = ({
  field,
  path,
}) => {
  const renderField = useRenderField()
  const subFields = field.fields ?? []
  const isNamed = Boolean(field.name)
  const hideGutter = field.admin?.hideGutter ?? false
  const description = getFieldDescription(field)

  // Unnamed group → render children inline
  if (!isNamed) {
    return (
      <>
        {subFields.map((sub, i) => (
          <React.Fragment key={sub.name || `group-${i}`}>
            {renderField(sub, `${path ? path + '.' : ''}${sub.name ?? ''}`)}
          </React.Fragment>
        ))}
      </>
    )
  }

  // Named group → card section
  return (
    <View style={[styles.groupCard, !hideGutter && styles.groupGutter]}>
      {field.label && (
        <View style={styles.groupHeader}>
          <Text style={styles.groupLabel}>{getFieldLabel(field)}</Text>
          {description && <Text style={styles.groupDescription}>{description}</Text>}
        </View>
      )}
      <View style={styles.groupBody}>
        {subFields.map((sub, i) => (
          <React.Fragment key={sub.name || `group-${i}`}>
            {renderField(sub, `${path}.${sub.name ?? ''}`)}
          </React.Fragment>
        ))}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Collapsible
//
// Animated accordion with:
//   - Chevron rotation indicator
//   - initCollapsed support
//   - Description text
//   - Spring animation via LayoutAnimation
// ---------------------------------------------------------------------------

export const CollapsibleField: React.FC<FieldComponentProps<ClientCollapsibleField>> = ({
  field,
  path,
}) => {
  const renderField = useRenderField()
  const initCollapsed = field.admin?.initCollapsed ?? false
  const [expanded, setExpanded] = useState(!initCollapsed)
  const subFields = field.fields ?? []
  const description = getFieldDescription(field)
  const childErrorCount = useErrorCountForFields(subFields, path)

  const chevronRotation = useRef(new Animated.Value(expanded ? 1 : 0)).current

  const toggle = () => {
    const next = !expanded
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded(next)
    Animated.spring(chevronRotation, {
      toValue: next ? 1 : 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 200,
    }).start()
  }

  const rotation = chevronRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  })

  return (
    <View style={styles.collapsibleContainer}>
      <Pressable style={styles.collapsibleHeader} onPress={toggle}>
        <Animated.Text style={[styles.collapsibleChevron, { transform: [{ rotate: rotation }] }]}>
          ›
        </Animated.Text>
        <View style={styles.collapsibleHeaderContent}>
          <Text style={styles.collapsibleTitle}>{getFieldLabel(field)}</Text>
          {!expanded && description && (
            <Text style={styles.collapsibleHint} numberOfLines={1}>{description}</Text>
          )}
        </View>
        {childErrorCount > 0 && (
          <View style={styles.collapsibleErrorBadge}>
            <Text style={styles.collapsibleErrorBadgeText}>{childErrorCount}</Text>
          </View>
        )}
      </Pressable>

      {expanded && (
        <View style={styles.collapsibleBody}>
          {description && <Text style={styles.groupDescription}>{description}</Text>}
          {subFields.map((sub, i) => (
            <React.Fragment key={sub.name || `col-${i}`}>
              {renderField(sub, `${path ? path + '.' : ''}${sub.name ?? ''}`)}
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Row (horizontal layout – fields don't nest data)
// ---------------------------------------------------------------------------

export const RowField: React.FC<FieldComponentProps<ClientRowField>> = ({
  field,
  path,
}) => {
  const renderField = useRenderField()
  const subFields = field.fields ?? []

  return (
    <View style={styles.rowContainer}>
      {subFields.map((sub, i) => (
        <View key={sub.name || `row-${i}`} style={[styles.rowItem, sub.admin?.width ? { flex: parseFloat(sub.admin.width) / 100 } : { flex: 1 }]}>
          {renderField(sub, `${path ? path + '.' : ''}${sub.name ?? ''}`)}
        </View>
      ))}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Tabs → Segmented control with scrollable tab bar
// ---------------------------------------------------------------------------

export const TabsField: React.FC<FieldComponentProps<ClientTabsField>> = ({
  field,
  path,
}) => {
  const renderField = useRenderField()
  const errors = useContext(ErrorMapContext)
  const tabs = field.tabs ?? []
  const [activeIndex, setActiveIndex] = useState(0)
  const activeTab = tabs[activeIndex]

  // Count errors per tab
  const tabErrorCounts = useMemo(() =>
    tabs.map((tab) => {
      const tabFields = tab.fields ?? []
      let count = 0
      for (const sub of tabFields) {
        const fieldPath = tab.name
          ? `${path ? path + '.' : ''}${tab.name}.${sub.name ?? ''}`
          : `${path ? path + '.' : ''}${sub.name ?? ''}`
        for (const errPath in errors) {
          if (errors[errPath] && (errPath === fieldPath || errPath.startsWith(fieldPath + '.'))) {
            count++
          }
        }
      }
      return count
    }),
    [tabs, path, errors],
  )

  return (
    <View style={styles.tabsContainer}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab, i) => {
          const label = tab.label
            ? (typeof tab.label === 'string' ? tab.label : tab.label.en || Object.values(tab.label)[0] || `Tab ${i + 1}`)
            : tab.name || `Tab ${i + 1}`
          const errorCount = tabErrorCounts[i] ?? 0
          return (
            <Pressable
              key={tab.name || `tab-${i}`}
              style={[styles.tab, i === activeIndex && styles.tabActive]}
              onPress={() => setActiveIndex(i)}
            >
              <View style={styles.tabLabelRow}>
                <Text style={[
                  styles.tabText,
                  i === activeIndex && styles.tabTextActive,
                  errorCount > 0 && styles.tabTextError,
                ]}>
                  {label}
                </Text>
                {errorCount > 0 && (
                  <View style={styles.tabErrorBadge}>
                    <Text style={styles.tabErrorBadgeText}>{errorCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )
        })}
      </View>

      {/* Active tab content */}
      {activeTab && (
        <View style={styles.tabContent}>
          {(activeTab.fields ?? []).map((sub, i) => {
            const basePath = activeTab.name
              ? `${path ? path + '.' : ''}${activeTab.name}.${sub.name ?? ''}`
              : `${path ? path + '.' : ''}${sub.name ?? ''}`
            return (
              <React.Fragment key={sub.name || `tabfield-${i}`}>
                {renderField(sub, basePath)}
              </React.Fragment>
            )
          })}
        </View>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Array → List with add / remove / reorder
// ---------------------------------------------------------------------------

export const ArrayField: React.FC<FieldComponentProps<ClientArrayField>> = ({
  field,
  value,
  onChange,
  path,
  disabled,
  error,
}) => {
  const renderField = useRenderField()
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : []
  const subFields = field.fields ?? []
  const singularLabel = field.labels?.singular || getFieldLabel(field)

  const addRow = () => {
    if (field.maxRows != null && items.length >= field.maxRows) return
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onChange([...items, {}])
  }

  const removeRow = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <View style={styles.container}>
      <View style={styles.arrayHeader}>
        <Text style={styles.groupLabel}>
          {getFieldLabel(field)}
          {field.required && <Text style={styles.required}> *</Text>}
        </Text>
        <Text style={styles.arrayCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}

      {items.map((_, index) => (
        <View key={`${path}.${index}`} style={styles.arrayRow}>
          <View style={styles.arrayRowHeader}>
            <Text style={styles.arrayRowTitle}>{singularLabel} {index + 1}</Text>
            {!disabled && (
              <Pressable onPress={() => removeRow(index)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            )}
          </View>
          {subFields.map((sub, fi) => (
            <React.Fragment key={sub.name || `arr-${fi}`}>
              {renderField(sub, `${path}.${index}.${sub.name ?? ''}`)}
            </React.Fragment>
          ))}
        </View>
      ))}

      {!disabled && (field.maxRows == null || items.length < field.maxRows) && (
        <Pressable style={styles.addBtn} onPress={addRow}>
          <Text style={styles.addText}>+ Add {singularLabel}</Text>
        </Pressable>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Blocks → Typed array (each item has a blockType)
// ---------------------------------------------------------------------------

export const BlocksField: React.FC<FieldComponentProps<ClientBlocksField>> = ({
  field,
  value,
  onChange,
  path,
  disabled,
  error,
}) => {
  const renderField = useRenderField()
  const items = Array.isArray(value) ? (value as Array<Record<string, unknown> & { blockType?: string }>) : []
  const blocks = field.blocks ?? []
  const [showPicker, setShowPicker] = useState(false)

  const addBlock = (blockSlug: string) => {
    if (field.maxRows != null && items.length >= field.maxRows) return
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onChange([...items, { blockType: blockSlug }])
    setShowPicker(false)
  }

  const removeBlock = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <View style={styles.container}>
      <Text style={styles.groupLabel}>
        {getFieldLabel(field)}
        {field.required && <Text style={styles.required}> *</Text>}
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}

      {items.map((item, index) => {
        const block = blocks.find((b) => b.slug === item.blockType)
        const blockLabel = block?.labels?.singular || item.blockType || 'Block'
        const blockFields = block?.fields ?? []

        return (
          <View key={`${path}.${index}`} style={styles.blockRow}>
            <View style={styles.arrayRowHeader}>
              <Text style={styles.blockTypeLabel}>{blockLabel}</Text>
              {!disabled && (
                <Pressable onPress={() => removeBlock(index)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              )}
            </View>
            {blockFields.map((sub, fi) => (
              <React.Fragment key={sub.name || `blk-${fi}`}>
                {renderField(sub, `${path}.${index}.${sub.name ?? ''}`)}
              </React.Fragment>
            ))}
          </View>
        )
      })}

      {!disabled && (field.maxRows == null || items.length < field.maxRows) && (
        <>
          <Pressable style={styles.addBtn} onPress={() => setShowPicker(true)}>
            <Text style={styles.addText}>+ Add block</Text>
          </Pressable>
          {showPicker && (
            <View style={styles.blockPicker}>
              {blocks.map((block) => (
                <Pressable
                  key={block.slug}
                  style={styles.blockPickerItem}
                  onPress={() => addBlock(block.slug)}
                >
                  <Text style={styles.blockPickerText}>
                    {block.labels?.singular || block.slug}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { marginBottom: t.spacing.lg },
  required: { color: t.colors.error },
  error: { fontSize: t.fontSize.xs, color: t.colors.error, marginTop: t.spacing.xs },

  // Group — named: card section
  groupCard: {
    marginBottom: t.spacing.lg,
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    overflow: 'hidden',
  },
  groupGutter: {
    borderLeftWidth: 3,
    borderLeftColor: t.colors.primary,
  },
  groupHeader: {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
    backgroundColor: '#fafafa',
  },
  groupLabel: { fontSize: t.fontSize.md, fontWeight: '700', color: t.colors.text },
  groupDescription: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    marginTop: 2,
    marginBottom: t.spacing.sm,
  },
  groupBody: {
    padding: t.spacing.lg,
  },

  // Collapsible — animated accordion
  collapsibleContainer: {
    marginBottom: t.spacing.lg,
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
  collapsibleChevron: {
    fontSize: 22,
    color: t.colors.textMuted,
    fontWeight: '600',
    width: 20,
    textAlign: 'center',
  },
  collapsibleHeaderContent: {
    flex: 1,
    marginLeft: t.spacing.sm,
  },
  collapsibleTitle: {
    fontSize: t.fontSize.md,
    fontWeight: '700',
    color: t.colors.text,
  },
  collapsibleHint: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    marginTop: 1,
  },
  collapsibleErrorBadge: {
    backgroundColor: t.colors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: t.spacing.sm,
  },
  collapsibleErrorBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  collapsibleBody: {
    paddingHorizontal: t.spacing.lg,
    paddingBottom: t.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.separator,
  },

  // Row
  rowContainer: { flexDirection: 'row', gap: t.spacing.md, marginBottom: t.spacing.lg },
  rowItem: { flex: 1 },

  // Tabs
  tabsContainer: { marginBottom: t.spacing.lg },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    marginBottom: t.spacing.md,
  },
  tab: { paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md, marginBottom: -1 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: t.colors.primary },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontSize: t.fontSize.sm, color: t.colors.textMuted },
  tabTextActive: { color: t.colors.text, fontWeight: '600' },
  tabTextError: { color: t.colors.error },
  tabErrorBadge: {
    backgroundColor: t.colors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabErrorBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  tabContent: { paddingTop: t.spacing.sm },

  // Array
  arrayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing.sm },
  arrayCount: { fontSize: t.fontSize.xs, color: t.colors.textMuted },
  arrayRow: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: t.spacing.md,
    marginBottom: t.spacing.sm,
  },
  arrayRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing.sm },
  arrayRowTitle: { fontSize: t.fontSize.sm, fontWeight: '600', color: t.colors.text },
  removeText: { fontSize: t.fontSize.sm, color: t.colors.destructive },
  addBtn: {
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addText: { fontSize: t.fontSize.sm, color: t.colors.textMuted, fontWeight: '600' },

  // Blocks
  blockRow: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: t.spacing.md,
    marginBottom: t.spacing.sm,
  },
  blockTypeLabel: { fontSize: t.fontSize.xs, fontWeight: '700', color: t.colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  blockPicker: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.sm,
    borderWidth: 1,
    borderColor: t.colors.border,
    marginTop: t.spacing.sm,
    overflow: 'hidden',
  },
  blockPickerItem: { paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
  blockPickerText: { fontSize: t.fontSize.md, color: t.colors.text },
})
