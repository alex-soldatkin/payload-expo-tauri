/**
 * Style constants + StyleSheet factory for the TextInput-based field
 * components. Fill/text colors are injected at render (useInputColors); these
 * styles carry only the static geometry and typography.
 */
import { Platform, StyleSheet } from 'react-native'

import { defaultTheme as t } from '../../theme'

// ── Textarea (stacked — multiline, auto-grows up to ~40% of the screen) ──

/** Stacked-row contract: input text is 16pt (matches the single-line tiers). */
export const TEXTAREA_FONT_SIZE = 16
export const TEXTAREA_LINE_HEIGHT = Math.round(TEXTAREA_FONT_SIZE * 1.4)
/**
 * Vertical padding lives on a WRAPPER View, never on the TextInput itself.
 * RN maps a multiline TextInput's padding to UITextView.textContainerInset on
 * iOS (and compound padding on Android EditText), so onContentSizeChange would
 * report a content size that already includes the padding. Adding the padding
 * again when applying the height makes the box taller than the content; a
 * non-scrollable UITextView's contentSize then tracks the new bounds, so the
 * next event reports the inflated size and the field grows by 2×pad per cycle
 * — an unbounded auto-grow loop. Zero padding on the input keeps the measured
 * size and the applied height in the same coordinate space.
 */
export const TEXTAREA_V_PAD = t.spacing.sm

// ── Code (stacked — monospaced with a line-number gutter and h-scroll) ──

export const CODE_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' })
export const CODE_LINE_HEIGHT = 18
/** Rough monospace advance width at fontSize.sm — used to size the no-wrap canvas. */
export const CODE_CHAR_WIDTH = t.fontSize.sm * 0.62

export const styles = StyleSheet.create({
  // Stacked single-line input — borderless, zero horizontal inset (the
  // FormSection row owns the 16pt grid), 16pt text per the row contract.
  // Matches the native NativeTextRow tier (font({ size: 16 })) pixel-for-pixel.
  stackedInput: {
    fontSize: 16,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    textAlign: 'left',
  },
  // Multiline textarea — subtle filled rounded-8 box, NO border (row
  // contract); fill color injected at render (useInputColors). Padding sits
  // on the wrapper so the input's measured content size never includes it
  // (see TEXTAREA_V_PAD).
  multilineWrapper: {
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: TEXTAREA_V_PAD,
  },
  multilineInput: {
    fontSize: TEXTAREA_FONT_SIZE,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
  },
  disabled: { opacity: 0.5 },

  // Code — filled rounded-8 box, NO border (fill injected at render).
  codeContainer: {
    flexDirection: 'row',
    borderRadius: t.borderRadius.sm,
    overflow: 'hidden',
    minHeight: 140,
  },
  codeGutter: {
    fontFamily: CODE_FONT,
    fontSize: t.fontSize.sm,
    lineHeight: CODE_LINE_HEIGHT,
    paddingVertical: t.spacing.sm,
    paddingLeft: t.spacing.sm,
    paddingRight: t.spacing.xs + 2,
    textAlign: 'right',
    minWidth: 32,
    includeFontPadding: false,
  },
  codeScroll: { flex: 1 },
  codeInput: {
    fontFamily: CODE_FONT,
    fontSize: t.fontSize.sm,
    lineHeight: CODE_LINE_HEIGHT,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.sm,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
    includeFontPadding: false,
  },

  // JSON — filled rounded-8 box, NO border (fill injected at render).
  jsonInput: {
    fontFamily: CODE_FONT,
    fontSize: t.fontSize.sm,
    lineHeight: CODE_LINE_HEIGHT,
    minHeight: 140,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.sm,
    textAlignVertical: 'top',
  },
  // Toolbar aligns to the box edge (= the 16pt grid; no extra inset).
  jsonToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs + 2,
    marginTop: t.spacing.xs,
  },
  jsonDot: { width: 8, height: 8, borderRadius: 4 },
  jsonStatus: { flex: 1, fontSize: t.fontSize.xs },
  jsonFormatButton: { fontSize: t.fontSize.sm, fontWeight: '600' },

  // Point — two borderless axis columns under the stacked label.
  pointRow: { flexDirection: 'row', gap: t.spacing.md },
  pointCol: { flex: 1 },
  pointAxisLabel: { fontSize: t.fontSize.xs, letterSpacing: 0.5, marginBottom: 2 },
})
