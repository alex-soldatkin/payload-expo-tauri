/**
 * Shared / iOS-shaped (SwiftUI canary) component entries of the native
 * registry. Some also map on Android when the JC API shape is compatible —
 * see native.android.ts.
 *
 * Every entry is nullable: ALWAYS null-check before use — entries are null on
 * platforms where the component doesn't exist (and in Expo Go). iOS-shaped
 * keys (SwiftUI surface) are null on Android.
 */
import type React from 'react'

import type { JCModifier, NativeModifier } from './modifiers'

/** Shared / iOS-shaped component surface of the {@link NativeComponentRegistry}. */
export type NativeComponentRegistryComponents = {
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

  // ── Display, layout & liquid glass live in {@link ./layout}
  //    (NativeComponentRegistryLayout) — they round out the iOS-shaped surface. ──
}
