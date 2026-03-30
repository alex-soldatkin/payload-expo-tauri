/**
 * Structural (layout) fields: group, collapsible, row, tabs, array, blocks.
 * These contain sub-fields and use FieldRendererContext to render them.
 *
 * Uses @expo/ui native components when available:
 *   - Collapsible → DisclosureGroup (iOS only)
 *   - Tabs        → Picker segmented / SegmentedButton (both platforms)
 *
 * Falls back to custom LayoutAnimation-based implementations otherwise.
 */
import React, { createContext, useContext, useMemo, useRef, useState } from 'react'
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native'

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
import { nativeComponents } from './shared'
import { NativeHost } from './NativeHost'

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
// Error map context
// ---------------------------------------------------------------------------

export const ErrorMapContext = createContext<FormErrors>({})

const useErrorCountForFields = (fields: ClientField[], basePath: string): number => {
  const errors = useContext(ErrorMapContext)
  return useMemo(() => {
    let count = 0
    for (const field of fields) {
      const fieldPath = field.name ? (basePath ? `${basePath}.${field.name}` : field.name) : basePath
      for (const path in errors) {
        if (errors[path] && (path === fieldPath || path.startsWith(fieldPath + '.'))) count++
      }
    }
    return count
  }, [errors, fields, basePath])
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a tab's display label from i18n object or string. */
const getTabLabel = (tab: { label?: string | Record<string, string>; name?: string }, index: number): string => {
  if (tab.label) {
    if (typeof tab.label === 'string') return tab.label
    return tab.label.en || Object.values(tab.label)[0] || `Tab ${index + 1}`
  }
  return tab.name || `Tab ${index + 1}`
}

/** Build the full path for a sub-field within a parent. */
const subPath = (basePath: string, fieldName?: string): string =>
  `${basePath ? basePath + '.' : ''}${fieldName ?? ''}`

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

export const GroupField: React.FC<FieldComponentProps<ClientGroupField>> = ({
  field, path,
}) => {
  const renderField = useRenderField()
  const subFields = field.fields ?? []
  const description = getFieldDescription(field)

  if (!field.name) {
    return <>{subFields.map((sub, i) => <React.Fragment key={sub.name || `group-${i}`}>{renderField(sub, subPath(path, sub.name))}</React.Fragment>)}</>
  }

  return (
    <View style={[styles.groupCard, !(field.admin?.hideGutter ?? false) && styles.groupGutter]}>
      {field.label && (
        <View style={styles.groupHeader}>
          <Text style={styles.groupLabel}>{getFieldLabel(field)}</Text>
          {description && <Text style={styles.groupDesc}>{description}</Text>}
        </View>
      )}
      <View style={styles.groupBody}>
        {subFields.map((sub, i) => <React.Fragment key={sub.name || `group-${i}`}>{renderField(sub, `${path}.${sub.name ?? ''}`)}</React.Fragment>)}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Collapsible
// ---------------------------------------------------------------------------

const CollapsibleFieldNative: React.FC<FieldComponentProps<ClientCollapsibleField>> = ({
  field, path,
}) => {
  const renderField = useRenderField()
  const DisclosureGroup = nativeComponents.DisclosureGroup!
  const [expanded, setExpanded] = useState(!(field.admin?.initCollapsed ?? false))
  const subFields = field.fields ?? []
  const description = getFieldDescription(field)
  const errorCount = useErrorCountForFields(subFields, path)

  const label = errorCount > 0
    ? `${getFieldLabel(field)} (${errorCount} error${errorCount !== 1 ? 's' : ''})`
    : getFieldLabel(field)

  return (
    <View style={styles.collapsibleContainer}>
      <NativeHost>
        <DisclosureGroup label={label} isExpanded={expanded} onIsExpandedChange={setExpanded} />
      </NativeHost>
      {expanded && (
        <View style={styles.collapsibleBody}>
          {description && <Text style={styles.groupDesc}>{description}</Text>}
          {subFields.map((sub, i) => <React.Fragment key={sub.name || `col-${i}`}>{renderField(sub, subPath(path, sub.name))}</React.Fragment>)}
        </View>
      )}
    </View>
  )
}

const CollapsibleFieldFallback: React.FC<FieldComponentProps<ClientCollapsibleField>> = ({
  field, path,
}) => {
  const renderField = useRenderField()
  const [expanded, setExpanded] = useState(!(field.admin?.initCollapsed ?? false))
  const subFields = field.fields ?? []
  const description = getFieldDescription(field)
  const errorCount = useErrorCountForFields(subFields, path)

  const chevronAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current
  const rotation = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] })

  const toggle = () => {
    const next = !expanded
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded(next)
    Animated.spring(chevronAnim, { toValue: next ? 1 : 0, useNativeDriver: true, damping: 15, stiffness: 200 }).start()
  }

  return (
    <View style={styles.collapsibleContainer}>
      <Pressable style={styles.collapsibleHeader} onPress={toggle}>
        <Animated.Text style={[styles.collapsibleChevron, { transform: [{ rotate: rotation }] }]}>›</Animated.Text>
        <View style={styles.collapsibleHeaderContent}>
          <Text style={styles.collapsibleTitle}>{getFieldLabel(field)}</Text>
          {!expanded && description && <Text style={styles.collapsibleHint} numberOfLines={1}>{description}</Text>}
        </View>
        {errorCount > 0 && (
          <View style={styles.errorBadge}><Text style={styles.errorBadgeText}>{errorCount}</Text></View>
        )}
      </Pressable>
      {expanded && (
        <View style={styles.collapsibleBody}>
          {description && <Text style={styles.groupDesc}>{description}</Text>}
          {subFields.map((sub, i) => <React.Fragment key={sub.name || `col-${i}`}>{renderField(sub, subPath(path, sub.name))}</React.Fragment>)}
        </View>
      )}
    </View>
  )
}

