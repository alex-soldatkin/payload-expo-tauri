/**
 * RichTextToolbar — native SwiftUI glass toolbar with a JS pill fallback.
 *
 * iOS native tier (canary @expo/ui has NO ControlGroup — never use it):
 *   GlassEffectContainer wrapping HStack groups of Buttons inside a single
 *   NativeHost, all inside a horizontal RN ScrollView for overflow.
 *   - inactive:  buttonStyle('glass')          (bordered pre-iOS 26)
 *   - active:    buttonStyle('glassProminent') + tint (borderedProminent pre-26)
 *   - blocking:  disabled(true)
 *   SwiftUI Divider separates groups. Active/blocking state tracks the same
 *   `styleState` fed by EnrichedTextInput's `onChangeState` as the JS tier.
 *   Namespace/glassEffectId are intentionally NOT used: the glass button
 *   styles already participate in the GlassEffectContainer blend, and
 *   glassEffect modifiers must not be applied to gesture-owning controls.
 *
 * Fallback tier (Android + anywhere the registry entries are null):
 *   Pressable pill buttons.
 *
 * Layout: [B I U S <>] | [🔗 📷 @] | [H1 H2 H3] | [❝ {}] | [• 1. ☑] | [⊞]
 */
import React from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import {
  AtSign,
  Bold,
  Code,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Strikethrough,
  Table2,
  Underline,
} from 'lucide-react-native'
import { defaultTheme as t } from '../theme'
import { nativeComponents, type NativeModifier } from './shared'
import { NativeHost } from './NativeHost'

// Liquid glass availability (iOS 26+). Guarded require — expo-glass-effect is
// an optional peer; absence (or older iOS) selects the bordered button tier.
let liquidGlassAvailable = false
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const glassModule = require('expo-glass-effect')
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed — bordered fallback tier */
}

// ---------------------------------------------------------------------------
// Types — matches react-native-enriched OnChangeStateEvent shape
// ---------------------------------------------------------------------------

export type StyleStateEntry = {
  isActive: boolean
  isBlocking: boolean
  isConflicting: boolean
}

