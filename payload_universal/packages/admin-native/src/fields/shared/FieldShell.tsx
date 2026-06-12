/**
 * FieldShell — THE canonical row chrome for every field component.
 *
 * ───────────────────────────── ROW CONTRACT ─────────────────────────────
 * FieldShell renders ALL label / description / error chrome. A field
 * component passes its CONTROL as children and renders NOTHING else:
 *
 *   - NO labels of its own (FieldShell owns the label).
 *   - NO borderBottom / hairline separators (FormSection is the ONLY
 *     separator owner — it draws 16pt-inset hairlines BETWEEN rows).
 *   - NO outer borders/boxes. textarea/code/json may keep a subtle filled
 *     background (rounded-8) WITHOUT borders.
 *
 * Two layouts (constants from theme: CONTENT_INSET, ROW_MIN_HEIGHT,
 * INLINE_ROW_GAP, STACKED_LABEL_GAP):
 *
 *   'inline' (default) — checkbox/toggle, date, single select, stepper
 *     number, relationship/upload value rows. minHeight 44pt, label left
 *     (15pt regular, colors.text), control/value right, 12pt gap.
 *
 *   'stacked' — text, email, textarea, code, json, point, hasMany chips.
 *     11pt uppercase muted label (letterSpacing 0.4), 4pt gap to the
 *     input; input text 16pt (the control's concern).
 *
 * Horizontal inset: NONE here — the enclosing FormSection row provides the
 * 16pt CONTENT_INSET, so label and control automatically share the grid.
 *
 * Errors render under the row in colors.error at 12pt; space is reserved
 * via marginTop ONLY when an error is present (no layout jump otherwise).
 *
 * When inside a SwiftUI Form (NativeFormContext — OPT-IN nativeForm path,
 * dormant), fields use native LabeledContent / Text captions instead; the
 * Form supplies separators and grouping.
 */
import React, { createContext, useContext } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import {
  defaultTheme as t,
  INLINE_ROW_GAP,
  ROW_MIN_HEIGHT,
  STACKED_LABEL_GAP,
} from '../../theme'
import { useListColors } from '../../hooks/useListColors'
import { nativeComponents } from './native'
import type { NativeModifier } from './types'

// ---------------------------------------------------------------------------
// NativeFormContext — set by DocumentForm when wrapping in a SwiftUI Form.
// When true, FieldShell uses LabeledContent instead of custom Views.
// ---------------------------------------------------------------------------

export const NativeFormContext = createContext(false)
export const useIsInsideNativeForm = () => useContext(NativeFormContext)

// ---------------------------------------------------------------------------
// Native caption helpers — small muted/error text rendered as SwiftUI Text
// inside Form sections. Modifiers are FACTORY CALLS from the registry
// (never object literals) and every factory is null-checked.
// ---------------------------------------------------------------------------

/** iOS systemGray — legible in both light and dark appearance. */
const NATIVE_MUTED_COLOR = '#8E8E93'

const nativeCaptionModifiers = (color: string): NativeModifier[] | undefined => {
  const mods: NativeModifier[] = []
  if (nativeComponents.font) mods.push(nativeComponents.font({ size: 13 }))
  if (nativeComponents.foregroundColor) mods.push(nativeComponents.foregroundColor(color))
  return mods.length > 0 ? mods : undefined
}

/**
 * Caption line (description / error) inside a native Form Section.
 * Prefers SwiftUI Text (proper Form row appearance); degrades to RN Text.
 */
const NativeFormCaption: React.FC<{ color: string; fallbackStyle: any; children: string }> = ({
  color,
  fallbackStyle,
  children,
}) => {
  const NativeText = nativeComponents.Text
  if (NativeText) {
    return <NativeText modifiers={nativeCaptionModifiers(color)}>{children}</NativeText>
  }
  return <Text style={fallbackStyle}>{children}</Text>
}

// ---------------------------------------------------------------------------
// FieldShell
// ---------------------------------------------------------------------------

type FieldShellProps = {
  label: string
  description?: string
  required?: boolean
  error?: string
  /** The CONTROL only — no labels, borders or separators (see row contract). */
  children: React.ReactNode
  /**
   * 'inline' (default) — minHeight-44 row, label left, control right.
   * 'stacked' — uppercase mini-label above, full-width input below.
   */
  layout?: 'inline' | 'stacked'
}

