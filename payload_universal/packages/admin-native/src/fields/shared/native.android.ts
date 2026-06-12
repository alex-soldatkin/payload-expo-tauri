/**
 * Native component registry — Android.
 *
 * Loads Jetpack Compose components from @expo/ui/jetpack-compose
 * (canary 55.0.0-canary-20260128 — verify exports against
 * node_modules/@expo/ui/build/jetpack-compose before adding entries).
 *
 * JC components whose API shape diverges from the iOS counterpart are
 * registered under distinct `JC*` keys (see shared/types.ts for the exact
 * prop shapes). iOS-shaped keys stay null here so field code takes the
 * RN/JS fallback tier instead of silently passing mismatched props.
 *
 * Falls back to emptyRegistry if @expo/ui JS package is missing.
 */
import type { NativeComponentRegistry } from './types'
import { emptyRegistry } from './types'

let registry: NativeComponentRegistry

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jc = require('@expo/ui/jetpack-compose')

  // Safe accessor: coerce missing exports / requireNativeView crashes to null
  // so a single missing view doesn't take down the entire registry.
  const safe = <T,>(fn: () => T): T | null => {
    try { return fn() ?? null } catch { return null }
  }

  registry = {
    ...emptyRegistry,
    isAvailable: true,

    // ── Shared-shape components (API compatible with the iOS-shaped keys) ──
    Host: safe(() => jc.Host),
    // JC layout Text: { children, color?, fontSize?, fontWeight?, modifiers? } — superset of the shared shape.
    Text: safe(() => jc.Text),
    Divider: safe(() => jc.Divider),
    // JC Slider shares { value, min, max, onValueChange } with SwiftUI Slider
    // (iOS `step` vs JC `steps` differ — both optional).
    Slider: safe(() => jc.Slider),
    // JC ContextMenu mirrors the SwiftUI compound API (Trigger/Items/Preview).
    ContextMenu: safe(() => jc.ContextMenu),
    ContextMenuTrigger: safe(() => jc.ContextMenu?.Trigger),
    ContextMenuItems: safe(() => jc.ContextMenu?.Items),
    ContextMenuPreview: safe(() => jc.ContextMenu?.Preview),

    // ── Divergent-shape JC components (distinct keys; props documented in types.ts) ──
    // JCButton: text via children, Material icons, variant ('default'|'bordered'|'borderless'|'outlined'|'elevated').
    JCButton: safe(() => jc.Button),
    // JCIconButton: icon-only button, variant ('default'|'bordered'|'outlined').
    JCIconButton: safe(() => jc.IconButton),
    // JCChip: Material chip, variant ('assist'|'filter'|'input'|'suggestion').
    JCChip: safe(() => jc.Chip),
    // JCSwitch: { value, onValueChange, label?, variant: 'switch'|'checkbox'|'button' } (NOT isOn/onIsOnChange).
    JCSwitch: safe(() => jc.Switch),
    // JCTextInput: uncontrolled { defaultValue, onChangeText, ... } — no placeholder prop.
    JCTextInput: safe(() => jc.TextInput),
    // JCPicker: options-based { options, selectedIndex, onOptionSelected, variant: 'segmented'|'radio' }.
    JCPicker: safe(() => jc.Picker),
    // JCBottomSheet: { isOpened, onIsOpenedChange, skipPartiallyExpanded } (NOT isPresented).
    JCBottomSheet: safe(() => jc.BottomSheet),
    // JCAlertDialog: Material confirm/dismiss dialog.
    JCAlertDialog: safe(() => jc.AlertDialog),
    // JCDateTimePicker: { initialDate: ISO string, onDateSelected, variant: 'picker'|'input' } (NOT selection/onDateChange).
    JCDateTimePicker: safe(() => jc.DateTimePicker),
    // JC progress indicators (spinner / bar).
    JCCircularProgress: safe(() => jc.CircularProgress),
    JCLinearProgress: safe(() => jc.LinearProgress),
    // JC layout primitives.
    JCBox: safe(() => jc.Box),
    JCRow: safe(() => jc.Row),
    JCColumn: safe(() => jc.Column),
    // JC shape constructors ({ Star, PillStar, Pill, Circle, Rectangle, Polygon }) for jcClip / Button shape.
    JCShape: safe(() => jc.Shape),

    // ── JC modifier helpers (positional args; return { $type, ... } configs) ──
    jcPaddingAll: jc.paddingAll ?? null,
    jcPadding: jc.padding ?? null,
    jcSize: jc.size ?? null,
    jcFillMaxSize: jc.fillMaxSize ?? null,
    jcFillMaxWidth: jc.fillMaxWidth ?? null,
    jcFillMaxHeight: jc.fillMaxHeight ?? null,
    jcOffset: jc.offset ?? null,
    jcBackground: jc.background ?? null,
    jcBorder: jc.border ?? null,
    jcShadow: jc.shadow ?? null,
    jcAlpha: jc.alpha ?? null,
    jcBlur: jc.blur ?? null,
    jcRotate: jc.rotate ?? null,
    jcZIndex: jc.zIndex ?? null,
    jcAnimateContentSize: jc.animateContentSize ?? null,
    jcWeight: jc.weight ?? null,
    jcMatchParentSize: jc.matchParentSize ?? null,
    jcClickable: jc.clickable ?? null,
    jcTestID: jc.testID ?? null,
    jcClip: jc.clip ?? null,

    // iOS-shaped keys intentionally left null (from emptyRegistry spread):
    // Toggle/DatePicker/Picker/Button/BottomSheet/TextField/... — use the JC* keys above.
  }
} catch {
  registry = emptyRegistry
}

export const nativeComponents = registry
