/**
 * Native component registry — iOS.
 *
 * Loads SwiftUI components and modifier functions from @expo/ui/swift-ui.
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
  // so a missing view doesn't take down the entire registry.
  const safe = <T,>(fn: () => T): T | null => {
    try { return fn() } catch { return null }
  }

  registry = {
    isAvailable: true,
    Host: swiftUI.Host,
    Toggle: swiftUI.Toggle,
    DatePicker: swiftUI.DatePicker,
    Picker: swiftUI.Picker,
    DisclosureGroup: swiftUI.DisclosureGroup,
    Text: swiftUI.Text,
    Button: safe(() => swiftUI.Button),
    tag: modifiers.tag,
    pickerStyle: modifiers.pickerStyle,
    glassEffect: modifiers.glassEffect,
    buttonStyle: modifiers.buttonStyle ?? null,
    controlSize: modifiers.controlSize ?? null,
    tint: modifiers.tint ?? null,
    BottomSheet: safe(() => swiftUI.BottomSheet),
    Group: swiftUI.Group,
    ControlGroup: safe(() => swiftUI.ControlGroup),
    Form: safe(() => swiftUI.Form),
    Section: safe(() => swiftUI.Section),
    LabeledContent: safe(() => swiftUI.LabeledContent),
    presentationDetents: modifiers.presentationDetents,
    presentationDragIndicator: modifiers.presentationDragIndicator,
    formStyle: modifiers.formStyle ?? null,
    listSectionSpacing: modifiers.listSectionSpacing ?? null,
  }
} catch {
  registry = emptyRegistry
}

export const nativeComponents = registry