export const FieldShell: React.FC<FieldShellProps> = ({
  label,
  description,
  required,
  error,
  children,
  layout = 'inline',
}) => {
  const insideNativeForm = useIsInsideNativeForm()
  const NativeLabeledContent = nativeComponents.LabeledContent
  const NativeText = nativeComponents.Text
  // Dark-mode aware tokens for the JS layouts (the native Form path
  // inherits system appearance from SwiftUI automatically).
  const { colors: c } = useListColors()

  const displayLabel = `${label}${required ? ' *' : ''}`

  // ── Native LabeledContent path (inside a SwiftUI Form) ──
  // The Form provides separators, grouping, and scroll automatically.
  if (insideNativeForm && NativeLabeledContent && layout === 'inline') {
    return (
      <>
        <NativeLabeledContent label={displayLabel}>
          {children}
        </NativeLabeledContent>
        {description ? (
          <NativeFormCaption color={NATIVE_MUTED_COLOR} fallbackStyle={styles.description}>
            {description}
          </NativeFormCaption>
        ) : null}
        {error ? (
          <NativeFormCaption color={t.colors.error} fallbackStyle={styles.error}>
            {error}
          </NativeFormCaption>
        ) : null}
      </>
    )
  }

  // ── Inside SwiftUI Form, stacked layout (textarea/code/json) or inline
  //    without LabeledContent — minimal chrome, the Form supplies row
  //    separators and grouping (no custom hairlines inside Form cells). ──
  if (insideNativeForm) {
    return (
      <>
        {NativeText ? (
          <NativeText modifiers={nativeCaptionModifiers(NATIVE_MUTED_COLOR)}>
            {displayLabel}
          </NativeText>
        ) : (
          <Text style={[styles.stackedLabel, { color: c.textMuted }]}>{displayLabel}</Text>
        )}
        {children}
        {description ? (
          <NativeFormCaption color={NATIVE_MUTED_COLOR} fallbackStyle={styles.description}>
            {description}
          </NativeFormCaption>
        ) : null}
        {error ? (
          <NativeFormCaption color={t.colors.error} fallbackStyle={styles.error}>
            {error}
          </NativeFormCaption>
        ) : null}
      </>
    )
  }

  // ── Stacked layout (text-entry fields) ──
  if (layout === 'stacked') {
    return (
      <View style={styles.stackedContainer}>
        <Text style={[styles.stackedLabel, { color: c.textMuted }]}>{displayLabel}</Text>
        {children}
        {description ? (
          <Text style={[styles.description, { color: c.textPlaceholder }]}>{description}</Text>
        ) : null}
        {error ? <Text style={[styles.error, { color: c.error }]}>{error}</Text> : null}
      </View>
    )
  }

  // ── Inline layout (default) ──
  const hasCaption = Boolean(description) || Boolean(error)
  return (
    <View style={hasCaption ? styles.inlineContainerWithCaption : null}>
      <View style={styles.inlineRow}>
        <Text style={[styles.inlineLabel, { color: c.text }]} numberOfLines={1}>
          {displayLabel}
        </Text>
        <View style={styles.inlineContent}>{children}</View>
      </View>
      {description ? (
        <Text style={[styles.description, { color: c.textPlaceholder }]}>{description}</Text>
      ) : null}
      {error ? <Text style={[styles.error, { color: c.error }]}>{error}</Text> : null}
    </View>
  )
}

// Kept for components that bypass FieldShell (native checkbox row etc.) and
// for the disabled-host opacity treatment. Bypassing components still obey
// the row contract: no separators, no borders, captions in these styles.
export const fieldShellStyles = StyleSheet.create({
  container: { paddingVertical: 0 },
  label: {
    fontSize: t.fontSize.md,
    fontWeight: '400',
    color: t.colors.text,
  },
  required: { color: t.colors.error },
  description: {
    fontSize: 12,
    color: t.colors.textPlaceholder,
    marginTop: 2,
  },
  error: {
    fontSize: 12,
    color: t.colors.error,
    marginTop: 4,
  },
  disabledHost: { opacity: 0.5 },
})

const styles = StyleSheet.create({
  // Inline layout — minHeight 44, label left, control right, 12pt gap.
  // No vertical padding: the minHeight centers single-line content; captions
  // below add their own spacing (only when present — no layout jump).
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_MIN_HEIGHT,
    columnGap: INLINE_ROW_GAP,
  },
  inlineLabel: {
    fontSize: t.fontSize.md, // 15pt regular
    fontWeight: '400',
    flexShrink: 1,
  },
  inlineContent: { flex: 1 },
  inlineContainerWithCaption: { paddingBottom: 10 },

  // Stacked layout — uppercase mini-label, 4pt gap to the input.
  stackedContainer: {
    paddingTop: 10,
    paddingBottom: 12,
  },
  stackedLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: STACKED_LABEL_GAP,
  },

  // Captions (shared by both layouts; colors injected at render)
  description: {
    fontSize: 12,
    marginTop: 2,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
})
