/**
 * Native component registry — iOS.
 *
 * Loads SwiftUI components from @expo/ui/swift-ui.
 * Falls back to the empty registry if @expo/ui is not installed
 * or the native module isn't compiled into the dev client.
 */
import type { NativeComponentRegistry } from './types'
import { emptyRegistry } from './types'

let registry: NativeComponentRegistry

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const swiftUI = require('@expo/ui/swift-ui')

  // Verify the native module is actually available in the binary,
  // not just the JS package installed. Host requires the ExpoUI
  // native module to be compiled — if the dev client hasn't been
  // rebuilt after adding @expo/ui, the views won't be registered.
  const { NativeModulesProxy } = require('expo-modules-core')
  const hasNativeModule = Boolean(NativeModulesProxy?.ExpoUI || globalThis?.expo?.modules?.ExpoUI)

  if (hasNativeModule && swiftUI.Host) {
    registry = {
      isAvailable: true,
      Host: swiftUI.Host,
      Toggle: swiftUI.Toggle,
      DatePicker: swiftUI.DatePicker,
      Picker: swiftUI.Picker,
      DisclosureGroup: swiftUI.DisclosureGroup,
      Text: swiftUI.Text,
    }
  } else {
    // JS package installed but native module not compiled — skip
    registry = emptyRegistry
  }
} catch {
  registry = emptyRegistry
}

export const nativeComponents = registry
