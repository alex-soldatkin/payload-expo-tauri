/**
 * RichTextToolbar — single-row horizontal scrollable formatting bar.
 *
 * Each control is a pill-shaped toggle button with glass effect (iOS 26+).
 * Multiple controls can be active simultaneously (e.g. bold + italic).
 * Groups separated by hairline dividers.
 *
 * Layout: B I U S <> | 🔗 📎 📷 @ | H1 H2 H3 | ❝ {} | • 1. ☑ | ⊞
 */
import React from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
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
// Optional glass effect (iOS 26+)
// ---------------------------------------------------------------------------

let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch { /* not available */ }

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
// Pill toggle button — individual segment-style control
// ---------------------------------------------------------------------------

const PILL_HEIGHT = 34
const ICON_SIZE = 16

type PillProps = {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
  active?: boolean
  blocked?: boolean
  onPress: () => void
}

const PillGlass: React.FC<PillProps> = ({ icon: Icon, active = false, blocked = false, onPress }) => {
  const Glass = GlassView as React.ComponentType<any>
  return (
    <Pressable onPress={onPress} disabled={blocked} hitSlop={2}>
      <Glass
        style={[styles.pill, active && styles.pillActiveGlass, blocked && styles.pillBlocked]}
        isInteractive
        glassEffectStyle="regular"
        tintColor={active ? t.colors.primary : undefined}
      >
        <Icon
          size={ICON_SIZE}
          color={blocked ? t.colors.textPlaceholder : active ? '#fff' : t.colors.text}
          strokeWidth={active ? 2.5 : 1.8}
        />
      </Glass>
    </Pressable>
  )
}

const PillFallback: React.FC<PillProps> = ({ icon: Icon, active = false, blocked = false, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={blocked}
    hitSlop={2}
    style={({ pressed }) => [
      styles.pill,
      active && styles.pillActiveFallback,
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

const Pill = liquidGlassAvailable && GlassView ? PillGlass : PillFallback

// ---------------------------------------------------------------------------
// Divider between groups
// ---------------------------------------------------------------------------

const Divider: React.FC = () => <View style={styles.divider} />

// ---------------------------------------------------------------------------
// Main toolbar — single horizontal scroll
// ---------------------------------------------------------------------------

export const RichTextToolbar: React.FC<RichTextToolbarProps> = ({
  styleState: s,
  onToggleBold, onToggleItalic, onToggleUnderline, onToggleStrikeThrough,
  onToggleInlineCode, onToggleH1, onToggleH2, onToggleH3,
  onToggleBlockQuote, onToggleCodeBlock,
  onToggleOrderedList, onToggleUnorderedList, onToggleCheckboxList,
  onInsertLink, onInsertImage, onInsertTable, onInsertMention,
  visible,
}) => {
  if (!visible) return null

  const bar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="always"
    >
      {/* Inline formatting */}
      <Pill icon={Bold} active={s?.bold.isActive} blocked={s?.bold.isBlocking} onPress={onToggleBold} />
      <Pill icon={Italic} active={s?.italic.isActive} blocked={s?.italic.isBlocking} onPress={onToggleItalic} />
      <Pill icon={Underline} active={s?.underline.isActive} blocked={s?.underline.isBlocking} onPress={onToggleUnderline} />
      <Pill icon={Strikethrough} active={s?.strikeThrough.isActive} blocked={s?.strikeThrough.isBlocking} onPress={onToggleStrikeThrough} />
      <Pill icon={Code} active={s?.inlineCode.isActive} blocked={s?.inlineCode.isBlocking} onPress={onToggleInlineCode} />

      <Divider />

      {/* Insert actions */}
      <Pill icon={Link} active={s?.link.isActive} blocked={s?.link.isBlocking} onPress={onInsertLink} />
      <Pill icon={ImagePlus} active={s?.image.isActive} blocked={s?.image.isBlocking} onPress={onInsertImage} />
      <Pill icon={AtSign} active={s?.mention.isActive} blocked={s?.mention.isBlocking} onPress={onInsertMention} />

      <Divider />

      {/* Headings */}
      <Pill icon={Heading1} active={s?.h1.isActive} blocked={s?.h1.isBlocking} onPress={onToggleH1} />
      <Pill icon={Heading2} active={s?.h2.isActive} blocked={s?.h2.isBlocking} onPress={onToggleH2} />
      <Pill icon={Heading3} active={s?.h3.isActive} blocked={s?.h3.isBlocking} onPress={onToggleH3} />

      <Divider />

      {/* Block formatting */}
      <Pill icon={Quote} active={s?.blockQuote.isActive} blocked={s?.blockQuote.isBlocking} onPress={onToggleBlockQuote} />
      <Pill icon={FileCode} active={s?.codeBlock.isActive} blocked={s?.codeBlock.isBlocking} onPress={onToggleCodeBlock} />

      <Divider />

      {/* Lists */}
      <Pill icon={List} active={s?.unorderedList.isActive} blocked={s?.unorderedList.isBlocking} onPress={onToggleUnorderedList} />
      <Pill icon={ListOrdered} active={s?.orderedList.isActive} blocked={s?.orderedList.isBlocking} onPress={onToggleOrderedList} />
      <Pill icon={ListChecks} active={s?.checkboxList.isActive} blocked={s?.checkboxList.isBlocking} onPress={onToggleCheckboxList} />

      <Divider />

      {/* Table */}
      <Pill icon={Table2} onPress={onInsertTable} />
    </ScrollView>
  )

  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView style={styles.containerGlass} glassEffectStyle="regular">
        {bar}
      </GlassView>
    )
  }

  return <View style={styles.containerFallback}>{bar}</View>
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  containerGlass: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: t.spacing.xs,
  },
  containerFallback: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(245, 245, 245, 0.92)' : '#f5f5f5',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.separator,
    marginBottom: t.spacing.xs,
  },
  scrollContent: {
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
  pillActiveGlass: {
    // GlassView tintColor handles the fill
  },
  pillActiveFallback: {
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
