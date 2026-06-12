/**
 * Native component registry — iOS.
 *
 * Loads SwiftUI components and modifier functions from @expo/ui/swift-ui
 * (STABLE 56.0.17 — verify exports against
 * node_modules/@expo/ui/src/swift-ui before adding entries).
 * Falls back to emptyRegistry if @expo/ui JS package is missing.
 */
import type { NativeComponentRegistry } from './types'
import { emptyRegistry } from './types'

let registry: NativeComponentRegistry

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const swiftUI = require('@expo/ui/swift-ui')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const modifiers = require('@expo/ui/swift-ui/modifiers')

  // Safe accessor: some components use requireNativeView which crashes if
  // the native view isn't compiled into the binary. Wrap each in try-catch
  // so a missing view doesn't take down the entire registry. Coerce
  // `undefined` (missing export) to null so consumers can rely on null-checks.
  const safe = <T,>(fn: () => T): T | null => {
    try { return fn() ?? null } catch { return null }
  }

  registry = {
    ...emptyRegistry,
    isAvailable: true,

    // ── Components ──
    Host: swiftUI.Host,
    Toggle: swiftUI.Toggle,
    DatePicker: swiftUI.DatePicker,
    Picker: swiftUI.Picker,
    DisclosureGroup: swiftUI.DisclosureGroup,
    Text: swiftUI.Text,
    Button: safe(() => swiftUI.Button),
    BottomSheet: safe(() => swiftUI.BottomSheet),
    Group: swiftUI.Group,
    Form: safe(() => swiftUI.Form),
    Section: safe(() => swiftUI.Section),
    LabeledContent: safe(() => swiftUI.LabeledContent),
    List: safe(() => swiftUI.List),
    ListForEach: safe(() => swiftUI.ListForEach),
    TextField: safe(() => swiftUI.TextField),
    SecureField: safe(() => swiftUI.SecureField),
    Stepper: safe(() => swiftUI.Stepper),
    Slider: safe(() => swiftUI.Slider),
    Gauge: safe(() => swiftUI.Gauge),
    ColorPicker: safe(() => swiftUI.ColorPicker),
    Menu: safe(() => swiftUI.Menu),
    ContextMenu: safe(() => swiftUI.ContextMenu),
    ContextMenuTrigger: safe(() => swiftUI.ContextMenu?.Trigger),
    ContextMenuItems: safe(() => swiftUI.ContextMenu?.Items),
    ContextMenuPreview: safe(() => swiftUI.ContextMenu?.Preview),
    Popover: safe(() => swiftUI.Popover),
    PopoverTrigger: safe(() => swiftUI.Popover?.Trigger),
    PopoverContent: safe(() => swiftUI.Popover?.Content),
    ShareLink: safe(() => swiftUI.ShareLink),
    Label: safe(() => swiftUI.Label),
    Image: safe(() => swiftUI.Image),
    ProgressView: safe(() => swiftUI.ProgressView),
    Chart: safe(() => swiftUI.Chart),
    ContentUnavailableView: safe(() => swiftUI.ContentUnavailableView),
    Divider: safe(() => swiftUI.Divider),
    HStack: safe(() => swiftUI.HStack),
    VStack: safe(() => swiftUI.VStack),
    ZStack: safe(() => swiftUI.ZStack),
    Spacer: safe(() => swiftUI.Spacer),
    Grid: safe(() => swiftUI.Grid),
    GridRow: safe(() => swiftUI.Grid?.Row),
    GlassEffectContainer: safe(() => swiftUI.GlassEffectContainer),
    Namespace: safe(() => swiftUI.Namespace),
    // RE-REGISTERED in stable 56.0.17 (absent in canary). Existing gates
    // (e.g. RichTextToolbar's JS fallback) now see a value — adopting it
    // is design work tracked separately.
    ControlGroup: safe(() => swiftUI.ControlGroup),
    ScrollView: safe(() => swiftUI.ScrollView),
    // NEW in stable 56: SwiftUI confirmationDialog with slot statics.
    ConfirmationDialog: safe(() => swiftUI.ConfirmationDialog),
    ConfirmationDialogTrigger: safe(() => swiftUI.ConfirmationDialog?.Trigger),
    ConfirmationDialogActions: safe(() => swiftUI.ConfirmationDialog?.Actions),
    ConfirmationDialogMessage: safe(() => swiftUI.ConfirmationDialog?.Message),

    // ── Modifier factories ──
    tag: modifiers.tag ?? null,
    pickerStyle: modifiers.pickerStyle ?? null,
    datePickerStyle: modifiers.datePickerStyle ?? null,
    toggleStyle: modifiers.toggleStyle ?? null,
    textFieldStyle: modifiers.textFieldStyle ?? null,
    buttonStyle: modifiers.buttonStyle ?? null,
    labelsHidden: modifiers.labelsHidden ?? null,
    controlSize: modifiers.controlSize ?? null,
    tint: modifiers.tint ?? null,
    foregroundColor: modifiers.foregroundColor ?? null,
    font: modifiers.font ?? null,
    badge: modifiers.badge ?? null,
    glassEffect: modifiers.glassEffect ?? null,
    glassEffectId: modifiers.glassEffectId ?? null,
    presentationDetents: modifiers.presentationDetents ?? null,
    presentationDragIndicator: modifiers.presentationDragIndicator ?? null,
    presentationBackgroundInteraction: modifiers.presentationBackgroundInteraction ?? null,
    interactiveDismissDisabled: modifiers.interactiveDismissDisabled ?? null,
    listStyle: modifiers.listStyle ?? null,
    listRowBackground: modifiers.listRowBackground ?? null,
    listRowInsets: modifiers.listRowInsets ?? null,
    listSectionSpacing: modifiers.listSectionSpacing ?? null,
    scrollContentBackground: modifiers.scrollContentBackground ?? null,
    frame: modifiers.frame ?? null,
    padding: modifiers.padding ?? null,
    fixedSize: modifiers.fixedSize ?? null,
    background: modifiers.background ?? null,
    cornerRadius: modifiers.cornerRadius ?? null,
    clipShape: modifiers.clipShape ?? null,
    onTapGesture: modifiers.onTapGesture ?? null,
    onAppear: modifiers.onAppear ?? null,
    onDisappear: modifiers.onDisappear ?? null,
    refreshable: modifiers.refreshable ?? null,
    animation: modifiers.animation ?? null,
    matchedGeometryEffect: modifiers.matchedGeometryEffect ?? null,
    scrollDisabled: modifiers.scrollDisabled ?? null,
    scrollDismissesKeyboard: modifiers.scrollDismissesKeyboard ?? null,
    disabled: modifiers.disabled ?? null,
    // NEW in stable: replacements for the dead TextField/SecureField
    // keyboardType/autocorrection/onSubmit PROPS.
    keyboardType: modifiers.keyboardType ?? null,
    autocorrectionDisabled: modifiers.autocorrectionDisabled ?? null,
    onSubmit: modifiers.onSubmit ?? null,
    // Still not exported by stable 56.0.17 — kept null for forward compatibility.
    formStyle: null,
  }
} catch {
  registry = emptyRegistry
}

export const nativeComponents = registry
