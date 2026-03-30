/**
 * Native component registry — Android.
 *
 * Loads Jetpack Compose components from @expo/ui/jetpack-compose.
 * Always attempts to load in dev client / standalone builds.
 * Falls back to emptyRegistry only if @expo/ui JS package is missing.
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
  }
} catch {
  registry = emptyRegistry
}

export const nativeComponents = registry
