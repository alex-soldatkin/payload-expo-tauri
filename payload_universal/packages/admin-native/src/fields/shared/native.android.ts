/**
 * Native component registry — Android.
 *
 * Verified against STABLE @expo/ui 56.0.17 (previously canary
 * 55.0.0-canary-20260128). Sources:
 *   - '@expo/ui/jetpack-compose'            JC components
 *   - '@expo/ui/jetpack-compose/modifiers'  jc* modifier helpers (STABLE
 *     moved them out of the root export — requiring only the root would
 *     leave every jc* helper null)
 *   - '@expo/ui'                            cross-platform UNIVERSAL
 *     components (new in stable; render JC primitives, so they live inside
 *     a Host just like the raw JC components — except the self-hosting
 *     BottomSheet)
 *
 * JC components whose API shape diverges from the iOS counterpart are
 * registered under distinct `JC*` keys (see shared/types.ts for the exact
 * prop shapes). Where stable redesigned a canary JC shape, a thin adapter
 * preserves the canary contract (documented per-key in types.ts) so zero
 * consumers change. Two canary shapes died without a compatible replacement
 * (JCPicker, JCAlertDialog) — those keys are permanently null and consumers
 * fall back to their JS tier. iOS-shaped keys stay null here so field code
 * takes the RN/JS fallback tier instead of silently passing mismatched props.
 *
 * Falls back to emptyRegistry if @expo/ui JS package is missing.
 */
import { createElement } from 'react'

import type { NativeComponentRegistry } from './types'
import { emptyRegistry } from './types'

