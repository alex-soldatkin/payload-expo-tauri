/**
 * Type definitions for the native component registry.
 *
 * Extracted into a standalone file (no .ios.ts / .android.ts variants)
 * so Metro platform resolution doesn't cause circular imports.
 *
 * Verified against STABLE @expo/ui 56.0.17 (SDK 56; production-ready —
 * previously built against 55.0.0-canary-20260128).
 *
 * Conventions:
 * - Every entry is nullable. ALWAYS null-check before use — entries are null
 *   on platforms where the component doesn't exist (and in Expo Go).
 * - iOS-shaped keys (SwiftUI surface) are null on Android.
 * - `JC*`-prefixed keys are Android-only (null on iOS). In stable they map to
 *   `@expo/ui/jetpack-compose` exports, the new cross-platform `@expo/ui`
 *   UNIVERSAL exports, or thin registry adapters that preserve the canary
 *   prop contract — see native.android.ts. Two canary JC shapes DIED in
 *   stable with no contract-compatible replacement (JCPicker, JCAlertDialog);
 *   those keys are permanently null (documented inline) so existing gates
 *   fall back to JS.
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

  /**
   * Platform-appropriate Host wrapper.
   * Stable: `ignoreSafeArea` is iOS-only; the JC Host replaced it with
   * `ignoreSafeAreaKeyboardInsets?: boolean` — pass per-platform (NativeHost
   * handles this). `matchContents` can only be set once on mount (both
   * platforms).
   */
  Host: React.ComponentType<{
    matchContents?: boolean | { vertical?: boolean; horizontal?: boolean }
    colorScheme?: 'light' | 'dark' | null
    /** iOS only in stable. */
    ignoreSafeArea?: 'all' | 'keyboard'
    /** Android (JC Host) only in stable. */
    ignoreSafeAreaKeyboardInsets?: boolean
    /** Stable: propose the viewport size to SwiftUI/Compose (for Form etc.). */
    useViewportSizeMeasurement?: boolean
    onLayoutContent?: (event: { nativeEvent: { width: number; height: number } }) => void
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto'
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

  /**
   * Native picker (single-select, tag-based). SwiftUI Picker. The tag/children
   * contract is UNCHANGED in stable: options are `Text` children carrying a
   * `tag(value)` modifier; `onSelectionChange` receives the selected tag.
   * iOS only (the canary JC Picker was REMOVED in stable — see JCPicker).
   */
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

  /**
   * Native bottom sheet (SwiftUI .sheet presentation; iOS only — see
   * JCBottomSheet for Android). `isPresented`/`onIsPresentedChange` shape is
   * UNCHANGED in stable; `onDismiss` (fires after full dismissal) is new.
   * Stable also LAZY-MOUNTS: nothing renders until first presented, and the
   * native view unmounts after dismissal — don't rely on sheet children
   * mounting eagerly.
   */
  BottomSheet: React.ComponentType<{
    isPresented: boolean
    onIsPresentedChange: (isPresented: boolean) => void
    onDismiss?: () => void
    fitToContents?: boolean
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** Group wrapper for applying SwiftUI modifiers to children. iOS only. */
  Group: React.ComponentType<{
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /**
   * SwiftUI ScrollView. RE-REGISTERED in stable 56.0.17 (was absent in
   * canary). Pair with the scrollPosition/onScrollPhaseChange modifiers
   * (iOS 18+) for programmatic control. iOS only.
   */
  ScrollView: React.ComponentType<{
    axes?: 'vertical' | 'horizontal' | 'both'
    showsIndicators?: boolean
    children: React.ReactNode
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
   * Native control group. SwiftUI ControlGroup (iOS 16+).
   * RE-REGISTERED in stable 56.0.17 (was absent in canary — gates that
   * null-checked it, e.g. RichTextToolbar's JS fallback, now see a value;
   * adopting it is design work, not done in the SDK 56 migration).
   * Children can be Button/Toggle/Picker controls.
   */
  ControlGroup: React.ComponentType<{
    label?: string | React.ReactNode
    systemImage?: string
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /**
   * SwiftUI confirmationDialog (action-sheet style). NEW in stable 56.
   * Compound: children must include ConfirmationDialogTrigger and
   * ConfirmationDialogActions (Buttons; role='destructive'/'cancel'
   * respected), optionally ConfirmationDialogMessage. iOS only.
   */
  ConfirmationDialog: React.ComponentType<{
    title: string
    isPresented?: boolean
    onIsPresentedChange?: (isPresented: boolean) => void
    titleVisibility?: 'automatic' | 'visible' | 'hidden'
    children: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /** ConfirmationDialog.Trigger — the element that opens the dialog. iOS only. */
  ConfirmationDialogTrigger: React.ComponentType<{ children: React.ReactNode }> | null

  /** ConfirmationDialog.Actions — the dialog's action Buttons. iOS only. */
  ConfirmationDialogActions: React.ComponentType<{ children: React.ReactNode }> | null

  /** ConfirmationDialog.Message — optional message body. iOS only. */
  ConfirmationDialogMessage: React.ComponentType<{ children: React.ReactNode }> | null

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
   * SwiftUI TextField. STABLE SHAPE CHANGED from canary:
   * - `defaultValue`/`onChangeText`/`onChangeFocus` DIED → field keeps internal
   *   state when no `text` ObservableState is passed; push the initial value
   *   via `ref.setText(...)` on first attach (textBridge.attachRef does this)
   *   and listen via `onTextChange`/`onFocusChange`.
   * - `keyboardType`/`autocorrection`/`onSubmit`/`multiline` props DIED →
   *   use the keyboardType()/autocorrectionDisabled()/onSubmit() modifier
   *   registry keys and `axis: 'vertical'` instead.
   * - `placeholder` SURVIVED (still a plain prop).
   * ref: { setText, clear, focus, blur, setSelection }. iOS only — see JCTextInput.
   */
  TextField: React.ComponentType<{
    ref?: any
    placeholder?: string
    onTextChange?: (text: string) => void
    onFocusChange?: (focused: boolean) => void
    onSelectionChange?: (selection: { start: number; end: number }) => void
    axis?: 'horizontal' | 'vertical'
    maxLength?: number
    autoFocus?: boolean
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /**
   * SwiftUI SecureField (password input). Same stable shape change as
   * TextField (onTextChange/onFocusChange; initial value via ref.setText;
   * keyboardType/onSubmit via modifiers). iOS only.
   */
  SecureField: React.ComponentType<{
    ref?: any
    placeholder?: string
    onTextChange?: (text: string) => void
    onFocusChange?: (focused: boolean) => void
    maxLength?: number
    autoFocus?: boolean
    children?: React.ReactNode
    modifiers?: NativeModifier[]
  }> | null

  /**
   * SwiftUI Stepper (- / + control). STABLE IS CONTROLLED: `value` +
   * `onValueChange` (canary's uncontrolled defaultValue/onValueChanged +
   * epoch-remount echo workaround is OBSOLETE). iOS only.
   */
  Stepper: React.ComponentType<{
    label: string
    value?: number
    step?: number
    min?: number
    max?: number
    onValueChange: (value: number) => void
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

  /**
   * ContextMenu (long-press menu). Compose with ContextMenuTrigger/Items/Preview.
   * STABLE: iOS only — the JC ContextMenu was REMOVED in stable 56 (DropdownMenu
   * is the Material replacement; adopting it is design work). Android gates
   * fall through to JS menus.
   */
  ContextMenu: React.ComponentType<{
    children: React.ReactNode
    modifiers?: NativeModifier[] | JCModifier[]
  }> | null

  /** ContextMenu.Trigger — the visible element that owns the long-press. iOS only in stable. */
  ContextMenuTrigger: React.ComponentType<{ children: React.ReactNode }> | null

  /** ContextMenu.Items — menu entries (Buttons, Toggles, Pickers, submenus). iOS only in stable. */
  ContextMenuItems: React.ComponentType<{ children: React.ReactNode }> | null

  /** ContextMenu.Preview — optional custom preview shown while the menu is open. iOS only in stable. */
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

  /**
   * Native divider/separator hairline. Both platforms.
   * Android: stable removed the single JC `Divider` — this key maps to
   * `HorizontalDivider` (visual parity with canary).
   */
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

  /** Modifier factory: `pickerStyle` ('automatic' | 'menu' | 'segmented' | 'wheel' | 'inline' | 'palette' | 'navigationLink'). */
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
   * Modifier factory: `keyboardType` for TextField/SecureField. NEW in stable
   * (replaces the canary `keyboardType` PROP, which died).
   */
  keyboardType: ((keyboardType: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'ascii-capable' | 'numbers-and-punctuation' | 'url' | 'name-phone-pad' | 'decimal-pad' | 'twitter' | 'web-search' | 'ascii-capable-number-pad') => NativeModifier) | null

  /**
   * Modifier factory: `autocorrectionDisabled` for text inputs. NEW in stable
   * (replaces the canary `autocorrection` PROP, which died). Defaults to true.
   */
  autocorrectionDisabled: ((disabled?: boolean) => NativeModifier) | null

  /**
   * Modifier factory: `onSubmit` — fires when the user submits a text input
   * (return key). NEW in stable (replaces the canary `onSubmit` PROP).
   */
  onSubmit: ((handler: () => void) => NativeModifier) | null

  /**
   * Modifier factory: `formStyle`.
   * ALWAYS NULL: still not exported by stable 56.0.17 @expo/ui modifiers
   * (re-verified). Key kept for forward compatibility — gate on it before use.
   */
  formStyle: ((style: 'automatic' | 'grouped' | 'columns') => NativeModifier) | null

  // ───────────────────────────────────────────────────────────────────────
  // Jetpack Compose components (Android only — all null on iOS).
  // Distinct keys because the JC API shapes diverge from SwiftUI.
  // ───────────────────────────────────────────────────────────────────────

  /**
   * JC Button. STABLE: backed by a registry adapter over the UNIVERSAL
   * `@expo/ui` Button (the jc Button was redesigned to { onClick, colors,
   * shape, contentPadding } with per-variant components). The canary contract
   * is preserved: onPress/disabled/children(string→label) work; variant maps
   * 'outlined'→'outlined', 'borderless'→'text', 'default'/'bordered'/
   * 'elevated'→'filled'. DEAD (accepted but ignored): leadingIcon,
   * trailingIcon, systemImage, elementColors, color.
   */
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

  /**
   * JC IconButton. STABLE: registry adapter over jc IconButton variants
   * (stable split { variant } into IconButton/FilledIconButton/
   * OutlinedIconButton with { onClick, enabled, colors }). Canary contract
   * preserved: onPress/disabled/children work; variant maps 'default'→
   * IconButton, 'bordered'→FilledIconButton, 'outlined'→OutlinedIconButton;
   * elementColors maps to `colors`. DEAD (ignored): color.
   */
  JCIconButton: React.ComponentType<{
    onPress?: () => void
    variant?: 'default' | 'bordered' | 'outlined'
    children?: React.JSX.Element
    elementColors?: { containerColor?: string; contentColor?: string }
    color?: string
    disabled?: boolean
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC Chip (Material assist/filter/input/suggestion chips). STABLE: registry
   * adapter — stable split the single Chip into AssistChip/FilterChip/
   * InputChip/SuggestionChip with slot children (Chip.Label etc.) and
   * onClick. Canary contract preserved: variant picks the component; label
   * renders into the Label slot (jc Text); selected/enabled pass through;
   * onPress→onClick. DEAD (ignored): leadingIcon, trailingIcon, iconSize,
   * textStyle, onDismiss.
   */
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

  /**
   * JC Switch. STABLE: points at the UNIVERSAL `@expo/ui` Switch, which kept
   * the canary core contract { value, onValueChange, label } and adds
   * `disabled`. Still `value`/`onValueChange` (NOT isOn/onIsOnChange like the
   * iOS Toggle). DEAD in stable: `variant` ('checkbox' is now the separate
   * jc/universal Checkbox component — design work), `color`, `elementColors`.
   */
  JCSwitch: React.ComponentType<{
    value: boolean
    onValueChange?: (value: boolean) => void
    label?: string
    disabled?: boolean
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC TextInput. STABLE: registry adapter over jc BasicTextField (the
   * canary TextInput export died; the stable jc text fields mirror the
   * SwiftUI contract: internal state + ref.setText + onValueChange).
   * STILL UNCONTROLLED, but `defaultValue` DIED — push the initial value via
   * `ref.setText(...)` on first attach (textBridge.attachRef does this),
   * exactly like the iOS TextField. ref: { setText, clear, focus, blur,
   * setSelection }. Still no placeholder prop (JS overlay stays).
   */
  JCTextInput: React.ComponentType<{
    ref?: any
    onChangeText: (value: string) => void
    multiline?: boolean
    numberOfLines?: number
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'ascii-capable' | 'url' | 'decimal-pad'
    autocorrection?: boolean
    autoCapitalize?: 'characters' | 'none' | 'sentences' | 'unspecified' | 'words'
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC Picker. PERMANENTLY NULL in stable: the canary options-based jc Picker
   * (options/selectedIndex/onOptionSelected with 'segmented'/'radio'
   * variants) was REMOVED. The stable replacements have incompatible
   * contracts: jc SingleChoiceSegmentedButtonRow + SegmentedButton /
   * RadioButton (compound slot APIs) or the universal Picker
   * (selectedValue/onValueChange + <Picker.Item>, 'menu'/'wheel' only).
   * Adopting either is design work — consumers (select/radio fields) gate on
   * this key and fall back to their JS tier on Android.
   */
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

  /**
   * JC BottomSheet. STABLE: registry adapter over the UNIVERSAL `@expo/ui`
   * BottomSheet (the canary jc BottomSheet died; jc ModalBottomSheet has an
   * incompatible imperative contract). Canary contract preserved:
   * isOpened→isPresented; onIsOpenedChange(false) fires on user dismissal;
   * skipPartiallyExpanded→snapPoints:['full']. SELF-HOSTING — render it
   * directly, do NOT wrap in NativeHost. (NOT isPresented like iOS.)
   */
  JCBottomSheet: React.ComponentType<{
    isOpened: boolean
    onIsOpenedChange: (isOpened: boolean) => void
    skipPartiallyExpanded?: boolean
    children: React.ReactNode
  }> | null

  /**
   * JC AlertDialog. PERMANENTLY NULL in stable: the canary flat-props dialog
   * (visible/title/text/confirmButtonText/onConfirmPressed/...) was
   * redesigned to a slot-children API (AlertDialog.Title/.Text/
   * .ConfirmButton/.DismissButton + onDismissRequest) with no
   * contract-compatible mapping. Adopting the slot API is design work —
   * gate on this key and fall back to RN Alert/JS dialogs.
   */
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

  /**
   * JC DateTimePicker. UNCHANGED in stable (same initialDate ISO string /
   * onDateSelected(Date) / variant contract; stable adds optional
   * elementColors + selectableDates). (NOT selection/onDateChange like iOS.)
   */
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

  /**
   * JC CircularProgress (spinner when progress null/undefined). STABLE:
   * maps to jc CircularProgressIndicator — `elementColors.trackColor` died,
   * `trackColor` is now top-level.
   */
  JCCircularProgress: React.ComponentType<{
    progress?: number | null
    color?: string
    trackColor?: string
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC LinearProgress (bar). STABLE: maps to jc LinearProgressIndicator —
   * `elementColors.trackColor` died, `trackColor` is now top-level.
   */
  JCLinearProgress: React.ComponentType<{
    progress?: number | null
    color?: string
    trackColor?: string
    modifiers?: JCModifier[]
  }> | null

  /** JC layout Box (Compose Box). Props: { children?, modifiers? }. */
  JCBox: React.ComponentType<{
    children?: React.ReactNode
    modifiers?: JCModifier[]
  }> | null

  /** JC layout Row. Stable adds the `{ spacedBy }` arrangement form (gap in dp). */
  JCRow: React.ComponentType<{
    children?: React.ReactNode
    horizontalArrangement?: 'start' | 'end' | 'center' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly' | { spacedBy: number }
    verticalAlignment?: 'top' | 'bottom' | 'center'
    modifiers?: JCModifier[]
  }> | null

  /** JC layout Column. Stable adds the `{ spacedBy }` arrangement form (gap in dp). */
  JCColumn: React.ComponentType<{
    children?: React.ReactNode
    verticalArrangement?: 'top' | 'bottom' | 'center' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly' | { spacedBy: number }
    horizontalAlignment?: 'start' | 'end' | 'center'
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC Shape constructors namespace: { Star, PillStar, Pill, Circle,
   * Rectangle, Polygon, RoundedCorner (new in stable) }. Shape JSX is used by
   * the jc Button/IconButton `shape` prop. NOTE: stable's `clip` modifier
   * (jcClip) no longer takes Shape JSX — see jcClip.
   */
  JCShape: {
    Star: (props: any) => any
    PillStar: (props: any) => any
    Pill: (props: any) => any
    Circle: (props: any) => any
    Rectangle: (props: any) => any
    Polygon: (props: any) => any
    RoundedCorner?: (props: any) => any
  } | null

  // ── Jetpack Compose modifier helpers (Android only — positional args, unlike SwiftUI).
  // STABLE: these moved from the '@expo/ui/jetpack-compose' ROOT to the
  // '@expo/ui/jetpack-compose/modifiers' subpath (native.android.ts requires both). ──

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
  /**
   * JC modifier: clip(shape). STABLE CONTRACT CHANGED: takes a built-in
   * shape config from the jc modifiers module (e.g. the `Shapes` record's
   * entries: 'circle' | 'rectangle' | corner/star configs), NOT a JCShape
   * JSX element like in canary. Passing JSX is silently ignored natively.
   */
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
  ScrollView: null,
  Button: null,
  ControlGroup: null,
  ConfirmationDialog: null,
  ConfirmationDialogTrigger: null,
  ConfirmationDialogActions: null,
  ConfirmationDialogMessage: null,
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
  keyboardType: null,
  autocorrectionDisabled: null,
  onSubmit: null,
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
