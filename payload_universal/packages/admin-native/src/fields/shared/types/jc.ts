/**
 * Jetpack Compose (`JC*`-prefixed) entries of the native registry — Android
 * only, all null on iOS. Distinct keys because the JC API shapes diverge from
 * SwiftUI.
 *
 * In stable they map to `@expo/ui/jetpack-compose` exports, the new
 * cross-platform `@expo/ui` UNIVERSAL exports, or thin registry adapters that
 * preserve the canary prop contract — see native.android.ts. Two canary JC
 * shapes DIED in stable with no contract-compatible replacement (JCPicker,
 * JCAlertDialog); those keys are permanently null (documented inline) so
 * existing gates fall back to JS.
 */
import type React from 'react'

import type { JCModifier } from './modifiers'

/** Jetpack Compose surface of the {@link NativeComponentRegistry}. */
export type NativeComponentRegistryJC = {
  // ───────────────────────────────────────────────────────────────────────
  // Jetpack Compose components (Android only — all null on iOS).
  // Distinct keys because the JC API shapes diverge from SwiftUI.
  // ───────────────────────────────────────────────────────────────────────

  /**
   * JC Button. STABLE: backed by a registry adapter over the UNIVERSAL
   * `@expo/ui` Button (the jc Button was redesigned to { onClick, colors,
   * shape, contentPadding } with per-variant components). The canary contract
   * is preserved: onPress/disabled/children(string→label) work; variant maps
   * 'outlined'→'outlined', 'borderless'→'text', 'default'/'bordered'/
   * 'elevated'→'filled'. DEAD (accepted but ignored): leadingIcon,
   * trailingIcon, systemImage, elementColors, color.
   */
  JCButton: React.ComponentType<{
    onPress?: () => void
    leadingIcon?: string
    trailingIcon?: string
    systemImage?: string
    variant?: 'default' | 'bordered' | 'borderless' | 'outlined' | 'elevated'
    children?: string | string[] | React.JSX.Element
    elementColors?: { containerColor?: string; contentColor?: string; disabledContainerColor?: string; disabledContentColor?: string }
    color?: string
    disabled?: boolean
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC IconButton. STABLE: registry adapter over jc IconButton variants
   * (stable split { variant } into IconButton/FilledIconButton/
   * OutlinedIconButton with { onClick, enabled, colors }). Canary contract
   * preserved: onPress/disabled/children work; variant maps 'default'→
   * IconButton, 'bordered'→FilledIconButton, 'outlined'→OutlinedIconButton;
   * elementColors maps to `colors`. DEAD (ignored): color.
   */
  JCIconButton: React.ComponentType<{
    onPress?: () => void
    variant?: 'default' | 'bordered' | 'outlined'
    children?: React.JSX.Element
    elementColors?: { containerColor?: string; contentColor?: string }
    color?: string
    disabled?: boolean
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC Chip (Material assist/filter/input/suggestion chips). STABLE: registry
   * adapter — stable split the single Chip into AssistChip/FilterChip/
   * InputChip/SuggestionChip with slot children (Chip.Label etc.) and
   * onClick. Canary contract preserved: variant picks the component; label
   * renders into the Label slot (jc Text); selected/enabled pass through;
   * onPress→onClick. DEAD (ignored): leadingIcon, trailingIcon, iconSize,
   * textStyle, onDismiss.
   */
  JCChip: React.ComponentType<{
    variant?: 'assist' | 'filter' | 'input' | 'suggestion'
    label: string
    leadingIcon?: string
    trailingIcon?: string
    iconSize?: number
    textStyle?: string
    enabled?: boolean
    selected?: boolean
    onPress?: () => void
    onDismiss?: () => void
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC Switch. STABLE: points at the UNIVERSAL `@expo/ui` Switch, which kept
   * the canary core contract { value, onValueChange, label } and adds
   * `disabled`. Still `value`/`onValueChange` (NOT isOn/onIsOnChange like the
   * iOS Toggle). DEAD in stable: `variant` ('checkbox' is now the separate
   * jc/universal Checkbox component — design work), `color`, `elementColors`.
   */
  JCSwitch: React.ComponentType<{
    value: boolean
    onValueChange?: (value: boolean) => void
    label?: string
    disabled?: boolean
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC TextInput. STABLE: registry adapter over jc BasicTextField (the
   * canary TextInput export died; the stable jc text fields mirror the
   * SwiftUI contract: internal state + ref.setText + onValueChange).
   * STILL UNCONTROLLED, but `defaultValue` DIED — push the initial value via
   * `ref.setText(...)` on first attach (textBridge.attachRef does this),
   * exactly like the iOS TextField. ref: { setText, clear, focus, blur,
   * setSelection }. Still no placeholder prop (JS overlay stays).
   */
  JCTextInput: React.ComponentType<{
    ref?: any
    onChangeText: (value: string) => void
    multiline?: boolean
    numberOfLines?: number
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'ascii-capable' | 'url' | 'decimal-pad'
    autocorrection?: boolean
    autoCapitalize?: 'characters' | 'none' | 'sentences' | 'unspecified' | 'words'
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC Picker. PERMANENTLY NULL in stable: the canary options-based jc Picker
   * (options/selectedIndex/onOptionSelected with 'segmented'/'radio'
   * variants) was REMOVED. The stable replacements have incompatible
   * contracts: jc SingleChoiceSegmentedButtonRow + SegmentedButton /
   * RadioButton (compound slot APIs) or the universal Picker
   * (selectedValue/onValueChange + <Picker.Item>, 'menu'/'wheel' only).
   * Adopting either is design work — consumers (select/radio fields) gate on
   * this key and fall back to their JS tier on Android.
   */
  JCPicker: React.ComponentType<{
    options: string[]
    selectedIndex: number | null
    onOptionSelected?: (event: { nativeEvent: { index: number; label: string } }) => void
    variant?: 'segmented' | 'radio'
    elementColors?: Record<string, string>
    color?: string
    modifiers?: JCModifier[]
    buttonModifiers?: JCModifier[]
  }> | null

  /**
   * JC BottomSheet. STABLE: registry adapter over the UNIVERSAL `@expo/ui`
   * BottomSheet (the canary jc BottomSheet died; jc ModalBottomSheet has an
   * incompatible imperative contract). Canary contract preserved:
   * isOpened→isPresented; onIsOpenedChange(false) fires on user dismissal;
   * skipPartiallyExpanded→snapPoints:['full']. SELF-HOSTING — render it
   * directly, do NOT wrap in NativeHost. (NOT isPresented like iOS.)
   */
  JCBottomSheet: React.ComponentType<{
    isOpened: boolean
    onIsOpenedChange: (isOpened: boolean) => void
    skipPartiallyExpanded?: boolean
    children: React.ReactNode
  }> | null

  /**
   * JC AlertDialog. PERMANENTLY NULL in stable: the canary flat-props dialog
   * (visible/title/text/confirmButtonText/onConfirmPressed/...) was
   * redesigned to a slot-children API (AlertDialog.Title/.Text/
   * .ConfirmButton/.DismissButton + onDismissRequest) with no
   * contract-compatible mapping. Adopting the slot API is design work —
   * gate on this key and fall back to RN Alert/JS dialogs.
   */
  JCAlertDialog: React.ComponentType<{
    visible?: boolean
    title?: string
    text?: string
    confirmButtonText?: string
    dismissButtonText?: string
    confirmButtonColors?: { containerColor?: string; contentColor?: string }
    dismissButtonColors?: { containerColor?: string; contentColor?: string }
    onConfirmPressed?: () => void
    onDismissPressed?: () => void
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC DateTimePicker. UNCHANGED in stable (same initialDate ISO string /
   * onDateSelected(Date) / variant contract; stable adds optional
   * elementColors + selectableDates). (NOT selection/onDateChange like iOS.)
   */
  JCDateTimePicker: React.ComponentType<{
    initialDate?: string | null
    onDateSelected?: (date: Date) => void
    variant?: 'picker' | 'input'
    showVariantToggle?: boolean
    displayedComponents?: 'date' | 'hourAndMinute' | 'dateAndTime'
    color?: string
    is24Hour?: boolean
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC CircularProgress (spinner when progress null/undefined). STABLE:
   * maps to jc CircularProgressIndicator — `elementColors.trackColor` died,
   * `trackColor` is now top-level.
   */
  JCCircularProgress: React.ComponentType<{
    progress?: number | null
    color?: string
    trackColor?: string
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC LinearProgress (bar). STABLE: maps to jc LinearProgressIndicator —
   * `elementColors.trackColor` died, `trackColor` is now top-level.
   */
  JCLinearProgress: React.ComponentType<{
    progress?: number | null
    color?: string
    trackColor?: string
    modifiers?: JCModifier[]
  }> | null

  /** JC layout Box (Compose Box). Props: { children?, modifiers? }. */
  JCBox: React.ComponentType<{
    children?: React.ReactNode
    modifiers?: JCModifier[]
  }> | null

  /** JC layout Row. Stable adds the `{ spacedBy }` arrangement form (gap in dp). */
  JCRow: React.ComponentType<{
    children?: React.ReactNode
    horizontalArrangement?: 'start' | 'end' | 'center' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly' | { spacedBy: number }
    verticalAlignment?: 'top' | 'bottom' | 'center'
    modifiers?: JCModifier[]
  }> | null

  /** JC layout Column. Stable adds the `{ spacedBy }` arrangement form (gap in dp). */
  JCColumn: React.ComponentType<{
    children?: React.ReactNode
    verticalArrangement?: 'top' | 'bottom' | 'center' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly' | { spacedBy: number }
    horizontalAlignment?: 'start' | 'end' | 'center'
    modifiers?: JCModifier[]
  }> | null

  /**
   * JC Shape constructors namespace: { Star, PillStar, Pill, Circle,
   * Rectangle, Polygon, RoundedCorner (new in stable) }. Shape JSX is used by
   * the jc Button/IconButton `shape` prop. NOTE: stable's `clip` modifier
   * (jcClip) no longer takes Shape JSX — see jcClip.
   */
  JCShape: {
    Star: (props: any) => any
    PillStar: (props: any) => any
    Pill: (props: any) => any
    Circle: (props: any) => any
    Rectangle: (props: any) => any
    Polygon: (props: any) => any
    RoundedCorner?: (props: any) => any
  } | null

  // ── Jetpack Compose modifier helpers (Android only — positional args, unlike SwiftUI).
  // STABLE: these moved from the '@expo/ui/jetpack-compose' ROOT to the
  // '@expo/ui/jetpack-compose/modifiers' subpath (native.android.ts requires both). ──

  /** JC modifier: padding(all) in dp. */
  jcPaddingAll: ((all: number) => JCModifier) | null
  /** JC modifier: padding(start, top, end, bottom) in dp. */
  jcPadding: ((start: number, top: number, end: number, bottom: number) => JCModifier) | null
  /** JC modifier: exact size(width, height) in dp. */
  jcSize: ((width: number, height: number) => JCModifier) | null
  /** JC modifier: fillMaxSize(fraction?). */
  jcFillMaxSize: ((fraction?: number) => JCModifier) | null
  /** JC modifier: fillMaxWidth(fraction?). */
  jcFillMaxWidth: ((fraction?: number) => JCModifier) | null
  /** JC modifier: fillMaxHeight(fraction?). */
  jcFillMaxHeight: ((fraction?: number) => JCModifier) | null
  /** JC modifier: offset(x, y) in dp. */
  jcOffset: ((x: number, y: number) => JCModifier) | null
  /** JC modifier: background(hexColor). */
  jcBackground: ((color: string) => JCModifier) | null
  /** JC modifier: border(width, hexColor). */
  jcBorder: ((borderWidth: number, borderColor: string) => JCModifier) | null
  /** JC modifier: shadow(elevation). */
  jcShadow: ((elevation: number) => JCModifier) | null
  /** JC modifier: alpha(0-1). */
  jcAlpha: ((alpha: number) => JCModifier) | null
  /** JC modifier: blur(radius). */
  jcBlur: ((radius: number) => JCModifier) | null
  /** JC modifier: rotate(degrees). */
  jcRotate: ((degrees: number) => JCModifier) | null
  /** JC modifier: zIndex(index). */
  jcZIndex: ((index: number) => JCModifier) | null
  /** JC modifier: animateContentSize(dampingRatio?, stiffness?). */
  jcAnimateContentSize: ((dampingRatio?: number, stiffness?: number) => JCModifier) | null
  /** JC modifier: weight(value) — only inside JCRow/JCColumn. */
  jcWeight: ((weight: number) => JCModifier) | null
  /** JC modifier: matchParentSize() — only inside JCBox. */
  jcMatchParentSize: (() => JCModifier) | null
  /** JC modifier: clickable(callback). */
  jcClickable: ((callback: () => void) => JCModifier) | null
  /** JC modifier: testID(tag). */
  jcTestID: ((tag: string) => JCModifier) | null
  /**
   * JC modifier: clip(shape). STABLE CONTRACT CHANGED: takes a built-in
   * shape config from the jc modifiers module (e.g. the `Shapes` record's
   * entries: 'circle' | 'rectangle' | corner/star configs), NOT a JCShape
   * JSX element like in canary. Passing JSX is silently ignored natively.
   */
  jcClip: ((shape: any) => JCModifier) | null
}
