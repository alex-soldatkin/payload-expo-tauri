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

  registry = {
    isAvailable: true,
    Host: swiftUI.Host,
    Toggle: swiftUI.Toggle,
    DatePicker: swiftUI.DatePicker,
    Picker: swiftUI.Picker,
    DisclosureGroup: swiftUI.DisclosureGroup,
    Text: swiftUI.Text,
    Button: swiftUI.Button,
    tag: modifiers.tag,
    pickerStyle: modifiers.pickerStyle,
    glassEffect: modifiers.glassEffect,
    buttonStyle: modifiers.buttonStyle,
    controlSize: modifiers.controlSize,
    tint: modifiers.tint,
    BottomSheet: swiftUI.BottomSheet,
    Group: swiftUI.Group,
    ControlGroup: swiftUI.ControlGroup,
    Form: swiftUI.Form,
    Section: swiftUI.Section,
    LabeledContent: swiftUI.LabeledContent,
    presentationDetents: modifiers.presentationDetents,
    presentationDragIndicator: modifiers.presentationDragIndicator,
    formStyle: modifiers.formStyle ?? null,
    listSectionSpacing: modifiers.listSectionSpacing ?? null,
  }
} catch {
  registry = emptyRegistry
}

export const nativeComponents = registry
