/**
 * Type definitions for the native component registry.
 *
 * Extracted into a standalone file (no .ios.ts / .android.ts variants)
 * so Metro platform resolution doesn't cause circular imports.
 *
 * Conventions:
 * - Every entry is nullable. ALWAYS null-check before use — entries are null
 *   on platforms where the component doesn't exist (and in Expo Go).
 * - iOS-shaped keys (SwiftUI canary surface) are null on Android.
 * - `JC*`-prefixed keys are Jetpack Compose components whose API shape
 *   diverges from the iOS counterpart (documented inline). They are null
 *   on iOS. Never overload an iOS-shaped key with a JC component.
 * - Modifier entries are FACTORY FUNCTIONS returning `{ $type, ... }`
 *   configs. Always call them (`pickerStyle!('segmented')`) — never pass
 *   object literals (missing $type = silently ignored).
 */
import type React from 'react'

/** SwiftUI modifier config produced by @expo/ui modifier factories. */
export type NativeModifier = { $type: string; [key: string]: unknown }

/** Jetpack Compose modifier config produced by @expo/ui jetpack-compose helpers. */
export type JCModifier = { $type: string; $scope?: string; [key: string]: unknown }

export type NativeComponentRegistry = {
  /** Whether any native @expo/ui components are available. */
  isAvailable: boolean

  // ───────────────────────────────────────────────────────────────────────
  // Shared / iOS-shaped components (SwiftUI canary; some also map on Android
  // when the JC API shape is compatible — see native.android.ts)
  // ───────────────────────────────────────────────────────────────────────

  /** Platform-appropriate Host wrapper. */
  Host: React.ComponentType<{
    matchContents?: boolean | { vertical?: boolean; horizontal?: boolean }
    colorScheme?: 'light' | 'dark' | null
    ignoreSafeArea?: 'all' | 'keyboard'
    onLayoutContent?: (event: { nativeEvent: { width: number; height: number } }) => void
    style?: any
    children: React.ReactNode
  }> | null

  /** Native toggle/switch. SwiftUI Toggle (iOS only — see JCSwitch for Android). */
  Toggle: React.ComponentType<{
    isOn?: boolean
    label?: string
    systemImage?: string
    onIsOnChange?: (isOn: boolean) => void
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** Native date picker. SwiftUI DatePicker (iOS only — see JCDateTimePicker for Android). */
  DatePicker: React.ComponentType<{
    title?: string
    selection?: Date
    range?: { start?: Date; end?: Date }
    displayedComponents?: Array<'date' | 'hourAndMinute'>
    onDateChange?: (date: Date) => void
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** Native picker (single-select, tag-based). SwiftUI Picker (iOS only — see JCPicker for Android). */
  Picker: React.ComponentType<{
    selection?: string | number | null
    onSelectionChange?: (selection: string | number | null) => void
    label?: string | React.ReactNode
    systemImage?: string
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** Native disclosure/accordion. iOS only (SwiftUI DisclosureGroup). */
  DisclosureGroup: React.ComponentType<{
    label: string
    isExpanded?: boolean
    onIsExpandedChange?: (isExpanded: boolean) => void
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** Native text. SwiftUI Text (iOS) / JC layout Text (Android — children/modifiers compatible). */
  Text: React.ComponentType<{
    children?: React.ReactNode
    markdownEnabled?: boolean
    modifiers?: NativeModifier[] | JCModifier[]
  }> | null

  /** Native bottom sheet (SwiftUI .sheet presentation; iOS only — see JCBottomSheet for Android). */
  BottomSheet: React.ComponentType<{
    isPresented: boolean
    onIsPresentedChange: (isPresented: boolean) => void
    fitToContents?: boolean
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** Group wrapper for applying SwiftUI modifiers to children. iOS only. */
  Group: React.ComponentType<{
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** Native button. SwiftUI Button (iOS only — see JCButton for Android). */
  Button: React.ComponentType<{
    onPress?: () => void
    systemImage?: string
    role?: 'default' | 'cancel' | 'destructive'
    label?: string
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /**
   * Native control group. SwiftUI ControlGroup.
   * ALWAYS NULL: the canary @expo/ui (55.0.0-canary-20260128) does not export
   * ControlGroup. Key kept so existing gates (RichTextToolbar) keep falling
   * back to their JS toolbar path without a type break.
   */
  ControlGroup: React.ComponentType<{
    label?: string | React.ReactNode
    systemImage?: string
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  // ── Form primitives (iOS 16+) ──

  /** Native form container. SwiftUI Form — renders grouped table with automatic styling. */
  Form: React.ComponentType<{
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** Native form section. Groups fields with optional title/header/footer. */
  Section: React.ComponentType<{
    title?: string
    header?: React.ReactNode
    footer?: React.ReactNode
    isExpanded?: boolean
    onIsExpandedChange?: (isExpanded: boolean) => void
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** Native labeled content. "Label: [value]" inline row — the iOS Mail/Settings pattern. */
  LabeledContent: React.ComponentType<{
    label?: string | React.ReactNode
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  // ── List (iOS 16+) ──

  /** SwiftUI List. Supports selection. Use ListForEach inside for move/delete. iOS only. */
  List: React.ComponentType<{
    children: React.ReactNode
    selection?: Array<string | number>
    onSelectionChange?: (selection: Array<string | number>) => void
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI ForEach inside a List — enables swipe-to-delete and drag-to-reorder. iOS only. */
  ListForEach: React.ComponentType<{
    children: React.ReactNode
    onDelete?: (indices: number[]) => void
    onMove?: (sourceIndices: number[], destination: number) => void
    modifiers?: NativeModifier[]
  }> | null

  // ── Inputs (iOS) ──

  /**
   * SwiftUI TextField. UNCONTROLLED: defaultValue + onChangeText; set
   * programmatically via ref.setText or key-remount. iOS only — see JCTextInput.
   */
  TextField: React.ComponentType<{
    ref?: any
    defaultValue?: string
    placeholder?: string
    onChangeText?: (value: string) => void
    onChangeFocus?: (focused: boolean) => void
    onSubmit?: (value: string) => void
    multiline?: boolean
    allowNewlines?: boolean
    numberOfLines?: number
    keyboardType?: string
    autocorrection?: boolean
    autoFocus?: boolean
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI SecureField (password input). UNCONTROLLED like TextField. iOS only. */
  SecureField: React.ComponentType<{
    ref?: any
    defaultValue?: string
    placeholder?: string
    onChangeText?: (value: string) => void
    onSubmit?: (value: string) => void
    onChangeFocus?: (focused: boolean) => void
    keyboardType?: string
    autoFocus?: boolean
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI Stepper (- / + control). UNCONTROLLED: defaultValue + onValueChanged. iOS only. */
  Stepper: React.ComponentType<{
    label: string
    defaultValue?: number
    step?: number
    min?: number
    max?: number
    onValueChanged: (value: number) => void
    modifiers?: NativeModifier[]
  }> | null

  /** Native slider. Common shape (value/min/max/onValueChange) works on BOTH platforms. */
  Slider: React.ComponentType<{
    value?: number
    /** iOS: `step`. Android JC uses `steps` (tick count) — pass per-platform. */
    step?: number
    steps?: number
    min?: number
    max?: number
    label?: React.ReactNode
    onValueChange?: (value: number) => void
    onEditingChanged?: (isEditing: boolean) => void
    modifiers?: NativeModifier[] | JCModifier[]
  }> | null

  /** SwiftUI Gauge (read-only value display). iOS 16+ only. */
  Gauge: React.ComponentType<{
    value: number
    min?: number
    max?: number
    children?: React.ReactNode
    currentValueLabel?: React.ReactNode
    minimumValueLabel?: React.ReactNode
    maximumValueLabel?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI ColorPicker. selection is a hex string. iOS only. */
  ColorPicker: React.ComponentType<{
    selection: string | null
    label?: string
    onSelectionChange?: (value: string) => void
    supportsOpacity?: boolean
    modifiers?: NativeModifier[]
  }> | null

  // ── Menus & presentation (iOS) ──

  /** SwiftUI Menu (tap-to-open pulldown). children are Buttons/Pickers/Toggles. iOS only. */
  Menu: React.ComponentType<{
    label: string | React.ReactNode
    systemImage?: string
    onPrimaryAction?: () => void
    children: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** ContextMenu (long-press menu). Compose with ContextMenuTrigger/Items/Preview children. */
  ContextMenu: React.ComponentType<{
    children: React.ReactNode
    modifiers?: NativeModifier[] | JCModifier[]
  }> | null

  /** ContextMenu.Trigger — the visible element that owns the long-press. Both platforms. */
  ContextMenuTrigger: React.ComponentType<{ children: React.ReactNode }> | null

  /** ContextMenu.Items — menu entries (Buttons, Toggles, Pickers, submenus). Both platforms. */
  ContextMenuItems: React.ComponentType<{ children: React.ReactNode }> | null

  /** ContextMenu.Preview — optional custom preview shown while the menu is open. */
  ContextMenuPreview: React.ComponentType<{ children: React.ReactNode }> | null

  /** SwiftUI Popover (anchored floating panel). Compose with PopoverTrigger/PopoverContent. iOS only. */
  Popover: React.ComponentType<{
    children: React.ReactNode
    isPresented?: boolean
    onIsPresentedChange?: (isPresented: boolean) => void
    attachmentAnchor?: 'leading' | 'trailing' | 'center' | 'top' | 'bottom'
    arrowEdge?: 'leading' | 'trailing' | 'top' | 'bottom' | 'none'
    modifiers?: NativeModifier[]
  }> | null

  /** Popover.Trigger — anchor element. iOS only. */
  PopoverTrigger: React.ComponentType<{ children: React.ReactNode }> | null

  /** Popover.Content — popover body. iOS only. */
  PopoverContent: React.ComponentType<{ children: React.ReactNode }> | null

  /** SwiftUI ShareLink — native share sheet button. iOS only. */
  ShareLink: React.ComponentType<{
    item?: string
    getItemAsync?: () => Promise<string>
    subject?: string
    message?: string
    preview?: { title: string; image: string }
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  // ── Display (iOS) ──

  /** SwiftUI Label (title + SF Symbol icon). iOS only. */
  Label: React.ComponentType<{
    title?: string
    systemImage?: string
    icon?: React.ReactNode
    color?: string
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI Image (SF Symbols only). iOS only. */
  Image: React.ComponentType<{
    systemName: string
    size?: number
    color?: string
    variableValue?: number
    onPress?: () => void
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI ProgressView (spinner when value undefined, bar otherwise). iOS only. */
  ProgressView: React.ComponentType<{
    value?: number | null
    timerInterval?: { lower: Date; upper: Date }
    countsDown?: boolean
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** Swift Charts wrapper (line/point/bar/area/pie/rectangle). iOS only. */
  Chart: React.ComponentType<{
    data: Array<{ x: string | number; y: number; color?: string }>
    type?: 'line' | 'point' | 'bar' | 'area' | 'pie' | 'rectangle'
    style?: any
    [key: string]: any
  }> | null

  /** SwiftUI ContentUnavailableView (empty-state placeholder). iOS 17+ only. */
  ContentUnavailableView: React.ComponentType<{
    title?: string
    systemImage?: string
    description?: string
    modifiers?: NativeModifier[]
  }> | null

  /** Native divider/separator hairline. Both platforms. */
  Divider: React.ComponentType<{
    modifiers?: NativeModifier[] | JCModifier[]
  }> | null

  // ── Layout (iOS) ──

  /** SwiftUI HStack. iOS only. */
  HStack: React.ComponentType<{
    children: React.ReactNode
    spacing?: number
    alignment?: 'top' | 'center' | 'bottom' | 'firstTextBaseline' | 'lastTextBaseline'
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI VStack. iOS only. */
  VStack: React.ComponentType<{
    children: React.ReactNode
    spacing?: number
    alignment?: 'leading' | 'center' | 'trailing'
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI ZStack. iOS only. */
  ZStack: React.ComponentType<{
    children: React.ReactNode
    alignment?: string
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI Spacer. iOS only. */
  Spacer: React.ComponentType<{
    minLength?: number
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI Grid. Use GridRow for rows. iOS only. */
  Grid: React.ComponentType<{
    children: React.ReactNode
    alignment?: string
    verticalSpacing?: number
    horizontalSpacing?: number
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI Grid.Row. iOS only. */
  GridRow: React.ComponentType<{ children: React.ReactNode }> | null

  // ── Liquid glass (iOS 26+) ──

  /** GlassEffectContainer — groups glassEffect views so they can morph/blend. iOS only. */
  GlassEffectContainer: React.ComponentType<{
    children: React.ReactNode
    spacing?: number
    modifiers?: NativeModifier[]
  }> | null

  /** SwiftUI Namespace provider — needed for glassEffectId/matchedGeometryEffect. iOS only. */
  Namespace: React.ComponentType<{
    id: string
    children: React.ReactNode
  }> | null

  // ───────────────────────────────────────────────────────────────────────
  // SwiftUI modifier factories (iOS only — all null on Android)
  // ───────────────────────────────────────────────────────────────────────

  /** Modifier factory: `tag` for Picker options. */
  tag: ((value: string | number) => NativeModifier) | null

  /** Modifier factory: `pickerStyle` ('automatic' | 'menu' | 'segmented' | 'wheel' | 'inline' | 'palette'). */
  pickerStyle: ((style: string) => NativeModifier) | null

  /** Modifier factory: `datePickerStyle` ('automatic' | 'compact' | 'graphical' | 'wheel'). */
  datePickerStyle: ((style: string) => NativeModifier) | null

  /** Modifier factory: `toggleStyle` ('automatic' | 'switch' | 'button'). */
  toggleStyle: ((style: 'automatic' | 'switch' | 'button') => NativeModifier) | null

  /** Modifier factory: `textFieldStyle` ('automatic' | 'plain' | 'roundedBorder'). */
  textFieldStyle: ((style: 'automatic' | 'plain' | 'roundedBorder') => NativeModifier) | null

  /** Modifier factory: `buttonStyle` (incl. 'glass' / 'glassProminent' on iOS 26+). */
  buttonStyle: ((style: 'automatic' | 'bordered' | 'borderedProminent' | 'borderless' | 'glass' | 'glassProminent' | 'plain') => NativeModifier) | null

  /** Modifier factory: `labelsHidden` — hides the built-in label of a control. */
  labelsHidden: (() => NativeModifier) | null

  /** Modifier factory: `controlSize`. */
  controlSize: ((size: 'mini' | 'small' | 'regular' | 'large' | 'extraLarge') => NativeModifier) | null

  /** Modifier factory: `tint` color. */
  tint: ((color: string) => NativeModifier) | null

  /** Modifier factory: `foregroundColor`. */
  foregroundColor: ((color: string) => NativeModifier) | null

  /** Modifier factory: `font` ({ family?, size?, weight?, design? } per canary). */
  font: ((params: { family?: string; size?: number; weight?: string; design?: string }) => NativeModifier) | null

  /** Modifier factory: `badge` — trailing badge text/count on list rows and tabs. */
  badge: ((value?: string) => NativeModifier) | null

  /**
   * Modifier factory: `glassEffect` (iOS 26+ liquid glass).
   * NEVER apply with interactive:true to gesture-owning controls (Picker/Toggle/Button).
   */
  glassEffect: ((params?: { glass?: { variant?: string; interactive?: boolean }; tint?: string; shape?: string }) => NativeModifier) | null

  /** Modifier factory: `glassEffectId(id, namespaceId)` — pairs with Namespace for morphing. */
  glassEffectId: ((id: string, namespaceId: string) => NativeModifier) | null

  /** Modifier factory: `presentationDetents` for sheets. */
  presentationDetents: ((detents: Array<'medium' | 'large' | { fraction: number } | { height: number }>) => NativeModifier) | null

  /** Modifier factory: `presentationDragIndicator`. */
  presentationDragIndicator: ((visibility: 'automatic' | 'visible' | 'hidden') => NativeModifier) | null

  /** Modifier factory: `presentationBackgroundInteraction` (iOS 16.4+). */
  presentationBackgroundInteraction: ((interaction: 'automatic' | 'enabled' | 'disabled' | { type: 'enabledUpThrough'; detent: 'medium' | 'large' | { fraction: number } | { height: number } }) => NativeModifier) | null

  /** Modifier factory: `interactiveDismissDisabled` — blocks swipe-to-dismiss on sheets. */
  interactiveDismissDisabled: ((isDisabled?: boolean) => NativeModifier) | null

  /** Modifier factory: `listStyle` ('automatic' | 'plain' | 'inset' | 'insetGrouped' | 'grouped' | 'sidebar'). */
  listStyle: ((style: 'automatic' | 'plain' | 'inset' | 'insetGrouped' | 'grouped' | 'sidebar') => NativeModifier) | null

  /** Modifier factory: `listRowBackground` color. */
  listRowBackground: ((color: string) => NativeModifier) | null

  /** Modifier factory: `listRowInsets`. */
  listRowInsets: ((params: { top?: number; leading?: number; bottom?: number; trailing?: number }) => NativeModifier) | null

  /** Modifier factory: `listSectionSpacing` (iOS 17+). */
  listSectionSpacing: ((spacing: 'default' | 'compact' | number) => NativeModifier) | null

  /** Modifier factory: `scrollContentBackground` — hide to show custom backgrounds behind Form/List. */
  scrollContentBackground: ((visible: 'automatic' | 'visible' | 'hidden') => NativeModifier) | null

  /** Modifier factory: `frame`. */
  frame: ((params: { width?: number; height?: number; minWidth?: number; idealWidth?: number; maxWidth?: number; minHeight?: number; idealHeight?: number; maxHeight?: number; alignment?: string }) => NativeModifier) | null

  /** Modifier factory: `padding`. */
  padding: ((params?: { all?: number; horizontal?: number; vertical?: number; top?: number; bottom?: number; leading?: number; trailing?: number }) => NativeModifier) | null

  /** Modifier factory: `fixedSize` — view keeps its intrinsic size. */
  fixedSize: ((params?: { horizontal?: boolean; vertical?: boolean }) => NativeModifier) | null

  /** Modifier factory: `background(color, shape?)`. */
  background: ((color: string, shape?: any) => NativeModifier) | null

  /** Modifier factory: `cornerRadius`. */
  cornerRadius: ((radius: number) => NativeModifier) | null

  /** Modifier factory: `clipShape` ('rectangle' | 'circle' | 'roundedRectangle'). */
  clipShape: ((shape: 'rectangle' | 'circle' | 'roundedRectangle', cornerRadius?: number) => NativeModifier) | null

  /** Modifier factory: `onTapGesture`. */
  onTapGesture: ((handler: () => void) => NativeModifier) | null

  /** Modifier factory: `onAppear`. */
  onAppear: ((handler: () => void) => NativeModifier) | null

  /** Modifier factory: `onDisappear`. */
  onDisappear: ((handler: () => void) => NativeModifier) | null

  /** Modifier factory: `refreshable` — pull-to-refresh on List/Form. */
  refreshable: ((handler: () => void) => NativeModifier) | null

  /** Modifier factory: `animation(animationObject, animatedValue)` — see @expo/ui Animation builder. */
  animation: ((animationObject: any, animatedValue: number | boolean) => NativeModifier) | null

  /** Modifier factory: `matchedGeometryEffect(id, namespaceId)`. */
  matchedGeometryEffect: ((id: string, namespaceId: string) => NativeModifier) | null

  /** Modifier factory: `scrollDisabled`. */
  scrollDisabled: ((disabled?: boolean) => NativeModifier) | null

  /** Modifier factory: `scrollDismissesKeyboard`. */
  scrollDismissesKeyboard: ((mode: 'automatic' | 'never' | 'interactively' | 'immediately') => NativeModifier) | null

  /** Modifier factory: `disabled` — disables user interaction. */
  disabled: ((disabled?: boolean) => NativeModifier) | null

  /**
   * Modifier factory: `formStyle`.
   * ALWAYS NULL: not exported by the canary @expo/ui modifiers. Key kept for
   * forward compatibility — gate on it before use.
   */
  formStyle: ((style: 'automatic' | 'grouped' | 'columns') => NativeModifier) | null

  // ───────────────────────────────────────────────────────────────────────
  // Jetpack Compose components (Android only — all null on iOS).
  // Distinct keys because the JC API shapes diverge from SwiftUI.
  // ───────────────────────────────────────────────────────────────────────

  /** JC Button. Props: { onPress?, children?: string|JSX, variant?: 'default'|'bordered'|'borderless'|'outlined'|'elevated', systemImage?: MaterialIcon, leadingIcon?, trailingIcon?, elementColors?, color?, disabled?, modifiers? }. Text goes in children (not `label`); icons are Material names (not SF Symbols). */
  JCButton: React.ComponentType<{
    onPress?: () => void
    leadingIcon?: string
    trailingIcon?: string
    systemImage?: string
    variant?: 'default' | 'bordered' | 'borderless' | 'outlined' | 'elevated'
    children?: string | string[] | React.JSX.Element
    elementColors?: { containerColor?: string; contentColor?: string; disabledContainerColor?: string; disabledContentColor?: string }
    color?: string
    disabled?: boolean
    modifiers?: JCModifier[]
  }> | null

  /** JC IconButton. Props: { onPress?, variant?: 'default'|'bordered'|'outlined', children?: JSX (icon), elementColors?, color?, disabled?, modifiers? }. */
  JCIconButton: React.ComponentType<{
    onPress?: () => void
    variant?: 'default' | 'bordered' | 'outlined'
    children?: React.JSX.Element
    elementColors?: { containerColor?: string; contentColor?: string }
    color?: string
    disabled?: boolean
    modifiers?: JCModifier[]
  }> | null

  /** JC Chip (Material assist/filter/input/suggestion chips). Props: { variant?, label, leadingIcon?, trailingIcon?, selected?, enabled?, onPress?, onDismiss?, modifiers? }. */
  JCChip: React.ComponentType<{
    variant?: 'assist' | 'filter' | 'input' | 'suggestion'
    label: string
    leadingIcon?: string
    trailingIcon?: string
    iconSize?: number
    textStyle?: string
    enabled?: boolean
    selected?: boolean
    onPress?: () => void
    onDismiss?: () => void
    modifiers?: JCModifier[]
  }> | null

  /** JC Switch/Checkbox. Props: { value: boolean, onValueChange?, label?, variant?: 'switch'|'checkbox'|'button', color?, elementColors?, modifiers? }. Note: `value`/`onValueChange` (NOT isOn/onIsOnChange like iOS Toggle). */
  JCSwitch: React.ComponentType<{
    value: boolean
    label?: string
    variant?: 'checkbox' | 'switch' | 'button'
    onValueChange?: (value: boolean) => void
    color?: string
    elementColors?: Record<string, string>
    modifiers?: JCModifier[]
  }> | null

  /** JC TextInput. UNCONTROLLED: { defaultValue?, onChangeText, multiline?, numberOfLines?, keyboardType?, autocorrection?, autoCapitalize?, modifiers?, ref?.setText }. No placeholder prop. */
  JCTextInput: React.ComponentType<{
    ref?: any
    defaultValue?: string
    onChangeText: (value: string) => void
    multiline?: boolean
    numberOfLines?: number
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'ascii-capable' | 'url' | 'decimal-pad'
    autocorrection?: boolean
    autoCapitalize?: 'characters' | 'none' | 'sentences' | 'unspecified' | 'words'
    modifiers?: JCModifier[]
  }> | null

  /** JC Picker. Options-based (NOT tag-based like iOS): { options: string[], selectedIndex: number|null, onOptionSelected?({nativeEvent:{index,label}}), variant?: 'segmented'|'radio', elementColors?, color?, modifiers? }. */
  JCPicker: React.ComponentType<{
    options: string[]
    selectedIndex: number | null
    onOptionSelected?: (event: { nativeEvent: { index: number; label: string } }) => void
    variant?: 'segmented' | 'radio'
    elementColors?: Record<string, string>
    color?: string
    modifiers?: JCModifier[]
    buttonModifiers?: JCModifier[]
  }> | null

  /** JC BottomSheet. Props: { isOpened: boolean, onIsOpenedChange: (opened) => void, skipPartiallyExpanded?, children } (NOT isPresented like iOS). */
  JCBottomSheet: React.ComponentType<{
    isOpened: boolean
    onIsOpenedChange: (isOpened: boolean) => void
    skipPartiallyExpanded?: boolean
    children: React.ReactNode
  }> | null

  /** JC AlertDialog (Material dialog; no iOS equivalent in canary). Props: { visible?, title?, text?, confirmButtonText?, dismissButtonText?, onConfirmPressed?, onDismissPressed?, modifiers? }. */
  JCAlertDialog: React.ComponentType<{
    visible?: boolean
    title?: string
    text?: string
    confirmButtonText?: string
    dismissButtonText?: string
    confirmButtonColors?: { containerColor?: string; contentColor?: string }
    dismissButtonColors?: { containerColor?: string; contentColor?: string }
    onConfirmPressed?: () => void
    onDismissPressed?: () => void
    modifiers?: JCModifier[]
  }> | null

  /** JC DateTimePicker. Props: { initialDate?: ISO string|null, onDateSelected?(date: Date), variant?: 'picker'|'input', displayedComponents?: 'date'|'hourAndMinute'|'dateAndTime', is24Hour?, showVariantToggle?, color?, modifiers? } (NOT selection/onDateChange like iOS). */
  JCDateTimePicker: React.ComponentType<{
    initialDate?: string | null
    onDateSelected?: (date: Date) => void
    variant?: 'picker' | 'input'
    showVariantToggle?: boolean
    displayedComponents?: 'date' | 'hourAndMinute' | 'dateAndTime'
    color?: string
    is24Hour?: boolean
    modifiers?: JCModifier[]
  }> | null

  /** JC CircularProgress (spinner when progress null/undefined). Props: { progress?: number|null, color?, elementColors?: { trackColor? }, modifiers? }. */
  JCCircularProgress: React.ComponentType<{
    progress?: number | null
    color?: string
    elementColors?: { trackColor?: string }
    modifiers?: JCModifier[]
  }> | null

  /** JC LinearProgress (bar). Props: { progress?: number|null, color?, elementColors?: { trackColor? }, modifiers? }. */
  JCLinearProgress: React.ComponentType<{
    progress?: number | null
    color?: string
    elementColors?: { trackColor?: string }
    modifiers?: JCModifier[]
  }> | null

  /** JC layout Box (Compose Box). Props: { children?, modifiers? }. */
  JCBox: React.ComponentType<{
    children?: React.ReactNode
    modifiers?: JCModifier[]
  }> | null

  /** JC layout Row. Props: { children?, horizontalArrangement?, verticalAlignment?, modifiers? }. */
  JCRow: React.ComponentType<{
    children?: React.ReactNode
    horizontalArrangement?: 'start' | 'end' | 'center' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly'
    verticalAlignment?: 'top' | 'bottom' | 'center'
    modifiers?: JCModifier[]
  }> | null

  /** JC layout Column. Props: { children?, verticalArrangement?, horizontalAlignment?, modifiers? }. */
  JCColumn: React.ComponentType<{
    children?: React.ReactNode
    verticalArrangement?: 'top' | 'bottom' | 'center' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly'
    horizontalAlignment?: 'start' | 'end' | 'center'
    modifiers?: JCModifier[]
  }> | null

  /** JC Shape constructors namespace: { Star, PillStar, Pill, Circle, Rectangle, Polygon }. Shape JSX is used by jcClip and Button `shape`. */
  JCShape: {
    Star: (props: any) => any
    PillStar: (props: any) => any
    Pill: (props: any) => any
    Circle: (props: any) => any
    Rectangle: (props: any) => any
    Polygon: (props: any) => any
  } | null

  // ── Jetpack Compose modifier helpers (Android only — positional args, unlike SwiftUI) ──

  /** JC modifier: padding(all) in dp. */
  jcPaddingAll: ((all: number) => JCModifier) | null
  /** JC modifier: padding(start, top, end, bottom) in dp. */
  jcPadding: ((start: number, top: number, end: number, bottom: number) => JCModifier) | null
  /** JC modifier: exact size(width, height) in dp. */
  jcSize: ((width: number, height: number) => JCModifier) | null
  /** JC modifier: fillMaxSize(fraction?). */
  jcFillMaxSize: ((fraction?: number) => JCModifier) | null
  /** JC modifier: fillMaxWidth(fraction?). */
  jcFillMaxWidth: ((fraction?: number) => JCModifier) | null
  /** JC modifier: fillMaxHeight(fraction?). */
  jcFillMaxHeight: ((fraction?: number) => JCModifier) | null
  /** JC modifier: offset(x, y) in dp. */
  jcOffset: ((x: number, y: number) => JCModifier) | null
  /** JC modifier: background(hexColor). */
  jcBackground: ((color: string) => JCModifier) | null
  /** JC modifier: border(width, hexColor). */
  jcBorder: ((borderWidth: number, borderColor: string) => JCModifier) | null
  /** JC modifier: shadow(elevation). */
  jcShadow: ((elevation: number) => JCModifier) | null
  /** JC modifier: alpha(0-1). */
  jcAlpha: ((alpha: number) => JCModifier) | null
  /** JC modifier: blur(radius). */
  jcBlur: ((radius: number) => JCModifier) | null
  /** JC modifier: rotate(degrees). */
  jcRotate: ((degrees: number) => JCModifier) | null
  /** JC modifier: zIndex(index). */
  jcZIndex: ((index: number) => JCModifier) | null
  /** JC modifier: animateContentSize(dampingRatio?, stiffness?). */
  jcAnimateContentSize: ((dampingRatio?: number, stiffness?: number) => JCModifier) | null
  /** JC modifier: weight(value) — only inside JCRow/JCColumn. */
  jcWeight: ((weight: number) => JCModifier) | null
  /** JC modifier: matchParentSize() — only inside JCBox. */
  jcMatchParentSize: (() => JCModifier) | null
  /** JC modifier: clickable(callback). */
  jcClickable: ((callback: () => void) => JCModifier) | null
  /** JC modifier: testID(tag). */
  jcTestID: ((tag: string) => JCModifier) | null
  /** JC modifier: clip(shapeJSX) — pass a JCShape element. */
  jcClip: ((shape: any) => JCModifier) | null
}

/** Empty registry — all components null, nothing available. */
export const emptyRegistry: NativeComponentRegistry = {
  isAvailable: false,
  Host: null,
  Toggle: null,
  DatePicker: null,
  Picker: null,
  DisclosureGroup: null,
  Text: null,
  BottomSheet: null,
  Group: null,
  Button: null,
  ControlGroup: null,
  Form: null,
  Section: null,
  LabeledContent: null,
  List: null,
  ListForEach: null,
  TextField: null,
  SecureField: null,
  Stepper: null,
  Slider: null,
  Gauge: null,
  ColorPicker: null,
  Menu: null,
  ContextMenu: null,
  ContextMenuTrigger: null,
  ContextMenuItems: null,
  ContextMenuPreview: null,
  Popover: null,
  PopoverTrigger: null,
  PopoverContent: null,
  ShareLink: null,
  Label: null,
  Image: null,
  ProgressView: null,
  Chart: null,
  ContentUnavailableView: null,
  Divider: null,
  HStack: null,
  VStack: null,
  ZStack: null,
  Spacer: null,
  Grid: null,
  GridRow: null,
  GlassEffectContainer: null,
  Namespace: null,
  tag: null,
  pickerStyle: null,
  datePickerStyle: null,
  toggleStyle: null,
  textFieldStyle: null,
  buttonStyle: null,
  labelsHidden: null,
  controlSize: null,
  tint: null,
  foregroundColor: null,
  font: null,
  badge: null,
  glassEffect: null,
  glassEffectId: null,
  presentationDetents: null,
  presentationDragIndicator: null,
  presentationBackgroundInteraction: null,
  interactiveDismissDisabled: null,
  listStyle: null,
  listRowBackground: null,
  listRowInsets: null,
  listSectionSpacing: null,
  scrollContentBackground: null,
  frame: null,
  padding: null,
  fixedSize: null,
  background: null,
  cornerRadius: null,
  clipShape: null,
  onTapGesture: null,
  onAppear: null,
  onDisappear: null,
  refreshable: null,
  animation: null,
  matchedGeometryEffect: null,
  scrollDisabled: null,
  scrollDismissesKeyboard: null,
  disabled: null,
  formStyle: null,
  JCButton: null,
  JCIconButton: null,
  JCChip: null,
  JCSwitch: null,
  JCTextInput: null,
  JCPicker: null,
  JCBottomSheet: null,
  JCAlertDialog: null,
  JCDateTimePicker: null,
  JCCircularProgress: null,
  JCLinearProgress: null,
  JCBox: null,
  JCRow: null,
  JCColumn: null,
  JCShape: null,
  jcPaddingAll: null,
  jcPadding: null,
  jcSize: null,
  jcFillMaxSize: null,
  jcFillMaxWidth: null,
  jcFillMaxHeight: null,
  jcOffset: null,
  jcBackground: null,
  jcBorder: null,
  jcShadow: null,
  jcAlpha: null,
  jcBlur: null,
  jcRotate: null,
  jcZIndex: null,
  jcAnimateContentSize: null,
  jcWeight: null,
  jcMatchParentSize: null,
  jcClickable: null,
  jcTestID: null,
  jcClip: null,
}