export type StyleState = {
  bold: StyleStateEntry
  italic: StyleStateEntry
  underline: StyleStateEntry
  strikeThrough: StyleStateEntry
  inlineCode: StyleStateEntry
  h1: StyleStateEntry
  h2: StyleStateEntry
  h3: StyleStateEntry
  h4: StyleStateEntry
  h5: StyleStateEntry
  h6: StyleStateEntry
  codeBlock: StyleStateEntry
  blockQuote: StyleStateEntry
  orderedList: StyleStateEntry
  unorderedList: StyleStateEntry
  checkboxList: StyleStateEntry
  link: StyleStateEntry
  image: StyleStateEntry
  mention: StyleStateEntry
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type RichTextToolbarProps = {
  styleState: StyleState | null
  onToggleBold: () => void
  onToggleItalic: () => void
  onToggleUnderline: () => void
  onToggleStrikeThrough: () => void
  onToggleInlineCode: () => void
  onToggleH1: () => void
  onToggleH2: () => void
  onToggleH3: () => void
  onToggleBlockQuote: () => void
  onToggleCodeBlock: () => void
  onToggleOrderedList: () => void
  onToggleUnorderedList: () => void
  onToggleCheckboxList: () => void
  onInsertLink: () => void
  onInsertImage: () => void
  onInsertTable: () => void
  onInsertMention: () => void
  visible: boolean
}

// ---------------------------------------------------------------------------
// Native toolbar — GlassEffectContainer + HStack groups of glass Buttons
// ---------------------------------------------------------------------------

type NativeItem = {
  key: string
  /** SF Symbol name (icon buttons). */
  systemImage?: string
  /** Text label (H1/H2/H3 buttons). */
  text?: string
  /** Live style state entry driving active/blocking modifiers. */
  entry?: StyleStateEntry
  onPress: () => void
}

/** Distance at which adjacent glass pills begin to blend in the container. */
const GLASS_BLEND_SPACING = 10
const GROUP_SPACING = 8
const BUTTON_SPACING = 2

const NativeToolbar: React.FC<RichTextToolbarProps> = ({
  styleState: s,
  onToggleBold, onToggleItalic, onToggleUnderline, onToggleStrikeThrough,
  onToggleInlineCode, onToggleH1, onToggleH2, onToggleH3,
  onToggleBlockQuote, onToggleCodeBlock,
  onToggleOrderedList, onToggleUnorderedList, onToggleCheckboxList,
  onInsertLink, onInsertImage, onInsertTable, onInsertMention,
  visible,
}) => {
  if (!visible) return null

  // All entries below are guaranteed non-null by the `useNativeToolbar`
  // registry gate — the fallback toolbar renders otherwise.
  const NativeButton = nativeComponents.Button!
  const NativeHStack = nativeComponents.HStack!
  const NativeGlassContainer = nativeComponents.GlassEffectContainer!
  const NativeDivider = nativeComponents.Divider!
  const buttonStyle = nativeComponents.buttonStyle!
  const controlSize = nativeComponents.controlSize!
  const tint = nativeComponents.tint!
  const disabledMod = nativeComponents.disabled!
  // Optional polish — only applied when the factory exists.
  const frame = nativeComponents.frame

  // Glass tiers: liquid glass (iOS 26+) with graceful bordered fallback.
  // The Swift side additionally degrades glass styles to .automatic when
  // unavailable, so this is belt and braces.
  const inactiveStyle = buttonStyle(liquidGlassAvailable ? 'glass' : 'bordered')
  const activeStyle = buttonStyle(liquidGlassAvailable ? 'glassProminent' : 'borderedProminent')
  const small = controlSize('small')
  const activeTint = tint(t.colors.primary)

  /** Modifiers per button: style by active state, small size, disabled when blocking. */
  const mods = (entry?: StyleStateEntry): NativeModifier[] => {
    const m: NativeModifier[] = [entry?.isActive ? activeStyle : inactiveStyle, small]
    if (entry?.isActive) m.push(activeTint)
    if (entry?.isBlocking) m.push(disabledMod(true))
    return m
  }

  const groups: NativeItem[][] = [
    [
      { key: 'bold', systemImage: 'bold', entry: s?.bold, onPress: onToggleBold },
      { key: 'italic', systemImage: 'italic', entry: s?.italic, onPress: onToggleItalic },
      { key: 'underline', systemImage: 'underline', entry: s?.underline, onPress: onToggleUnderline },
      { key: 'strikeThrough', systemImage: 'strikethrough', entry: s?.strikeThrough, onPress: onToggleStrikeThrough },
      { key: 'inlineCode', systemImage: 'chevron.left.forwardslash.chevron.right', entry: s?.inlineCode, onPress: onToggleInlineCode },
    ],
    [
      { key: 'link', systemImage: 'link', entry: s?.link, onPress: onInsertLink },
      { key: 'image', systemImage: 'photo.badge.plus', entry: s?.image, onPress: onInsertImage },
      { key: 'mention', systemImage: 'at', entry: s?.mention, onPress: onInsertMention },
    ],
    [
      { key: 'h1', text: 'H1', entry: s?.h1, onPress: onToggleH1 },
      { key: 'h2', text: 'H2', entry: s?.h2, onPress: onToggleH2 },
      { key: 'h3', text: 'H3', entry: s?.h3, onPress: onToggleH3 },
    ],
    [
      { key: 'blockQuote', systemImage: 'text.quote', entry: s?.blockQuote, onPress: onToggleBlockQuote },
      { key: 'codeBlock', systemImage: 'curlybraces', entry: s?.codeBlock, onPress: onToggleCodeBlock },
    ],
    [
      { key: 'unorderedList', systemImage: 'list.bullet', entry: s?.unorderedList, onPress: onToggleUnorderedList },
      { key: 'orderedList', systemImage: 'list.number', entry: s?.orderedList, onPress: onToggleOrderedList },
      { key: 'checkboxList', systemImage: 'checklist', entry: s?.checkboxList, onPress: onToggleCheckboxList },
    ],
    [
      { key: 'table', systemImage: 'tablecells', onPress: onInsertTable },
    ],
  ]

  const dividerMods = frame ? [frame({ height: 20 })] : undefined

  return (
    <View style={styles.nativeContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.nativeScroll}
        keyboardShouldPersistTaps="always"
      >
        {/*
          Single Host matching BOTH axes: inside a horizontal ScrollView the
          toolbar must report its intrinsic width to RN so the scroller can
          overflow (the width-filling `{ height: true }` convention does not
          apply here — there is no bounded parent width to fill).
        */}
        <NativeHost matchContents style={styles.nativeHost}>
          <NativeGlassContainer spacing={GLASS_BLEND_SPACING}>
            <NativeHStack spacing={GROUP_SPACING} alignment="center">
              {groups.map((group, gi) => (
                <React.Fragment key={`group-${gi}`}>
                  {gi > 0 && <NativeDivider modifiers={dividerMods} />}
                  <NativeHStack spacing={BUTTON_SPACING} alignment="center">
                    {group.map((item) => (
                      <NativeButton
                        key={item.key}
                        // Swift Button renders Label(label, systemImage:) only
                        // when `label` is non-nil — pass '' for icon-only.
                        label={item.text ?? ''}
                        systemImage={item.systemImage}
                        onPress={item.onPress}
                        modifiers={mods(item.entry)}
                      />
                    ))}
                  </NativeHStack>
                </React.Fragment>
              ))}
            </NativeHStack>
          </NativeGlassContainer>
        </NativeHost>
      </ScrollView>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Fallback toolbar — Pressable pills (non-iOS / no @expo/ui)
// ---------------------------------------------------------------------------

const PILL_HEIGHT = 34
const ICON_SIZE = 16

type PillProps = {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
  active?: boolean
  blocked?: boolean
  onPress: () => void
}

const Pill: React.FC<PillProps> = ({ icon: Icon, active = false, blocked = false, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={blocked}
    hitSlop={2}
    style={({ pressed }) => [
      styles.pill,
      active && styles.pillActive,
      blocked && styles.pillBlocked,
      pressed && !blocked && styles.pillPressed,
    ]}
  >
    <Icon
      size={ICON_SIZE}
      color={blocked ? t.colors.textPlaceholder : active ? '#fff' : t.colors.textMuted}
      strokeWidth={active ? 2.5 : 1.8}
    />
  </Pressable>
)

const Divider: React.FC = () => <View style={styles.divider} />

const FallbackToolbar: React.FC<RichTextToolbarProps> = ({
  styleState: s,
  onToggleBold, onToggleItalic, onToggleUnderline, onToggleStrikeThrough,
  onToggleInlineCode, onToggleH1, onToggleH2, onToggleH3,
  onToggleBlockQuote, onToggleCodeBlock,
  onToggleOrderedList, onToggleUnorderedList, onToggleCheckboxList,
  onInsertLink, onInsertImage, onInsertTable, onInsertMention,
  visible,
}) => {
  if (!visible) return null

  return (
    <View style={styles.fallbackContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.fallbackScroll}
        keyboardShouldPersistTaps="always"
      >
        <Pill icon={Bold} active={s?.bold.isActive} blocked={s?.bold.isBlocking} onPress={onToggleBold} />
        <Pill icon={Italic} active={s?.italic.isActive} blocked={s?.italic.isBlocking} onPress={onToggleItalic} />
        <Pill icon={Underline} active={s?.underline.isActive} blocked={s?.underline.isBlocking} onPress={onToggleUnderline} />
        <Pill icon={Strikethrough} active={s?.strikeThrough.isActive} blocked={s?.strikeThrough.isBlocking} onPress={onToggleStrikeThrough} />
        <Pill icon={Code} active={s?.inlineCode.isActive} blocked={s?.inlineCode.isBlocking} onPress={onToggleInlineCode} />
        <Divider />
        <Pill icon={Link} active={s?.link.isActive} blocked={s?.link.isBlocking} onPress={onInsertLink} />
        <Pill icon={ImagePlus} active={s?.image.isActive} blocked={s?.image.isBlocking} onPress={onInsertImage} />
        <Pill icon={AtSign} active={s?.mention.isActive} blocked={s?.mention.isBlocking} onPress={onInsertMention} />
        <Divider />
        <Pill icon={Heading1} active={s?.h1.isActive} blocked={s?.h1.isBlocking} onPress={onToggleH1} />
        <Pill icon={Heading2} active={s?.h2.isActive} blocked={s?.h2.isBlocking} onPress={onToggleH2} />
        <Pill icon={Heading3} active={s?.h3.isActive} blocked={s?.h3.isBlocking} onPress={onToggleH3} />
        <Divider />
        <Pill icon={Quote} active={s?.blockQuote.isActive} blocked={s?.blockQuote.isBlocking} onPress={onToggleBlockQuote} />
        <Pill icon={FileCode} active={s?.codeBlock.isActive} blocked={s?.codeBlock.isBlocking} onPress={onToggleCodeBlock} />
        <Divider />
        <Pill icon={List} active={s?.unorderedList.isActive} blocked={s?.unorderedList.isBlocking} onPress={onToggleUnorderedList} />
        <Pill icon={ListOrdered} active={s?.orderedList.isActive} blocked={s?.orderedList.isBlocking} onPress={onToggleOrderedList} />
        <Pill icon={ListChecks} active={s?.checkboxList.isActive} blocked={s?.checkboxList.isBlocking} onPress={onToggleCheckboxList} />
        <Divider />
        <Pill icon={Table2} onPress={onInsertTable} />
      </ScrollView>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Exported component — picks native glass toolbar or JS pill fallback
// ---------------------------------------------------------------------------

// Every component/modifier used by NativeToolbar must be verified non-null
// here (registry entries are null on Android and in Expo Go). Android always
// falls through to the JS pill toolbar.
const useNativeToolbar =
  Platform.OS === 'ios' &&
  !!(
    nativeComponents.Button &&
    nativeComponents.HStack &&
    nativeComponents.GlassEffectContainer &&
    nativeComponents.Divider &&
    nativeComponents.buttonStyle &&
    nativeComponents.controlSize &&
    nativeComponents.tint &&
    nativeComponents.disabled
  )

export const RichTextToolbar: React.FC<RichTextToolbarProps> = (props) =>
  useNativeToolbar ? <NativeToolbar {...props} /> : <FallbackToolbar {...props} />

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Native glass toolbar
  nativeContainer: {
    marginBottom: t.spacing.xs,
  },
  nativeScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  nativeHost: {
    flexShrink: 0,
  },

  // Fallback toolbar
  fallbackContainer: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(245, 245, 245, 0.92)' : '#f5f5f5',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.separator,
    marginBottom: t.spacing.xs,
  },
  fallbackScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 4,
  },
  pill: {
    height: PILL_HEIGHT,
    width: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: t.colors.primary,
  },
  pillBlocked: {
    opacity: 0.25,
  },
  pillPressed: {
    opacity: 0.5,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: t.colors.separator,
    marginHorizontal: 3,
  },
})
