/**
 * Native component registry — Android.
 *
 * Loads Jetpack Compose components from @expo/ui/jetpack-compose.
 * Falls back to the empty registry if @expo/ui is not installed.
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
    DisclosureGroup: null,   // No Android equivalent
    Text: jc.Text,
  }
} catch {
  registry = emptyRegistry
}

export const nativeComponents = registry
