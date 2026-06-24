/**
 * SwiftUI modifier factory entries of the native registry (iOS only — all
 * null on Android).
 *
 * Each entry is a FACTORY FUNCTION returning a `{ $type, ... }` config. Always
 * call them (`pickerStyle!('segmented')`) — never pass object literals
 * (missing $type = silently ignored).
 */
import type { NativeModifier } from './modifiers'

/** SwiftUI modifier-factory surface of the {@link NativeComponentRegistry}. */
export type NativeComponentRegistryModifierFactories = {
  // ───────────────────────────────────────────────────────────────────────
  // SwiftUI modifier factories (iOS only — all null on Android)
  // ───────────────────────────────────────────────────────────────────────

  /** Modifier factory: `tag` for Picker options. */
  tag: ((value: string | number) => NativeModifier) | null

  /** Modifier factory: `pickerStyle` ('automatic' | 'menu' | 'segmented' | 'wheel' | 'inline' | 'palette' | 'navigationLink'). */
  pickerStyle: ((style: string) => NativeModifier) | null

  /** Modifier factory: `datePickerStyle` ('automatic' | 'compact' | 'graphical' | 'wheel'). */
  datePickerStyle: ((style: string) => NativeModifier) | null

  /** Modifier factory: `toggleStyle` ('automatic' | 'switch' | 'button'). */
  toggleStyle: ((style: 'automatic' | 'switch' | 'button') => NativeModifier) | null

  /** Modifier factory: `textFieldStyle` ('automatic' | 'plain' | 'roundedBorder'). */
  textFieldStyle: ((style: 'automatic' | 'plain' | 'roundedBorder') => NativeModifier) | null

  /** Modifier factory: `buttonStyle` (incl. 'glass' / 'glassProminent' on iOS 26+). */
  buttonStyle: ((style: 'automatic' | 'bordered' | 'borderedProminent' | 'borderless' | 'glass' | 'glassProminent' | 'plain') => NativeModifier) | null

  /** Modifier factory: `labelsHidden` — hides the built-in label of a control. */
  labelsHidden: (() => NativeModifier) | null

  /** Modifier factory: `controlSize`. */
  controlSize: ((size: 'mini' | 'small' | 'regular' | 'large' | 'extraLarge') => NativeModifier) | null

  /** Modifier factory: `tint` color. */
  tint: ((color: string) => NativeModifier) | null

  /** Modifier factory: `foregroundColor`. */
  foregroundColor: ((color: string) => NativeModifier) | null

  /** Modifier factory: `font` ({ family?, size?, weight?, design? } per canary). */
  font: ((params: { family?: string; size?: number; weight?: string; design?: string }) => NativeModifier) | null

  /** Modifier factory: `badge` — trailing badge text/count on list rows and tabs. */
  badge: ((value?: string) => NativeModifier) | null

  /**
   * Modifier factory: `glassEffect` (iOS 26+ liquid glass).
   * NEVER apply with interactive:true to gesture-owning controls (Picker/Toggle/Button).
   */
  glassEffect: ((params?: { glass?: { variant?: string; interactive?: boolean }; tint?: string; shape?: string }) => NativeModifier) | null

  /** Modifier factory: `glassEffectId(id, namespaceId)` — pairs with Namespace for morphing. */
  glassEffectId: ((id: string, namespaceId: string) => NativeModifier) | null

  /** Modifier factory: `presentationDetents` for sheets. */
  presentationDetents: ((detents: Array<'medium' | 'large' | { fraction: number } | { height: number }>) => NativeModifier) | null

  /** Modifier factory: `presentationDragIndicator`. */
  presentationDragIndicator: ((visibility: 'automatic' | 'visible' | 'hidden') => NativeModifier) | null

  /** Modifier factory: `presentationBackgroundInteraction` (iOS 16.4+). */
  presentationBackgroundInteraction: ((interaction: 'automatic' | 'enabled' | 'disabled' | { type: 'enabledUpThrough'; detent: 'medium' | 'large' | { fraction: number } | { height: number } }) => NativeModifier) | null

  /** Modifier factory: `interactiveDismissDisabled` — blocks swipe-to-dismiss on sheets. */
  interactiveDismissDisabled: ((isDisabled?: boolean) => NativeModifier) | null

  /** Modifier factory: `listStyle` ('automatic' | 'plain' | 'inset' | 'insetGrouped' | 'grouped' | 'sidebar'). */
  listStyle: ((style: 'automatic' | 'plain' | 'inset' | 'insetGrouped' | 'grouped' | 'sidebar') => NativeModifier) | null

  /** Modifier factory: `listRowBackground` color. */
  listRowBackground: ((color: string) => NativeModifier) | null

  /** Modifier factory: `listRowInsets`. */
  listRowInsets: ((params: { top?: number; leading?: number; bottom?: number; trailing?: number }) => NativeModifier) | null

  /** Modifier factory: `listSectionSpacing` (iOS 17+). */
  listSectionSpacing: ((spacing: 'default' | 'compact' | number) => NativeModifier) | null

  /** Modifier factory: `scrollContentBackground` — hide to show custom backgrounds behind Form/List. */
  scrollContentBackground: ((visible: 'automatic' | 'visible' | 'hidden') => NativeModifier) | null

  /** Modifier factory: `frame`. */
  frame: ((params: { width?: number; height?: number; minWidth?: number; idealWidth?: number; maxWidth?: number; minHeight?: number; idealHeight?: number; maxHeight?: number; alignment?: string }) => NativeModifier) | null

  /** Modifier factory: `padding`. */
  padding: ((params?: { all?: number; horizontal?: number; vertical?: number; top?: number; bottom?: number; leading?: number; trailing?: number }) => NativeModifier) | null

  /** Modifier factory: `fixedSize` — view keeps its intrinsic size. */
  fixedSize: ((params?: { horizontal?: boolean; vertical?: boolean }) => NativeModifier) | null

  /** Modifier factory: `background(color, shape?)`. */
  background: ((color: string, shape?: any) => NativeModifier) | null

  /** Modifier factory: `cornerRadius`. */
  cornerRadius: ((radius: number) => NativeModifier) | null

  /** Modifier factory: `clipShape` ('rectangle' | 'circle' | 'roundedRectangle'). */
  clipShape: ((shape: 'rectangle' | 'circle' | 'roundedRectangle', cornerRadius?: number) => NativeModifier) | null

  /** Modifier factory: `onTapGesture`. */
  onTapGesture: ((handler: () => void) => NativeModifier) | null

  /** Modifier factory: `onAppear`. */
  onAppear: ((handler: () => void) => NativeModifier) | null

  /** Modifier factory: `onDisappear`. */
  onDisappear: ((handler: () => void) => NativeModifier) | null

  /** Modifier factory: `refreshable` — pull-to-refresh on List/Form. */
  refreshable: ((handler: () => void) => NativeModifier) | null

  /** Modifier factory: `animation(animationObject, animatedValue)` — see @expo/ui Animation builder. */
  animation: ((animationObject: any, animatedValue: number | boolean) => NativeModifier) | null

  /** Modifier factory: `matchedGeometryEffect(id, namespaceId)`. */
  matchedGeometryEffect: ((id: string, namespaceId: string) => NativeModifier) | null

  /** Modifier factory: `scrollDisabled`. */
  scrollDisabled: ((disabled?: boolean) => NativeModifier) | null

  /** Modifier factory: `scrollDismissesKeyboard`. */
  scrollDismissesKeyboard: ((mode: 'automatic' | 'never' | 'interactively' | 'immediately') => NativeModifier) | null

  /** Modifier factory: `disabled` — disables user interaction. */
  disabled: ((disabled?: boolean) => NativeModifier) | null

  /**
   * Modifier factory: `keyboardType` for TextField/SecureField. NEW in stable
   * (replaces the canary `keyboardType` PROP, which died).
   */
  keyboardType: ((keyboardType: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'ascii-capable' | 'numbers-and-punctuation' | 'url' | 'name-phone-pad' | 'decimal-pad' | 'twitter' | 'web-search' | 'ascii-capable-number-pad') => NativeModifier) | null

  /**
   * Modifier factory: `autocorrectionDisabled` for text inputs. NEW in stable
   * (replaces the canary `autocorrection` PROP, which died). Defaults to true.
   */
  autocorrectionDisabled: ((disabled?: boolean) => NativeModifier) | null

  /**
   * Modifier factory: `onSubmit` — fires when the user submits a text input
   * (return key). NEW in stable (replaces the canary `onSubmit` PROP).
   */
  onSubmit: ((handler: () => void) => NativeModifier) | null

  /**
   * Modifier factory: `formStyle`.
   * ALWAYS NULL: still not exported by stable 56.0.17 @expo/ui modifiers
   * (re-verified). Key kept for forward compatibility — gate on it before use.
   */
  formStyle: ((style: 'automatic' | 'grouped' | 'columns') => NativeModifier) | null
}
