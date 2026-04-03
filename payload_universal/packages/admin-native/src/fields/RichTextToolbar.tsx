/**
 * RichTextToolbar -- Apple Notes-style formatting toolbar with glass effect.
 *
 * Two rows of formatting actions rendered in a compact bar that sits above
 * the keyboard. Each button reflects the current style state reported by
 * EnrichedTextInput via `onChangeState`.
 *
 * Row 1 (inline): Bold, Italic, Underline, Strikethrough, InlineCode | Link, Mention
 * Row 2 (block):  H1, H2, H3 | Quote, CodeBlock | BulletList, NumberedList, CheckList
 */
import React, { useMemo } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import {
  AtSign,
  Bold,
  Code,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react-native'
import { defaultTheme as t } from '../theme'

// ---------------------------------------------------------------------------
// Types — matches react-native-enriched OnChangeStateEvent shape exactly
// ---------------------------------------------------------------------------

/** Per-style state triple from EnrichedTextInput.onChangeState */
export type StyleStateEntry = {
  isActive: boolean
  isBlocking: boolean
  isConflicting: boolean
}

/** Mirrors the OnChangeStateEvent from react-native-enriched */
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

// Optional glass effect -- falls back to semi-transparent background
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
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
  onInsertMention: () => void
  visible: boolean
}

// ---------------------------------------------------------------------------
// Individual toolbar button
// ---------------------------------------------------------------------------

type ToolbarButtonProps = {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
  active?: boolean
  blocked?: boolean
  onPress: () => void
}

const BUTTON_SIZE = 36
const ICON_SIZE = 18

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon: Icon,
  active = false,
  blocked = false,
  onPress,
}) => (
  <Pressable
    style={({ pressed }) => [
      styles.button,
      active && styles.buttonActive,
      blocked && styles.buttonDisabled,
      pressed && !blocked && styles.buttonPressed,
    ]}
    onPress={onPress}
    disabled={blocked}
    hitSlop={4}
  >
    <Icon
      size={ICON_SIZE}
      color={
        blocked
          ? t.colors.textPlaceholder
          : active
            ? t.colors.primary
            : t.colors.textMuted
      }
      strokeWidth={active ? 2.5 : 2}
    />
  </Pressable>
)

// ---------------------------------------------------------------------------
// Separator
// ---------------------------------------------------------------------------

const Separator: React.FC = () => <View style={styles.separator} />

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const RichTextToolbar: React.FC<RichTextToolbarProps> = ({
  styleState,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
  onToggleStrikeThrough,
  onToggleInlineCode,
  onToggleH1,
  onToggleH2,
  onToggleH3,
  onToggleBlockQuote,
  onToggleCodeBlock,
  onToggleOrderedList,
  onToggleUnorderedList,
  onToggleCheckboxList,
  onInsertLink,
  onInsertMention,
  visible,
}) => {
  if (!visible) return null

  const s = styleState

  const content = (
    <View style={styles.toolbarInner}>
      {/* Row 1: Inline formatting */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="always"
      >
        <ToolbarButton icon={Bold} active={s?.bold.isActive} blocked={s?.bold.isBlocking} onPress={onToggleBold} />
        <ToolbarButton icon={Italic} active={s?.italic.isActive} blocked={s?.italic.isBlocking} onPress={onToggleItalic} />
        <ToolbarButton icon={Underline} active={s?.underline.isActive} blocked={s?.underline.isBlocking} onPress={onToggleUnderline} />
        <ToolbarButton icon={Strikethrough} active={s?.strikeThrough.isActive} blocked={s?.strikeThrough.isBlocking} onPress={onToggleStrikeThrough} />
        <ToolbarButton icon={Code} active={s?.inlineCode.isActive} blocked={s?.inlineCode.isBlocking} onPress={onToggleInlineCode} />
        <Separator />
        <ToolbarButton icon={Link} active={s?.link.isActive} blocked={s?.link.isBlocking} onPress={onInsertLink} />
        <ToolbarButton icon={AtSign} active={s?.mention.isActive} blocked={s?.mention.isBlocking} onPress={onInsertMention} />
      </ScrollView>

      {/* Row 2: Block formatting */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="always"
      >
        <ToolbarButton icon={Heading1} active={s?.h1.isActive} blocked={s?.h1.isBlocking} onPress={onToggleH1} />
        <ToolbarButton icon={Heading2} active={s?.h2.isActive} blocked={s?.h2.isBlocking} onPress={onToggleH2} />
        <ToolbarButton icon={Heading3} active={s?.h3.isActive} blocked={s?.h3.isBlocking} onPress={onToggleH3} />
        <Separator />
        <ToolbarButton icon={Quote} active={s?.blockQuote.isActive} blocked={s?.blockQuote.isBlocking} onPress={onToggleBlockQuote} />
        <ToolbarButton icon={FileCode} active={s?.codeBlock.isActive} blocked={s?.codeBlock.isBlocking} onPress={onToggleCodeBlock} />
        <Separator />
        <ToolbarButton icon={List} active={s?.unorderedList.isActive} blocked={s?.unorderedList.isBlocking} onPress={onToggleUnorderedList} />
        <ToolbarButton icon={ListOrdered} active={s?.orderedList.isActive} blocked={s?.orderedList.isBlocking} onPress={onToggleOrderedList} />
        <ToolbarButton icon={ListChecks} active={s?.checkboxList.isActive} blocked={s?.checkboxList.isBlocking} onPress={onToggleCheckboxList} />
      </ScrollView>
    </View>
  )

  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView style={styles.toolbarContainer} glassEffectStyle="regular">
        {content}
      </GlassView>
    )
  }

  return <View style={styles.toolbarContainerFallback}>{content}</View>
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  toolbarContainer: {
    borderRadius: t.borderRadius.md,
    overflow: 'hidden',
    marginBottom: t.spacing.xs,
  },
  toolbarContainerFallback: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(245, 245, 245, 0.92)' : '#f5f5f5',
    borderRadius: t.borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.separator,
    marginBottom: t.spacing.xs,
  },
  toolbarInner: {
    paddingVertical: t.spacing.xs,
    paddingHorizontal: t.spacing.xs,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: t.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.06)',
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonPressed: {
    opacity: 0.5,
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: t.colors.separator,
    marginHorizontal: 4,
  },
})
