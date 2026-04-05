/**
 * Native component registry — Android.
 *
 * Loads Jetpack Compose components from @expo/ui/jetpack-compose.
 * Falls back to emptyRegistry if @expo/ui JS package is missing.
 */
import type { NativeComponentRegistry } from './types'
import { emptyRegistry } from './types'

let registry: NativeComponentRegistry

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jc = require('@expo/ui/jetpack-compose')

  registry = {
    isAvailable: true,
    Host: jc.Host,
    Toggle: jc.Switch,
    DatePicker: jc.DatePicker,
    Picker: jc.SingleChoiceSegmentedButtonRow ?? jc.SegmentedButton ?? null,
    DisclosureGroup: null,
    Text: jc.Text,
    tag: null,         // Android Picker uses different API
    pickerStyle: null,
    glassEffect: null,  // No liquid glass on Android
    BottomSheet: null,  // No native equivalent on Android
    Group: null,
    presentationDetents: null,
    presentationDragIndicator: null,
    Button: null,       // No SwiftUI Button on Android
    buttonStyle: null,
    controlSize: null,
    tint: null,
    ControlGroup: null, // No SwiftUI ControlGroup on Android
    Form: null,
    Section: null,
    LabeledContent: null,
    formStyle: null,
    listSectionSpacing: null,
  }
} catch {
  registry = emptyRegistry
}

export const nativeComponents = registry
