/**
 * Native component registry — iOS.
 *
 * Loads SwiftUI components from @expo/ui/swift-ui.
 * Always attempts to load in dev client / standalone builds.
 * Falls back to emptyRegistry only if @expo/ui JS package is missing.
 */
import type { NativeComponentRegistry } from './types'
import { emptyRegistry } from './types'

let registry: NativeComponentRegistry

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const swiftUI = require('@expo/ui/swift-ui')

  registry = {
    isAvailable: true,
    Host: swiftUI.Host,
    Toggle: swiftUI.Toggle,
    DatePicker: swiftUI.DatePicker,
    Picker: swiftUI.Picker,
    DisclosureGroup: swiftUI.DisclosureGroup,
    Text: swiftUI.Text,
  }
} catch {
  registry = emptyRegistry
}

export const nativeComponents = registry
