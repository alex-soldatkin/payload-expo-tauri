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
import { getFieldDescription, getFieldLabel, groupFieldsByWidth } from '../utils/schemaHelpers'
import { nativeComponents } from './shared'
import { NativeHost } from './NativeHost'

// Optional: GlassView for liquid glass containers on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

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
// Tab depth context — top-level tabs = segmented, nested = pills
// ---------------------------------------------------------------------------

const TabDepthContext = createContext(0)
const useTabDepth = () => useContext(TabDepthContext)

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

/**
 * Render sub-fields, grouping consecutive fields with `admin.width` into
 * flex rows so they lay out side-by-side (e.g. two 50% fields in one row).
 */
const renderSubFieldsWithWidth = (
  fields: ClientField[],
  buildPath: (field: ClientField) => string,
  renderFn: RenderFieldFn,
  keyPrefix: string,
): React.ReactNode[] => {
  const groups = groupFieldsByWidth(fields)
  return groups.map((group, gi) => {
    if (group.type === 'width-row') {
      return (
        <View key={`${keyPrefix}-wrow-${gi}`} style={styles.widthRow}>
          {group.fields.map((sub) => (
            <View key={sub.name || `${keyPrefix}-wf-${gi}`} style={{ flex: parseFloat(sub.admin!.width!) / 100 }}>
              {renderFn(sub, buildPath(sub))}
            </View>
          ))}
        </View>
      )
    }
    const sub = group.field
    return (
      <React.Fragment key={sub.name || `${keyPrefix}-${gi}`}>
        {renderFn(sub, buildPath(sub))}
      </React.Fragment>
    )
  })
}

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
    return <>{renderSubFieldsWithWidth(subFields, (sub) => subPath(path, sub.name), renderField, 'group')}</>
  }

  const content = (
    <>
      {field.label && (
        <View style={styles.groupHeader}>
          <Text style={styles.groupLabel}>{getFieldLabel(field)}</Text>
          {description && <Text style={styles.groupDesc}>{description}</Text>}
        </View>
      )}
      <View style={styles.groupBody}>
        {renderSubFieldsWithWidth(subFields, (sub) => `${path}.${sub.name ?? ''}`, renderField, 'grp')}
      </View>
    </>
  )

  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView
        style={[styles.glassGroupCard, !(field.admin?.hideGutter ?? false) && styles.groupGutter]}
        glassEffectStyle="regular"
      >
        {content}
      </GlassView>
    )
  }

  return (
    <View style={[styles.groupCard, !(field.admin?.hideGutter ?? false) && styles.groupGutter]}>
      {content}
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

  const ContainerStyle = liquidGlassAvailable && GlassView ? styles.glassCollapsibleContainer : styles.collapsibleContainer
  const Container = liquidGlassAvailable && GlassView
    ? ({ children }: any) => <GlassView style={ContainerStyle} glassEffectStyle="regular">{children}</GlassView>
    : ({ children }: any) => <View style={ContainerStyle}>{children}</View>

  return (
    <Container>
      <NativeHost>
        <DisclosureGroup label={label} isExpanded={expanded} onIsExpandedChange={setExpanded} />
      </NativeHost>
      {expanded && (
        <View style={styles.collapsibleBody}>
          {description && <Text style={styles.groupDesc}>{description}</Text>}
          {renderSubFieldsWithWidth(subFields, (sub) => subPath(path, sub.name), renderField, 'coln')}
        </View>
      )}
    </Container>
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

  const Wrapper = liquidGlassAvailable && GlassView
    ? ({ children, style }: any) => <GlassView style={[styles.glassCollapsibleContainer, style]} glassEffectStyle="regular">{children}</GlassView>
    : ({ children, style }: any) => <View style={[styles.collapsibleContainer, style]}>{children}</View>

  return (
    <Wrapper>
      <Pressable
        style={({ pressed }) => [styles.collapsibleHeader, pressed && styles.collapsibleHeaderPressed]}
        onPress={toggle}
      >
        <View style={styles.collapsibleHeaderContent}>
          <Text style={styles.collapsibleTitle}>{getFieldLabel(field)}</Text>
          {!expanded && description && <Text style={styles.collapsibleHint} numberOfLines={1}>{description}</Text>}
        </View>
        {errorCount > 0 && (
          <View style={styles.errorBadge}><Text style={styles.errorBadgeText}>{errorCount}</Text></View>
        )}
        <Animated.Text style={[styles.collapsibleChevron, { transform: [{ rotate: rotation }] }]}>
          ‹
        </Animated.Text>
      </Pressable>
      {expanded && (
        <View style={styles.collapsibleBody}>
          {description && <Text style={styles.groupDesc}>{description}</Text>}
          {renderSubFieldsWithWidth(subFields, (sub) => subPath(path, sub.name), renderField, 'colf')}
        </View>
      )}
    </Wrapper>
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

// Native segmented picker threshold — beyond this, fall back to scrollable pills
const SEGMENTED_TAB_THRESHOLD = 6

/** Shared tab error counting logic. */
const useTabErrorCounts = (tabs: any[], path: string) => {
  const errors = useContext(ErrorMapContext)
  return useMemo(() =>
    tabs.map((tab) => {
      let count = 0
      for (const sub of tab.fields ?? []) {
        const fp = tab.name ? `${subPath(path, tab.name)}.${sub.name ?? ''}` : subPath(path, sub.name)
        for (const errPath in errors) { if (errors[errPath] && (errPath === fp || errPath.startsWith(fp + '.'))) count++ }
      }
      return count
    }), [tabs, path, errors])
}

/** Render active tab content, wrapped in depth+1 context for nested tabs. */
const TabContent: React.FC<{
  activeTab: any
  path: string
  depth: number
  renderField: RenderFieldFn
}> = ({ activeTab, path, depth, renderField }) => {
  if (!activeTab) return null
  return (
    <TabDepthContext.Provider value={depth + 1}>
      <View style={styles.tabContent}>
        {renderSubFieldsWithWidth(
          activeTab.fields ?? [],
          (sub: ClientField) => activeTab.name ? `${subPath(path, activeTab.name)}.${sub.name ?? ''}` : subPath(path, sub.name),
          renderField,
          activeTab.name || 'tab',
        )}
      </View>
    </TabDepthContext.Provider>
  )
}

/** Pill-style tab bar — used for nested tabs and fallback on all platforms. */
const PillTabBar: React.FC<{
  tabs: any[]
  activeIndex: number
  setActiveIndex: (i: number) => void
  tabErrorCounts: number[]
}> = ({ tabs, activeIndex, setActiveIndex, tabErrorCounts }) => (
  <View style={styles.pillBar}>
    {tabs.map((tab, i) => {
      const label = getTabLabel(tab, i)
      const errs = tabErrorCounts[i] ?? 0
      const isActive = i === activeIndex
      return (
        <Pressable
          key={tab.name || `tab-${i}`}
          style={[styles.pill, isActive && styles.pillActive]}
          onPress={() => setActiveIndex(i)}
        >
          <Text style={[styles.pillText, isActive && styles.pillTextActive, errs > 0 && styles.pillTextError]}>
            {label}
          </Text>
          {errs > 0 && <View style={styles.errorBadge}><Text style={styles.errorBadgeText}>{errs}</Text></View>}
        </Pressable>
      )
    })}
  </View>
)


export const TabsField: React.FC<FieldComponentProps<ClientTabsField>> = ({
  field, path,
}) => {
  const renderField = useRenderField()
  const depth = useTabDepth()
  const tabs = field.tabs ?? []
  const [activeIndex, setActiveIndex] = useState(0)
  const activeTab = tabs[activeIndex]
  const tabErrorCounts = useTabErrorCounts(tabs, path)

  const hasNativePicker = !!(nativeComponents.Picker && nativeComponents.Text)
  const NativePicker = nativeComponents.Picker
  const NativeText = nativeComponents.Text

  const labelForTab = (tab: any, i: number): string => {
    const base = getTabLabel(tab, i)
    const errs = tabErrorCounts[i] ?? 0
    return errs > 0 ? `${base} (${errs})` : base
  }

  // Always use native segmented picker when available (all depths).
  // Falls back to pill bar (which mimics the segmented look) otherwise.
  const useNativeSegmented = hasNativePicker && tabs.length <= SEGMENTED_TAB_THRESHOLD

  return (
    <View style={[styles.tabsContainer, depth > 0 && styles.tabsNested]}>
      {useNativeSegmented ? (
        <View style={styles.nativeTabBarWrapper}>
          <NativeHost matchContents={{ height: true }}>
            <NativePicker
              selection={String(activeIndex)}
              onSelectionChange={(s: any) => {
                const idx = typeof s === 'number' ? s : parseInt(String(s), 10)
                if (!isNaN(idx) && idx >= 0 && idx < tabs.length) setActiveIndex(idx)
              }}
              modifiers={[
                nativeComponents.pickerStyle!('segmented'),
              ]}
            >
              {tabs.map((tab, i) => <NativeText key={tab.name || `tab-${i}`} modifiers={[nativeComponents.tag!(String(i))]}>{labelForTab(tab, i)}</NativeText>)}
            </NativePicker>
          </NativeHost>
        </View>
      ) : (
        <PillTabBar tabs={tabs} activeIndex={activeIndex} setActiveIndex={setActiveIndex} tabErrorCounts={tabErrorCounts} />
      )}
      <TabContent activeTab={activeTab} path={path} depth={depth} renderField={renderField} />
    </View>
  )
}

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

      {items.map((_, index) => {
        const rowContent = (
          <>
            <View style={styles.arrayRowHeader}>
              <Text style={styles.arrayRowTitle}>{singularLabel} {index + 1}</Text>
              {!disabled && <Pressable onPress={() => removeRow(index)}><Text style={styles.removeText}>Remove</Text></Pressable>}
            </View>
            {renderSubFieldsWithWidth(subFields, (sub) => `${path}.${index}.${sub.name ?? ''}`, renderField, `arr-${index}`)}
          </>
        )
        return liquidGlassAvailable && GlassView ? (
          <GlassView key={`${path}.${index}`} style={styles.glassArrayRow} glassEffectStyle="regular">
            {rowContent}
          </GlassView>
        ) : (
          <View key={`${path}.${index}`} style={styles.arrayRow}>
            {rowContent}
          </View>
        )
      })}

      {!disabled && (field.maxRows == null || items.length < field.maxRows) && (
        liquidGlassAvailable && GlassView ? (
          <Pressable onPress={addRow}>
            <GlassView style={styles.glassAddBtn} isInteractive glassEffectStyle="regular">
              <Text style={styles.addText}>+ Add {singularLabel}</Text>
            </GlassView>
          </Pressable>
        ) : (
          <Pressable style={styles.addBtn} onPress={addRow}><Text style={styles.addText}>+ Add {singularLabel}</Text></Pressable>
        )
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
        const blockContent = (
          <>
            <View style={styles.arrayRowHeader}>
              <Text style={styles.blockTypeLabel}>{block?.labels?.singular || item.blockType || 'Block'}</Text>
              {!disabled && <Pressable onPress={() => removeBlock(index)}><Text style={styles.removeText}>Remove</Text></Pressable>}
            </View>
            {renderSubFieldsWithWidth(block?.fields ?? [], (sub) => `${path}.${index}.${sub.name ?? ''}`, renderField, `blk-${index}`)}
          </>
        )
        return liquidGlassAvailable && GlassView ? (
          <GlassView key={`${path}.${index}`} style={styles.glassArrayRow} glassEffectStyle="regular">
            {blockContent}
          </GlassView>
        ) : (
          <View key={`${path}.${index}`} style={styles.blockRow}>
            {blockContent}
          </View>
        )
      })}

      {!disabled && (field.maxRows == null || items.length < field.maxRows) && (
        <>
          {liquidGlassAvailable && GlassView ? (
            <Pressable onPress={() => setShowPicker(true)}>
              <GlassView style={styles.glassAddBtn} isInteractive glassEffectStyle="regular">
                <Text style={styles.addText}>+ Add block</Text>
              </GlassView>
            </Pressable>
          ) : (
            <Pressable style={styles.addBtn} onPress={() => setShowPicker(true)}><Text style={styles.addText}>+ Add block</Text></Pressable>
          )}
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
  container: { marginBottom: t.spacing.xs },
  required: { color: t.colors.error },
  error: { fontSize: 12, color: t.colors.error, marginTop: 2 },

  // Group — clean section divider (no card/shadow)
  groupCard: {
    marginTop: t.spacing.sm,
    marginBottom: t.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.separator,
    paddingTop: t.spacing.xs,
  },
  glassGroupCard: {
    marginBottom: t.spacing.xs,
    borderRadius: t.borderRadius.md,
    overflow: 'hidden',
  },
  groupGutter: { borderLeftWidth: 2, borderLeftColor: t.colors.textMuted },
  groupHeader: {
    paddingVertical: 4,
  },
  groupLabel: { fontSize: t.fontSize.sm, fontWeight: '600', color: t.colors.textMuted },
  groupDesc: { fontSize: 12, color: t.colors.textPlaceholder, marginTop: 1, marginBottom: t.spacing.xs },
  groupBody: { },

  // Collapsible — clean toggle section
  collapsibleContainer: {
    marginTop: t.spacing.xs,
    marginBottom: t.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.separator,
  },
  glassCollapsibleContainer: {
    marginBottom: t.spacing.xs,
    borderRadius: t.borderRadius.md,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    minHeight: 44,
  },
  collapsibleHeaderPressed: {
    opacity: 0.6,
  },
  collapsibleChevron: {
    fontSize: 16,
    color: t.colors.textMuted,
    fontWeight: '600',
    marginLeft: t.spacing.xs,
  },
  collapsibleHeaderContent: {
    flex: 1,
  },
  collapsibleTitle: {
    fontSize: t.fontSize.md,
    fontWeight: '500',
    color: t.colors.text,
  },
  collapsibleHint: {
    fontSize: 12,
    color: t.colors.textPlaceholder,
    marginTop: 1,
  },
  collapsibleBody: {
    paddingTop: 2,
    paddingBottom: t.spacing.sm,
  },

  // Error badge (reused by collapsible + tabs)
  errorBadge: { backgroundColor: t.colors.error, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, marginLeft: t.spacing.xs },
  errorBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Width-grouped fields
  widthRow: { flexDirection: 'row' as const, gap: t.spacing.md },

  // Row
  rowContainer: { flexDirection: 'row', gap: t.spacing.md },
  rowItem: { flex: 1 },

  // Tabs
  tabsContainer: { marginBottom: t.spacing.xs },
  tabsNested: { marginBottom: 2, marginTop: 2 },
  nativeTabBarWrapper: { marginBottom: t.spacing.sm },

  // Pill tab bar
  pillBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 9,
    padding: 2,
    marginBottom: t.spacing.sm,
    gap: 1,
  },
  pill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: t.spacing.sm,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  pillActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  pillText: {
    fontSize: t.fontSize.sm,
    color: t.colors.textMuted,
    fontWeight: '500',
  },
  pillTextActive: {
    color: t.colors.text,
    fontWeight: '600',
  },
  pillTextError: { color: t.colors.error },

  tabContent: { paddingTop: 4 },

  // Array — minimal row styling
  arrayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  arrayCount: { fontSize: 12, color: t.colors.textPlaceholder },
  arrayRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.separator, paddingVertical: t.spacing.sm, marginBottom: 2 },
  glassArrayRow: { borderRadius: t.borderRadius.md, padding: t.spacing.sm, marginBottom: 2 },
  arrayRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  arrayRowTitle: { fontSize: t.fontSize.sm, fontWeight: '500', color: t.colors.textMuted },
  removeText: { fontSize: t.fontSize.sm, color: t.colors.destructive },
  addBtn: { paddingVertical: t.spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.separator, alignItems: 'center' as const },
  glassAddBtn: { paddingVertical: t.spacing.sm, borderRadius: t.borderRadius.sm, alignItems: 'center' as const },
  addText: { fontSize: t.fontSize.sm, color: t.colors.textMuted, fontWeight: '500' },

  // Blocks
  blockRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.separator, paddingVertical: t.spacing.sm, marginBottom: 2 },
  blockTypeLabel: { fontSize: 11, fontWeight: '600', color: t.colors.textMuted, letterSpacing: 0.3 },
  blockPicker: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.separator, marginTop: t.spacing.xs, overflow: 'hidden' },
  blockPickerItem: { paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator },
  blockPickerText: { fontSize: t.fontSize.md, color: t.colors.text },
})
