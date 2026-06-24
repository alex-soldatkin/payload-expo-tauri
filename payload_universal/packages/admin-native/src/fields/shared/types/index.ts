/**
 * Type definitions for the native component registry.
 *
 * Extracted into a standalone module (no .ios.ts / .android.ts variants)
 * so Metro platform resolution doesn't cause circular imports.
 *
 * Verified against STABLE @expo/ui 56.0.17 (SDK 56; production-ready —
 * previously built against 55.0.0-canary-20260128).
 *
 * The registry type surface is split by responsibility across this folder:
 * - {@link ./modifiers}            — NativeModifier / JCModifier config shapes
 * - {@link ./components}           — shared / iOS-shaped (SwiftUI) controls
 * - {@link ./layout}               — SwiftUI display / layout / liquid-glass views
 * - {@link ./modifier-factories}   — SwiftUI modifier factories (iOS only)
 * - {@link ./jc}                   — Jetpack Compose (`JC*`) entries (Android only)
 * `NativeComponentRegistry` is the intersection of those fragments.
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
import type { NativeComponentRegistryComponents } from './components'
import type { NativeComponentRegistryJC } from './jc'
import type { NativeComponentRegistryLayout } from './layout'
import type { NativeComponentRegistryModifierFactories } from './modifier-factories'

export type { JCModifier, NativeModifier } from './modifiers'
export type { NativeComponentRegistryComponents } from './components'
export type { NativeComponentRegistryLayout } from './layout'
export type { NativeComponentRegistryModifierFactories } from './modifier-factories'
export type { NativeComponentRegistryJC } from './jc'

/**
 * The full native component registry surface — the intersection of the
 * shared/iOS controls, the SwiftUI display/layout/liquid-glass views, the
 * SwiftUI modifier factories, and the Jetpack Compose (`JC*`) entries.
 */
export type NativeComponentRegistry = NativeComponentRegistryComponents &
  NativeComponentRegistryLayout &
  NativeComponentRegistryModifierFactories &
  NativeComponentRegistryJC

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
