/**
 * Shared infrastructure for structural (layout) fields.
 *
 * INTERNAL — only files inside `fields/structural/` and the `structural.tsx`
 * barrel may import this module. External consumers import from
 * `fields/structural` (the barrel re-exports the public surface).
 *
 * Contains:
 *  - FieldRendererContext / ErrorMapContext (object identity preserved from
 *    the pre-split structural.tsx — DocumentForm depends on these)
 *  - Width-aware sub-field rendering helpers
 *  - Dark-mode-aware palette (follows useColorScheme — never hardcoded light)
 *  - ErrorBadge (unified badge-style error count)
 *  - SegmentedIndexPicker (three-tier: SwiftUI Picker → JC Picker → JS pills)
 *  - RowActionsMenu (three-tier: SwiftUI Menu → JC ContextMenu → BottomSheet)
 *  - AddRowButton (three-tier, liquid-glass styled on iOS 26+)
 */
import React, { createContext, useContext, useMemo, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native'

import type { ClientField, FormErrors } from '../../types'
import { defaultTheme as t } from '../../theme'
import { groupFieldsByWidth } from '../../utils/schemaHelpers'
import { nativeComponents } from '../shared'
import { NativeHost } from '../NativeHost'
import { BottomSheet } from '../../BottomSheet'

// ---------------------------------------------------------------------------
// Liquid glass (iOS 26+) — optional GlassView container
// ---------------------------------------------------------------------------

let _GlassView: React.ComponentType<any> | null = null
let _liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  _GlassView = glassModule.GlassView
  _liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}
// Exported as consts so TS narrowing survives into closures at call sites.
export const GlassView = _GlassView
export const liquidGlassAvailable = _liquidGlassAvailable

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// ---------------------------------------------------------------------------
// Context for recursive field rendering
// ---------------------------------------------------------------------------

export type RenderFieldFn = (field: ClientField, basePath: string) => React.ReactNode

export const FieldRendererContext = createContext<RenderFieldFn | null>(null)

export const useRenderField = (): RenderFieldFn => {
  const fn = useContext(FieldRendererContext)
  if (!fn) throw new Error('FieldRendererContext is required for structural fields')
  return fn
}

// ---------------------------------------------------------------------------
// Tab depth context — top-level tabs = segmented, nested = pills
// ---------------------------------------------------------------------------

export const TabDepthContext = createContext(0)
export const useTabDepth = () => useContext(TabDepthContext)

// ---------------------------------------------------------------------------
// RowLabel context — provided by ArrayField around custom RowLabel components
// (codegen registry slot 'RowLabel'). The @payload-universal/ui native shim's
// `useRowLabel()` should read this context; components also receive
// { data, rowNumber, index, path } as props for prop-based consumption.
// ---------------------------------------------------------------------------

export type RowLabelContextValue = {
  data: Record<string, unknown>
  /** 1-based row number (Payload web parity). */
  rowNumber: number
  /** 0-based row index. */
  index: number
  /** Full dot-path to the row, e.g. 'gallery.2'. */
  path: string
}

export const RowLabelContext = createContext<RowLabelContextValue | null>(null)

/** Read the enclosing array row's data/number (for custom RowLabel components). */
export const useRowLabelContext = (): RowLabelContextValue | null => useContext(RowLabelContext)

// ---------------------------------------------------------------------------
// Error map context
// ---------------------------------------------------------------------------

export const ErrorMapContext = createContext<FormErrors>({})

/** Count errors at or below a path prefix (non-hook — usable in loops). */
export const countErrorsForPrefix = (errors: FormErrors, prefix: string): number => {
  let count = 0
  for (const path in errors) {
    if (errors[path] && (path === prefix || path.startsWith(prefix + '.'))) count++
  }
  return count
}