let registry: NativeComponentRegistry

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jc = require('@expo/ui/jetpack-compose')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jcMods = require('@expo/ui/jetpack-compose/modifiers')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const universal = require('@expo/ui')

  // Safe accessor: coerce missing exports / requireNativeView crashes to null
  // so a single missing view doesn't take down the entire registry.
  const safe = <T,>(fn: () => T): T | null => {
    try { return fn() ?? null } catch { return null }
  }

  // ── Adapters preserving the canary JC* contracts (see types.ts docs) ──

  /** canary JCButton → universal Button (string children → label; variant remap). */
  const jcButtonVariant: Record<string, string> = {
    default: 'filled',
    bordered: 'filled',
    elevated: 'filled',
    borderless: 'text',
    outlined: 'outlined',
  }
  const JCButtonAdapter = (props: any) => {
    const { onPress, disabled, variant, children, modifiers } = props
    const label =
      typeof children === 'string'
        ? children
        : Array.isArray(children) && children.every((c) => typeof c === 'string')
          ? children.join('')
          : undefined
    return createElement(universal.Button, {
      onPress,
      disabled,
      modifiers,
      variant: jcButtonVariant[variant ?? 'default'] ?? 'filled',
      ...(label != null ? { label } : { children }),
    })
  }

  /** canary JCIconButton → stable per-variant jc IconButton components. */
  const JCIconButtonAdapter = (props: any) => {
    const { onPress, disabled, variant, elementColors, children, modifiers } = props
    const byVariant: Record<string, any> = {
      default: jc.IconButton,
      bordered: jc.FilledIconButton,
      outlined: jc.OutlinedIconButton,
    }
    const Component = byVariant[variant ?? 'default'] ?? jc.IconButton
    return createElement(
      Component,
      { onClick: onPress, enabled: !disabled, colors: elementColors, modifiers },
      children,
    )
  }

  /** canary JCChip → stable per-variant chips with a Label slot. */
  const JCChipAdapter = (props: any) => {
    const { variant, label, selected, enabled, onPress, modifiers } = props
    const byVariant: Record<string, any> = {
      assist: jc.AssistChip,
      filter: jc.FilterChip,
      input: jc.InputChip,
      suggestion: jc.SuggestionChip,
    }
    const Component = byVariant[variant ?? 'assist'] ?? jc.AssistChip
    const labelSlot =
      Component?.Label && jc.Text
        ? createElement(Component.Label, null, createElement(jc.Text, null, label))
        : null
    // `selected` only exists on the filter/input variants (REQUIRED there).
    const selectable = variant === 'filter' || variant === 'input'
    return createElement(
      Component,
      {
        enabled,
        onClick: onPress,
        modifiers,
        ...(selectable ? { selected: Boolean(selected) } : {}),
      },
      labelSlot,
    )
  }

  /** canary JCTextInput → stable jc BasicTextField (uncontrolled + ref.setText). */
  const jcKeyboardType: Record<string, string> = {
    'default': 'text',
    'email-address': 'email',
    'numeric': 'number',
    'phone-pad': 'phone',
    'ascii-capable': 'ascii',
    'url': 'uri',
    'decimal-pad': 'decimal',
  }
  const JCTextInputAdapter = (props: any) => {
    const { ref, onChangeText, multiline, numberOfLines, keyboardType, autocorrection, autoCapitalize, modifiers } = props
    return createElement(jc.BasicTextField, {
      ref,
      onValueChange: onChangeText,
      singleLine: !multiline,
      ...(multiline && numberOfLines != null ? { maxLines: numberOfLines } : {}),
      keyboardOptions: {
        ...(keyboardType ? { keyboardType: jcKeyboardType[keyboardType] ?? 'text' } : {}),
        ...(autocorrection != null ? { autoCorrectEnabled: autocorrection } : {}),
        ...(autoCapitalize && autoCapitalize !== 'unspecified' ? { capitalization: autoCapitalize } : {}),
      },
      modifiers,
    })
  }

  /** canary JCBottomSheet → universal BottomSheet (SELF-HOSTING — no NativeHost). */
  const JCBottomSheetAdapter = (props: any) => {
    const { isOpened, onIsOpenedChange, skipPartiallyExpanded, children } = props
    return createElement(
      universal.BottomSheet,
      {
        isPresented: isOpened,
        onDismiss: () => onIsOpenedChange?.(false),
        ...(skipPartiallyExpanded ? { snapPoints: ['full'] } : {}),
      },
      children,
    )
  }

  registry = {
    ...emptyRegistry,
    isAvailable: true,

    // ── Shared-shape components (API compatible with the iOS-shaped keys) ──
    Host: safe(() => jc.Host),
    // JC Text: { children, color?, maxLines?, style?, modifiers? } — superset of the shared shape.
    Text: safe(() => jc.Text),
    // STABLE: the single jc Divider died — HorizontalDivider keeps visual parity.
    Divider: safe(() => jc.HorizontalDivider),
    // JC Slider shares { value, min, max, onValueChange } with SwiftUI Slider
    // (iOS `step` vs JC `steps` differ — both optional; stable adds
    // lowerLimit/upperLimit/onValueChangeFinished).
    Slider: safe(() => jc.Slider),
    // STABLE: the JC ContextMenu was REMOVED (DropdownMenu is the Material
    // replacement — design work). Keys stay null → JS menu fallbacks.
    ContextMenu: null,
    ContextMenuTrigger: null,
    ContextMenuItems: null,
    ContextMenuPreview: null,

    // ── Divergent-shape JC components (distinct keys; props documented in types.ts) ──
    // Adapter → universal Button (canary contract preserved; icons/colors dead).
    JCButton: safe(() => (universal.Button ? JCButtonAdapter : null)),
    // Adapter → jc IconButton/FilledIconButton/OutlinedIconButton.
    JCIconButton: safe(() => (jc.IconButton ? JCIconButtonAdapter : null)),
    // Adapter → jc AssistChip/FilterChip/InputChip/SuggestionChip (Label slot).
    JCChip: safe(() => (jc.FilterChip ? JCChipAdapter : null)),
    // UNIVERSAL Switch kept the canary { value, onValueChange, label } contract.
    JCSwitch: safe(() => universal.Switch),
    // Adapter → jc BasicTextField; defaultValue died — initial text via ref.setText.
    JCTextInput: safe(() => (jc.BasicTextField ? JCTextInputAdapter : null)),
    // PERMANENTLY NULL: stable removed the options-based jc Picker (see types.ts).
    JCPicker: null,
    // Adapter → universal BottomSheet (self-hosting).
    JCBottomSheet: safe(() => (universal.BottomSheet ? JCBottomSheetAdapter : null)),
    // PERMANENTLY NULL: stable redesigned jc AlertDialog to slot children (see types.ts).
    JCAlertDialog: null,
    // UNCHANGED in stable: { initialDate: ISO string, onDateSelected, variant: 'picker'|'input' }.
    JCDateTimePicker: safe(() => jc.DateTimePicker),
    // STABLE renamed: CircularProgress → CircularProgressIndicator (trackColor now top-level).
    JCCircularProgress: safe(() => jc.CircularProgressIndicator),
    JCLinearProgress: safe(() => jc.LinearProgressIndicator),
    // JC layout primitives (stable adds { spacedBy } arrangements).
    JCBox: safe(() => jc.Box),
    JCRow: safe(() => jc.Row),
    JCColumn: safe(() => jc.Column),
    // JC shape constructors ({ Star, PillStar, Pill, Circle, Rectangle, Polygon,
    // RoundedCorner }) for the Button/IconButton `shape` prop (NOT jcClip — see types.ts).
    JCShape: safe(() => jc.Shape),

    // ── JC modifier helpers (STABLE: from the /modifiers subpath; positional args) ──
    jcPaddingAll: jcMods.paddingAll ?? null,
    jcPadding: jcMods.padding ?? null,
    jcSize: jcMods.size ?? null,
    jcFillMaxSize: jcMods.fillMaxSize ?? null,
    jcFillMaxWidth: jcMods.fillMaxWidth ?? null,
    jcFillMaxHeight: jcMods.fillMaxHeight ?? null,
    jcOffset: jcMods.offset ?? null,
    jcBackground: jcMods.background ?? null,
    jcBorder: jcMods.border ?? null,
    jcShadow: jcMods.shadow ?? null,
    jcAlpha: jcMods.alpha ?? null,
    jcBlur: jcMods.blur ?? null,
    jcRotate: jcMods.rotate ?? null,
    jcZIndex: jcMods.zIndex ?? null,
    jcAnimateContentSize: jcMods.animateContentSize ?? null,
    jcWeight: jcMods.weight ?? null,
    jcMatchParentSize: jcMods.matchParentSize ?? null,
    jcClickable: jcMods.clickable ?? null,
    jcTestID: jcMods.testID ?? null,
    // STABLE: takes a built-in shape config, NOT JCShape JSX (see types.ts).
    jcClip: jcMods.clip ?? null,

    // iOS-shaped keys intentionally left null (from emptyRegistry spread):
    // Toggle/DatePicker/Picker/Button/BottomSheet/TextField/ScrollView/
    // ConfirmationDialog/ControlGroup/... — use the JC* keys above.
  }
} catch {
  registry = emptyRegistry
}

export const nativeComponents = registry