export const CollapsibleField: React.FC<FieldComponentProps<ClientCollapsibleField>> = (props) =>
  nativeComponents.DisclosureGroup
    ? <CollapsibleFieldNative {...props} />
    : <CollapsibleFieldFallback {...props} />

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

export const RowField: React.FC<FieldComponentProps<ClientRowField>> = ({
  field, path,
}) => {
  const renderField = useRenderField()
  return (
    <View style={styles.rowContainer}>
      {(field.fields ?? []).map((sub, i) => (
        <View key={sub.name || `row-${i}`} style={[styles.rowItem, sub.admin?.width ? { flex: parseFloat(sub.admin.width) / 100 } : { flex: 1 }]}>
          {renderField(sub, subPath(path, sub.name))}
        </View>
      ))}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const SEGMENTED_TAB_THRESHOLD = 5

const TabsFieldNative: React.FC<FieldComponentProps<ClientTabsField>> = ({
  field, path,
}) => {
  const renderField = useRenderField()
  const errors = useContext(ErrorMapContext)
  const tabs = field.tabs ?? []
  const [activeIndex, setActiveIndex] = useState(0)
  const activeTab = tabs[activeIndex]
  const NativePicker = nativeComponents.Picker!
  const NativeText = nativeComponents.Text!

  const tabErrorCounts = useMemo(() =>
    tabs.map((tab) => {
      let count = 0
      for (const sub of tab.fields ?? []) {
        const fp = tab.name ? `${subPath(path, tab.name)}.${sub.name ?? ''}` : subPath(path, sub.name)
        for (const errPath in errors) { if (errors[errPath] && (errPath === fp || errPath.startsWith(fp + '.'))) count++ }
      }
      return count
    }), [tabs, path, errors])

  const labelForTab = (tab: any, i: number): string => {
    const base = getTabLabel(tab, i)
    const errs = tabErrorCounts[i] ?? 0
    return errs > 0 ? `${base} (${errs})` : base
  }

  const useSegmented = tabs.length <= SEGMENTED_TAB_THRESHOLD

  return (
    <View style={styles.tabsContainer}>
      {useSegmented ? (
        <View style={styles.nativeTabBarWrapper}>
          <NativeHost>
            <NativePicker
              selection={activeIndex}
              onSelectionChange={(s) => { if (typeof s === 'number') setActiveIndex(s) }}
              modifiers={[{ pickerStyle: 'segmented' }]}
            >
              {tabs.map((tab, i) => <NativeText key={tab.name || `tab-${i}`} modifiers={[{ tag: i }]}>{labelForTab(tab, i)}</NativeText>)}
            </NativePicker>
          </NativeHost>
        </View>
      ) : (
        <TabBarFallback tabs={tabs} activeIndex={activeIndex} setActiveIndex={setActiveIndex} tabErrorCounts={tabErrorCounts} />
      )}
      {activeTab && (
        <View style={styles.tabContent}>
          {(activeTab.fields ?? []).map((sub, i) => {
            const bp = activeTab.name ? `${subPath(path, activeTab.name)}.${sub.name ?? ''}` : subPath(path, sub.name)
            return <React.Fragment key={sub.name || `tf-${i}`}>{renderField(sub, bp)}</React.Fragment>
          })}
        </View>
      )}
    </View>
  )
}

/** Reusable tab bar for fallback + >5-tab cases. */
const TabBarFallback: React.FC<{
  tabs: any[]
  activeIndex: number
  setActiveIndex: (i: number) => void
  tabErrorCounts: number[]
}> = ({ tabs, activeIndex, setActiveIndex, tabErrorCounts }) => (
  <View style={styles.tabBar}>
    {tabs.map((tab, i) => {
      const label = getTabLabel(tab, i)
      const errs = tabErrorCounts[i] ?? 0
      return (
        <Pressable key={tab.name || `tab-${i}`} style={[styles.tab, i === activeIndex && styles.tabActive]} onPress={() => setActiveIndex(i)}>
          <View style={styles.tabLabelRow}>
            <Text style={[styles.tabText, i === activeIndex && styles.tabTextActive, errs > 0 && styles.tabTextError]}>{label}</Text>
            {errs > 0 && <View style={styles.errorBadge}><Text style={styles.errorBadgeText}>{errs}</Text></View>}
          </View>
        </Pressable>
      )
    })}
  </View>
)

const TabsFieldFallback: React.FC<FieldComponentProps<ClientTabsField>> = ({
  field, path,
}) => {
  const renderField = useRenderField()
  const errors = useContext(ErrorMapContext)
  const tabs = field.tabs ?? []
  const [activeIndex, setActiveIndex] = useState(0)
  const activeTab = tabs[activeIndex]

  const tabErrorCounts = useMemo(() =>
    tabs.map((tab) => {
      let count = 0
      for (const sub of tab.fields ?? []) {
        const fp = tab.name ? `${subPath(path, tab.name)}.${sub.name ?? ''}` : subPath(path, sub.name)
        for (const errPath in errors) { if (errors[errPath] && (errPath === fp || errPath.startsWith(fp + '.'))) count++ }
      }
      return count
    }), [tabs, path, errors])

  return (
    <View style={styles.tabsContainer}>
      <TabBarFallback tabs={tabs} activeIndex={activeIndex} setActiveIndex={setActiveIndex} tabErrorCounts={tabErrorCounts} />
      {activeTab && (
        <View style={styles.tabContent}>
          {(activeTab.fields ?? []).map((sub, i) => {
            const bp = activeTab.name ? `${subPath(path, activeTab.name)}.${sub.name ?? ''}` : subPath(path, sub.name)
            return <React.Fragment key={sub.name || `tf-${i}`}>{renderField(sub, bp)}</React.Fragment>
          })}
        </View>
      )}
    </View>
  )
}

export const TabsField: React.FC<FieldComponentProps<ClientTabsField>> = (props) =>
  nativeComponents.Picker && nativeComponents.Text
    ? <TabsFieldNative {...props} />
    : <TabsFieldFallback {...props} />

// ---------------------------------------------------------------------------
// Array
// ---------------------------------------------------------------------------

export const ArrayField: React.FC<FieldComponentProps<ClientArrayField>> = ({
  field, value, onChange, path, disabled, error,
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
            {!disabled && <Pressable onPress={() => removeRow(index)}><Text style={styles.removeText}>Remove</Text></Pressable>}
          </View>
          {subFields.map((sub, fi) => <React.Fragment key={sub.name || `arr-${fi}`}>{renderField(sub, `${path}.${index}.${sub.name ?? ''}`)}</React.Fragment>)}
        </View>
      ))}

      {!disabled && (field.maxRows == null || items.length < field.maxRows) && (
        <Pressable style={styles.addBtn} onPress={addRow}><Text style={styles.addText}>+ Add {singularLabel}</Text></Pressable>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export const BlocksField: React.FC<FieldComponentProps<ClientBlocksField>> = ({
  field, value, onChange, path, disabled, error,
}) => {
  const renderField = useRenderField()
  const items = Array.isArray(value) ? (value as Array<Record<string, unknown> & { blockType?: string }>) : []
  const blocks = field.blocks ?? []
  const [showPicker, setShowPicker] = useState(false)

  const addBlock = (slug: string) => {
    if (field.maxRows != null && items.length >= field.maxRows) return
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onChange([...items, { blockType: slug }])
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
        return (
          <View key={`${path}.${index}`} style={styles.blockRow}>
            <View style={styles.arrayRowHeader}>
              <Text style={styles.blockTypeLabel}>{block?.labels?.singular || item.blockType || 'Block'}</Text>
              {!disabled && <Pressable onPress={() => removeBlock(index)}><Text style={styles.removeText}>Remove</Text></Pressable>}
            </View>
            {(block?.fields ?? []).map((sub, fi) => <React.Fragment key={sub.name || `blk-${fi}`}>{renderField(sub, `${path}.${index}.${sub.name ?? ''}`)}</React.Fragment>)}
          </View>
        )
      })}

      {!disabled && (field.maxRows == null || items.length < field.maxRows) && (
        <>
          <Pressable style={styles.addBtn} onPress={() => setShowPicker(true)}><Text style={styles.addText}>+ Add block</Text></Pressable>
          {showPicker && (
            <View style={styles.blockPicker}>
              {blocks.map((block) => (
                <Pressable key={block.slug} style={styles.blockPickerItem} onPress={() => addBlock(block.slug)}>
                  <Text style={styles.blockPickerText}>{block.labels?.singular || block.slug}</Text>
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

  // Group
  groupCard: { marginBottom: t.spacing.lg, backgroundColor: t.colors.surface, borderRadius: t.borderRadius.md, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' },
  groupGutter: { borderLeftWidth: 3, borderLeftColor: t.colors.primary },
  groupHeader: { paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator, backgroundColor: '#fafafa' },
  groupLabel: { fontSize: t.fontSize.md, fontWeight: '700', color: t.colors.text },
  groupDesc: { fontSize: t.fontSize.xs, color: t.colors.textMuted, marginTop: 2, marginBottom: t.spacing.sm },
  groupBody: { padding: t.spacing.lg },

  // Collapsible
  collapsibleContainer: { marginBottom: t.spacing.lg, backgroundColor: t.colors.surface, borderRadius: t.borderRadius.md, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' },
  collapsibleHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md },
  collapsibleChevron: { fontSize: 22, color: t.colors.textMuted, fontWeight: '600', width: 20, textAlign: 'center' },
  collapsibleHeaderContent: { flex: 1, marginLeft: t.spacing.sm },
  collapsibleTitle: { fontSize: t.fontSize.md, fontWeight: '700', color: t.colors.text },
  collapsibleHint: { fontSize: t.fontSize.xs, color: t.colors.textMuted, marginTop: 1 },
  collapsibleBody: { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.separator },

  // Error badge (reused by collapsible + tabs)
  errorBadge: { backgroundColor: t.colors.error, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: t.spacing.sm },
  errorBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Row
  rowContainer: { flexDirection: 'row', gap: t.spacing.md, marginBottom: t.spacing.lg },
  rowItem: { flex: 1 },

  // Tabs
  tabsContainer: { marginBottom: t.spacing.lg },
  nativeTabBarWrapper: { marginBottom: t.spacing.md },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.colors.border, marginBottom: t.spacing.md },
  tab: { paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md, marginBottom: -1 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: t.colors.primary },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontSize: t.fontSize.sm, color: t.colors.textMuted },
  tabTextActive: { color: t.colors.text, fontWeight: '600' },
  tabTextError: { color: t.colors.error },
  tabContent: { paddingTop: t.spacing.sm },

  // Array
  arrayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing.sm },
  arrayCount: { fontSize: t.fontSize.xs, color: t.colors.textMuted },
  arrayRow: { backgroundColor: t.colors.surface, borderRadius: t.borderRadius.md, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.md, marginBottom: t.spacing.sm },
  arrayRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing.sm },
  arrayRowTitle: { fontSize: t.fontSize.sm, fontWeight: '600', color: t.colors.text },
  removeText: { fontSize: t.fontSize.sm, color: t.colors.destructive },
  addBtn: { paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.lg, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.borderRadius.sm, borderStyle: 'dashed', alignItems: 'center' },
  addText: { fontSize: t.fontSize.sm, color: t.colors.textMuted, fontWeight: '600' },

  // Blocks
  blockRow: { backgroundColor: t.colors.surface, borderRadius: t.borderRadius.md, borderWidth: 1, borderColor: t.colors.border, padding: t.spacing.md, marginBottom: t.spacing.sm },
  blockTypeLabel: { fontSize: t.fontSize.xs, fontWeight: '700', color: t.colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  blockPicker: { backgroundColor: t.colors.surface, borderRadius: t.borderRadius.sm, borderWidth: 1, borderColor: t.colors.border, marginTop: t.spacing.sm, overflow: 'hidden' },
  blockPickerItem: { paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
  blockPickerText: { fontSize: t.fontSize.md, color: t.colors.text },
})