export const useErrorCountForFields = (fields: ClientField[], basePath: string): number => {
  const errors = useContext(ErrorMapContext)
  return useMemo(() => {
    let count = 0
    for (const field of fields) {
      const fieldPath = field.name ? (basePath ? `${basePath}.${field.name}` : field.name) : basePath
      count += countErrorsForPrefix(errors, fieldPath)
    }
    return count
  }, [errors, fields, basePath])
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve an i18n label record (or plain string) to a display string. */
export const resolveI18nText = (
  text: string | Record<string, string> | undefined,
  fallback = '',
): string => {
  if (!text) return fallback
  if (typeof text === 'string') return text
  return text.en || Object.values(text)[0] || fallback
}

/** Resolve a tab's display label from i18n object or string. */
export const getTabLabel = (tab: { label?: string | Record<string, string>; name?: string }, index: number): string => {
  if (tab.label) return resolveI18nText(tab.label, `Tab ${index + 1}`)
  return tab.name || `Tab ${index + 1}`
}

/** Build the full path for a sub-field within a parent. */
export const subPath = (basePath: string, fieldName?: string): string =>
  `${basePath ? basePath + '.' : ''}${fieldName ?? ''}`

/**
 * Breakpoint (px) below which admin.width is treated as guidance —
 * fields stack vertically to avoid cramped layouts on small phones.
 * Above this, widths are honoured as flex ratios (tablet / landscape).
 * Matches Payload web admin's `@include mid-break` behaviour.
 */
export const FIELD_WIDTH_BREAKPOINT = 500

/**
 * Hook that returns whether the current screen is too narrow to
 * honour admin.width values. Uses window width directly.
 */
export const useCompactFields = (): boolean => {
  const { width } = useWindowDimensions()
  return width < FIELD_WIDTH_BREAKPOINT
}

/**
 * Render sub-fields, grouping consecutive fields with `admin.width` into
 * flex rows so they lay out side-by-side (e.g. two 50% fields in one row).
 *
 * When `compact` is true (small screens), width-grouped fields are rendered
 * stacked vertically instead of in rows, treating admin.width as guidance.
 */
export const renderSubFieldsWithWidth = (
  fields: ClientField[],
  buildPath: (field: ClientField) => string,
  renderFn: RenderFieldFn,
  keyPrefix: string,
  compact = false,
): React.ReactNode[] => {
  const groups = groupFieldsByWidth(fields)
  return groups.map((group, gi) => {
    if (group.type === 'width-row') {
      if (compact) {
        // On small screens: render each field full-width, stacked vertically
        return (
          <React.Fragment key={`${keyPrefix}-wrow-${gi}`}>
            {group.fields.map((sub) => (
              <React.Fragment key={sub.name || `${keyPrefix}-wf-${gi}`}>
                {renderFn(sub, buildPath(sub))}
              </React.Fragment>
            ))}
          </React.Fragment>
        )
      }
      // On wide screens: render side-by-side with proportional flex
      return (
        <View key={`${keyPrefix}-wrow-${gi}`} style={commonStyles.widthRow}>
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
// Dark-mode-aware palette — follows the system appearance.
// The static theme tokens are light-only; structural surfaces resolve their
// colour-bearing styles through this hook instead (never hardcode 'light').
// ---------------------------------------------------------------------------

export type StructuralPalette = {
  isDark: boolean
  text: string
  textMuted: string
  textFaint: string
  separator: string
  /** Subtle card surface used when liquid glass is unavailable. */
  cardBg: string
  cardBorder: string
  pillBarBg: string
  pillActiveBg: string
  primary: string
  destructive: string
  inputBg: string
}

export const usePalette = (): StructuralPalette => {
  const isDark = useColorScheme() === 'dark'
  return useMemo(() => isDark
    ? {
        isDark,
        text: '#f2f2f7',
        textMuted: 'rgba(235,235,245,0.6)',
        textFaint: 'rgba(235,235,245,0.35)',
        separator: 'rgba(84,84,88,0.65)',
        cardBg: 'rgba(255,255,255,0.06)',
        cardBorder: 'rgba(255,255,255,0.12)',
        pillBarBg: 'rgba(118,118,128,0.24)',
        pillActiveBg: '#636366',
        primary: '#ffffff',
        destructive: '#ff453a',
        inputBg: 'rgba(118,118,128,0.18)',
      }
    : {
        isDark,
        text: t.colors.text,
        textMuted: t.colors.textMuted,
        textFaint: t.colors.textPlaceholder,
        separator: t.colors.separator,
        cardBg: 'rgba(0,0,0,0.03)',
        cardBorder: 'rgba(0,0,0,0.08)',
        pillBarBg: 'rgba(0,0,0,0.05)',
        pillActiveBg: '#ffffff',
        primary: t.colors.primary,
        destructive: t.colors.destructive,
        inputBg: 'rgba(118,118,128,0.12)',
      }, [isDark])
}

// ---------------------------------------------------------------------------
// ErrorBadge — unified badge-style error count (replaces "(n errors)" text
// wherever a custom layout allows embedding views)
// ---------------------------------------------------------------------------

export const ErrorBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null
  return (
    <View style={commonStyles.errorBadge}>
      <Text style={commonStyles.errorBadgeText}>{count}</Text>
    </View>
  )
}

/**
 * Append an error-count suffix to a string label. Used only where badges are
 * NOT feasible: native SwiftUI Section / DisclosureGroup / segmented-control
 * labels are plain strings.
 */
export const withErrorSuffix = (label: string, count: number): string =>
  count > 0 ? `${label} (${count})` : label

// ---------------------------------------------------------------------------
// Segmented index picker — shared by Tabs and Array (switcher mode).
// Three tiers:
//   1. SwiftUI Picker + pickerStyle('segmented')   (iOS, registry-gated)
//   2. JC Picker variant='segmented'               (Android, registry-gated)
//   3. PillTabBar                                  (pure JS fallback)
// Native segmented controls cap at SEGMENTED_THRESHOLD entries; beyond that
// the JS pill bar renders horizontally scrollable.
// ---------------------------------------------------------------------------

export const SEGMENTED_THRESHOLD = 6

/** Pill-style tab bar — JS fallback on all platforms; scrolls when crowded. */
export const PillTabBar: React.FC<{
  labels: string[]
  activeIndex: number
  setActiveIndex: (i: number) => void
  errorCounts?: number[]
}> = ({ labels, activeIndex, setActiveIndex, errorCounts }) => {
  const palette = usePalette()
  const scrollable = labels.length > SEGMENTED_THRESHOLD

  const pills = labels.map((label, i) => {
    const errs = errorCounts?.[i] ?? 0
    const isActive = i === activeIndex
    return (
      <Pressable
        key={`pill-${i}`}
        style={[
          commonStyles.pill,
          !scrollable && commonStyles.pillFlex,
          isActive && [commonStyles.pillActive, { backgroundColor: palette.pillActiveBg }],
        ]}
        onPress={() => setActiveIndex(i)}
      >
        <Text
          style={[
            commonStyles.pillText,
            { color: isActive ? palette.text : palette.textMuted },
            isActive && commonStyles.pillTextActive,
            errs > 0 && { color: t.colors.error },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <ErrorBadge count={errs} />
      </Pressable>
    )
  })

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={commonStyles.pillScroll}>
        <View style={[commonStyles.pillBar, { backgroundColor: palette.pillBarBg }]}>{pills}</View>
      </ScrollView>
    )
  }
  return <View style={[commonStyles.pillBar, { backgroundColor: palette.pillBarBg }]}>{pills}</View>
}

export const SegmentedIndexPicker: React.FC<{
  labels: string[]
  selectedIndex: number
  onSelect: (index: number) => void
  errorCounts?: number[]
}> = ({ labels, selectedIndex, onSelect, errorCounts }) => {
  // Error counts fold into the segment text — native segments are text-only.
  const display = labels.map((label, i) => withErrorSuffix(label, errorCounts?.[i] ?? 0))

  const fitsNative = labels.length <= SEGMENTED_THRESHOLD
  // Tier 1 — SwiftUI segmented Picker. Gate REQUIRES the pickerStyle + tag
  // modifier factories: they are null on Android / Expo Go and calling them
  // with `!` behind a looser gate is a TypeError.
  const canSwiftUI = !!(
    nativeComponents.Picker &&
    nativeComponents.Text &&
    nativeComponents.pickerStyle &&
    nativeComponents.tag
  ) && fitsNative
  // Tier 2 — Jetpack Compose segmented Picker (options-based API).
  const canJC = !!nativeComponents.JCPicker && fitsNative

  if (canSwiftUI) {
    const NativePicker = nativeComponents.Picker!
    const NativeText = nativeComponents.Text!
    return (
      <View style={commonStyles.segmentedWrapper}>
        <NativeHost matchContents={{ height: true }}>
          <NativePicker
            selection={String(selectedIndex)}
            onSelectionChange={(s: any) => {
              const idx = typeof s === 'number' ? s : parseInt(String(s), 10)
              if (!isNaN(idx) && idx >= 0 && idx < labels.length) onSelect(idx)
            }}
            modifiers={[nativeComponents.pickerStyle!('segmented')]}
          >
            {display.map((label, i) => (
              <NativeText key={`seg-${i}`} modifiers={[nativeComponents.tag!(String(i))]}>
                {label}
              </NativeText>
            ))}
          </NativePicker>
        </NativeHost>
      </View>
    )
  }

  if (canJC) {
    const JCPicker = nativeComponents.JCPicker!
    return (
      <View style={commonStyles.segmentedWrapper}>
        <NativeHost matchContents={{ height: true }}>
          <JCPicker
            options={display}
            selectedIndex={selectedIndex}
            variant="segmented"
            onOptionSelected={(e) => {
              const idx = e?.nativeEvent?.index
              if (typeof idx === 'number' && idx >= 0 && idx < labels.length) onSelect(idx)
            }}
          />
        </NativeHost>
      </View>
    )
  }

  return (
    <PillTabBar labels={labels} activeIndex={selectedIndex} setActiveIndex={onSelect} errorCounts={errorCounts} />
  )
}

// ---------------------------------------------------------------------------
// Row actions — Move Up / Move Down / Duplicate / Insert Below / Remove.
// Shared by ArrayField and BlocksField rows.
// ---------------------------------------------------------------------------

export type RowAction = {
  key: string
  label: string
  /** SF Symbol name (iOS native menu). */
  systemImage?: string
  /** Material icon name (Android JC menu), e.g. 'filled.Delete'. */
  materialIcon?: string
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}

export const buildRowActions = (opts: {
  index: number
  count: number
  /** Lowercased noun for menu labels, e.g. 'row' or 'block'. */
  noun?: string
  minRows?: number
  maxRows?: number
  onMove: (from: number, to: number) => void
  onDuplicate: (index: number) => void
  /** Omit to skip the "Insert Below" entry (blocks add via the picker). */
  onInsertBelow?: (index: number) => void
  onRemove: (index: number) => void
}): RowAction[] => {
  const { index, count, minRows, maxRows, onMove, onDuplicate, onInsertBelow, onRemove } = opts
  const atMax = maxRows != null && count >= maxRows
  const atMin = minRows != null && count <= minRows
  const actions: RowAction[] = [
    {
      key: 'move-up',
      label: 'Move Up',
      systemImage: 'arrow.up',
      materialIcon: 'filled.KeyboardArrowUp',
      disabled: index === 0,
      onPress: () => onMove(index, index - 1),
    },
    {
      key: 'move-down',
      label: 'Move Down',
      systemImage: 'arrow.down',
      materialIcon: 'filled.KeyboardArrowDown',
      disabled: index >= count - 1,
      onPress: () => onMove(index, index + 1),
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      systemImage: 'plus.square.on.square',
      materialIcon: 'filled.AddCircle',
      disabled: atMax,
      onPress: () => onDuplicate(index),
    },
  ]
  if (onInsertBelow) {
    actions.push({
      key: 'insert-below',
      label: 'Insert Below',
      systemImage: 'arrow.turn.down.right',
      materialIcon: 'filled.Add',
      disabled: atMax,
      onPress: () => onInsertBelow(index),
    })
  }
  actions.push({
    key: 'remove',
    label: 'Remove',
    systemImage: 'trash',
    materialIcon: 'filled.Delete',
    destructive: true,
    disabled: atMin,
    onPress: () => onRemove(index),
  })
  return actions
}

/**
 * Per-row actions affordance.
 *
 * Tiers (registry-gated, platform-free):
 *  1. SwiftUI Menu — TAP on the ellipsis opens the native anchored
 *     quick-action menu (same pattern as DocumentActionsMenu). The Menu
 *     trigger also opens on touch-and-hold natively, so the previous
 *     long-press ContextMenu wrapper is redundant — and nesting both would
 *     put two competing native gesture owners on the same anchor.
 *  2. JC ContextMenu — tap the trigger opens the native Material dropdown.
 *  3. Pure JS — ellipsis Pressable opens the package BottomSheet.
 */
export const RowActionsMenu: React.FC<{
  actions: RowAction[]
  /** Sheet header, e.g. the row title. */
  title?: string
}> = ({ actions, title }) => {
  const palette = usePalette()
  const [sheetVisible, setSheetVisible] = useState(false)

  const openSheet = () => setSheetVisible(true)
  const closeSheet = () => setSheetVisible(false)

  // Tier 1 — SwiftUI Menu (iOS-shaped keys are null on Android / Expo Go).
  const Menu = nativeComponents.Menu
  const NativeButton = nativeComponents.Button
  const MenuDivider = nativeComponents.Divider
  const disabledMod = nativeComponents.disabled
  const tintMod = nativeComponents.tint
  if (Menu && NativeButton) {
    // Disabled entries grey out via the `disabled` modifier; when the factory
    // is missing they are omitted instead (never render tappable no-ops).
    const visible = actions.filter((a) => !a.disabled || disabledMod)
    const items: React.ReactNode[] = []
    visible.forEach((a, i) => {
      // Destructive entries (Remove) sit in their own group below a divider.
      if (a.destructive && i > 0 && MenuDivider) {
        items.push(<MenuDivider key={`divider-${a.key}`} />)
      }
      items.push(
        <NativeButton
          key={a.key}
          label={a.label}
          systemImage={a.systemImage}
          role={a.destructive ? 'destructive' : 'default'}
          onPress={a.disabled ? undefined : a.onPress}
          modifiers={a.disabled && disabledMod ? [disabledMod(true)] : undefined}
        />,
      )
    })
    return (
      <NativeHost matchContents>
        <Menu
          label=""
          systemImage="ellipsis.circle"
          modifiers={tintMod ? [tintMod(palette.textMuted)] : undefined}
        >
          {items}
        </Menu>
      </NativeHost>
    )
  }

  // Tier 2 — JC ContextMenu (tap-to-open dropdown). Items must be JC Buttons;
  // the trigger child must be non-interactive so the wrapper pressable wins.
  const ContextMenu = nativeComponents.ContextMenu
  const ContextMenuTrigger = nativeComponents.ContextMenuTrigger
  const ContextMenuItems = nativeComponents.ContextMenuItems
  const JCButton = nativeComponents.JCButton
  const NativeText = nativeComponents.Text
  if (ContextMenu && ContextMenuTrigger && ContextMenuItems && JCButton && NativeText) {
    return (
      <NativeHost matchContents>
        <ContextMenu>
          <ContextMenuItems>
            {actions.map((a) => (
              <JCButton
                key={a.key}
                variant="borderless"
                leadingIcon={a.materialIcon}
                disabled={a.disabled}
                onPress={a.onPress}
                color={a.destructive ? palette.destructive : undefined}
              >
                {a.label}
              </JCButton>
            ))}
          </ContextMenuItems>
          <ContextMenuTrigger>
            <NativeText>{'⋯'}</NativeText>
          </ContextMenuTrigger>
        </ContextMenu>
      </NativeHost>
    )
  }

  // Tier 3 — pure JS fallback (Expo Go safe): ellipsis opens the BottomSheet.
  const sheetHeight = Math.min(0.5, (actions.length * 52 + 110) / 800)
  return (
    <>
      <Pressable onPress={openSheet} hitSlop={8} style={commonStyles.ellipsisBtn}>
        <Text style={[commonStyles.ellipsisText, { color: palette.textMuted }]}>{'⋯'}</Text>
      </Pressable>
      <BottomSheet visible={sheetVisible} onClose={closeSheet} height={sheetHeight}>
        <Text style={[commonStyles.sheetTitle, { color: palette.text }]}>{title || 'Row Actions'}</Text>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            disabled={action.disabled}
            style={({ pressed }) => [
              commonStyles.sheetRow,
              pressed && { backgroundColor: palette.cardBg },
            ]}
            onPress={() => {
              closeSheet()
              action.onPress()
            }}
          >
            <Text
              style={[
                commonStyles.sheetRowLabel,
                { color: action.destructive ? palette.destructive : palette.text },
                action.disabled && { color: palette.textFaint },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </BottomSheet>
    </>
  )
}

// ---------------------------------------------------------------------------
// Add button — three-tier, liquid-glass on iOS 26+.
// ---------------------------------------------------------------------------

export const AddRowButton: React.FC<{
  label: string
  onPress: () => void
  /** maxRows reached — render the affordance disabled. */
  disabled?: boolean
}> = ({ label, onPress, disabled }) => {
  const palette = usePalette()

  // Tier 1 — SwiftUI Button (glass on iOS 26+, bordered otherwise).
  const NativeButton = nativeComponents.Button
  const buttonStyleMod = nativeComponents.buttonStyle
  const disabledMod = nativeComponents.disabled
  if (NativeButton) {
    const modifiers = [
      ...(buttonStyleMod ? [buttonStyleMod(liquidGlassAvailable ? 'glass' : 'bordered')] : []),
      ...(disabled && disabledMod ? [disabledMod(true)] : []),
    ]
    return (
      <View style={commonStyles.addBtnWrapper}>
        <NativeHost matchContents>
          <NativeButton
            label={label}
            systemImage="plus"
            onPress={disabled ? undefined : onPress}
            modifiers={modifiers.length > 0 ? modifiers : undefined}
          />
        </NativeHost>
      </View>
    )
  }

  // Tier 2 — JC Button (Material tonal style).
  const JCButton = nativeComponents.JCButton
  if (JCButton) {
    return (
      <View style={commonStyles.addBtnWrapper}>
        <NativeHost matchContents>
          <JCButton variant="outlined" leadingIcon="filled.Add" disabled={disabled} onPress={onPress}>
            {label}
          </JCButton>
        </NativeHost>
      </View>
    )
  }

  // Tier 3 — pure JS (GlassView pressable on iOS 26+, plain otherwise).
  if (liquidGlassAvailable && GlassView) {
    return (
      <Pressable onPress={disabled ? undefined : onPress} style={disabled && commonStyles.addBtnDisabled}>
        <GlassView style={commonStyles.glassAddBtn} isInteractive glassEffectStyle="regular">
          <Text style={[commonStyles.addText, { color: palette.primary }]}>+ {label}</Text>
        </GlassView>
      </Pressable>
    )
  }
  return (
    <Pressable
      style={[commonStyles.addBtn, disabled && commonStyles.addBtnDisabled]}
      onPress={disabled ? undefined : onPress}
    >
      <Text style={[commonStyles.addText, { color: palette.primary }]}>+ {label}</Text>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Shared styles (layout/spacing only — colours resolve via usePalette)
// ---------------------------------------------------------------------------

export const commonStyles = StyleSheet.create({
  widthRow: { flexDirection: 'row' as const, gap: t.spacing.md },

  // Error badge (collapsible, tabs, array/block rows)
  errorBadge: {
    backgroundColor: t.colors.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: t.spacing.xs,
  },
  errorBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Segmented picker wrapper
  segmentedWrapper: { marginBottom: t.spacing.sm },

  // Pill tab bar
  pillScroll: { marginBottom: t.spacing.sm },
  pillBar: {
    flexDirection: 'row',
    borderRadius: 9,
    padding: 2,
    marginBottom: t.spacing.sm,
    gap: 1,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: t.spacing.sm,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  pillFlex: { flex: 1 },
  pillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  pillText: { fontSize: t.fontSize.sm, fontWeight: '500' },
  pillTextActive: { fontWeight: '600' },

  // Row actions
  ellipsisBtn: { paddingHorizontal: 4 },
  ellipsisText: { fontSize: 20, fontWeight: '700' },
  sheetTitle: { fontSize: t.fontSize.lg, fontWeight: '700', marginBottom: t.spacing.md },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
  },
  sheetRowLabel: { fontSize: t.fontSize.md, fontWeight: '500' },

  // Add button
  addBtnWrapper: { marginTop: t.spacing.sm, alignItems: 'center' as const },
  addBtn: { paddingVertical: t.spacing.sm, marginTop: t.spacing.xs, alignItems: 'center' as const },
  glassAddBtn: {
    paddingVertical: t.spacing.sm,
    marginTop: t.spacing.xs,
    borderRadius: t.borderRadius.sm,
    alignItems: 'center' as const,
  },
  addBtnDisabled: { opacity: 0.4 },
  addText: { fontSize: t.fontSize.sm, fontWeight: '500' },
})
