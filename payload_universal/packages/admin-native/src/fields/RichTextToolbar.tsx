/**
 * RichTextToolbar — native SwiftUI ControlGroup toolbar with glass buttons.
 *
 * Uses @expo/ui ControlGroup + Button with buttonStyle('glass') on iOS.
 * Multiple ControlGroups in a horizontal ScrollView, each grouping
 * related formatting actions. Buttons reflect live style state from
 * EnrichedTextInput via `onChangeState`.
 *
 * Falls back to Pressable pill buttons when @expo/ui is unavailable.
 *
 * Layout: [B I U S <>] [🔗 📷 @] [H1 H2 H3] [❝ {}] [• 1. ☑] [⊞]
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
import { nativeComponents } from './shared'
import { NativeHost } from './NativeHost'

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
// Native toolbar — uses @expo/ui ControlGroup + Button with glass style
// ---------------------------------------------------------------------------

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

  const NativeButton = nativeComponents.Button!
  const NativeControlGroup = nativeComponents.ControlGroup!
  const glass = nativeComponents.buttonStyle!('glass')
  const small = nativeComponents.controlSize!('small')
  const activeTint = nativeComponents.tint!(t.colors.primary)

  /** Build modifiers array: glass + small + optional active tint */
  const mods = (entry?: StyleStateEntry) => {
    const m = [glass, small]
    if (entry?.isActive) m.push(activeTint)
    return m
  }

  return (
    <View style={styles.nativeContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.nativeScroll}
        keyboardShouldPersistTaps="always"
      >
        {/* Inline formatting */}
        <NativeHost matchContents={{ height: true }} style={styles.groupHost}>
          <NativeControlGroup>
            <NativeButton systemImage="bold" onPress={onToggleBold} modifiers={mods(s?.bold)} />
            <NativeButton systemImage="italic" onPress={onToggleItalic} modifiers={mods(s?.italic)} />
            <NativeButton systemImage="underline" onPress={onToggleUnderline} modifiers={mods(s?.underline)} />
            <NativeButton systemImage="strikethrough" onPress={onToggleStrikeThrough} modifiers={mods(s?.strikeThrough)} />
            <NativeButton systemImage="chevron.left.forwardslash.chevron.right" onPress={onToggleInlineCode} modifiers={mods(s?.inlineCode)} />
          </NativeControlGroup>
        </NativeHost>

        {/* Insert actions */}
        <NativeHost matchContents={{ height: true }} style={styles.groupHost}>
          <NativeControlGroup>
            <NativeButton systemImage="link" onPress={onInsertLink} modifiers={mods(s?.link)} />
            <NativeButton systemImage="photo.badge.plus" onPress={onInsertImage} modifiers={mods(s?.image)} />
            <NativeButton systemImage="at" onPress={onInsertMention} modifiers={mods(s?.mention)} />
          </NativeControlGroup>
        </NativeHost>

        {/* Headings */}
        <NativeHost matchContents={{ height: true }} style={styles.groupHost}>
          <NativeControlGroup>
            <NativeButton label="H1" onPress={onToggleH1} modifiers={mods(s?.h1)} />
            <NativeButton label="H2" onPress={onToggleH2} modifiers={mods(s?.h2)} />
            <NativeButton label="H3" onPress={onToggleH3} modifiers={mods(s?.h3)} />
          </NativeControlGroup>
        </NativeHost>

        {/* Block formatting */}
        <NativeHost matchContents={{ height: true }} style={styles.groupHost}>
          <NativeControlGroup>
            <NativeButton systemImage="text.quote" onPress={onToggleBlockQuote} modifiers={mods(s?.blockQuote)} />
            <NativeButton systemImage="curlybraces" onPress={onToggleCodeBlock} modifiers={mods(s?.codeBlock)} />
          </NativeControlGroup>
        </NativeHost>

        {/* Lists */}
        <NativeHost matchContents={{ height: true }} style={styles.groupHost}>
          <NativeControlGroup>
            <NativeButton systemImage="list.bullet" onPress={onToggleUnorderedList} modifiers={mods(s?.unorderedList)} />
            <NativeButton systemImage="list.number" onPress={onToggleOrderedList} modifiers={mods(s?.orderedList)} />
            <NativeButton systemImage="checklist" onPress={onToggleCheckboxList} modifiers={mods(s?.checkboxList)} />
          </NativeControlGroup>
        </NativeHost>

        {/* Table */}
        <NativeHost matchContents={{ height: true }} style={styles.groupHost}>
          <NativeControlGroup>
            <NativeButton systemImage="tablecells" onPress={onInsertTable} modifiers={[glass, small]} />
          </NativeControlGroup>
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
// Exported component — picks native ControlGroup or fallback
// ---------------------------------------------------------------------------

const useNativeToolbar = !!(
  nativeComponents.ControlGroup &&
  nativeComponents.Button &&
  nativeComponents.buttonStyle &&
  nativeComponents.controlSize &&
  nativeComponents.tint
)

export const RichTextToolbar: React.FC<RichTextToolbarProps> = (props) =>
  useNativeToolbar ? <NativeToolbar {...props} /> : <FallbackToolbar {...props} />

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Native ControlGroup toolbar
  nativeContainer: {
    marginBottom: t.spacing.xs,
  },
  nativeScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  groupHost: {
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
