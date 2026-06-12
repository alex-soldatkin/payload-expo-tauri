/**
 * FormSection — iOS Settings-style grouped inset form section, and the ONLY
 * separator owner in the form system.
 *
 * ─────────────────────────── SECTION CONTRACT ───────────────────────────
 *   - One glass card per section (GlassView on iOS 26+, surface View
 *     otherwise), cornerRadius 10, overflow hidden.
 *   - Every child renders inside a row with the canonical CONTENT_INSET
 *     (16pt) left/right — children add NO horizontal inset of their own.
 *   - Rows have a ROW_MIN_HEIGHT (44pt) floor with centered content so
 *     short/legacy controls still form a clean tappable row.
 *   - Hairline separators are drawn BETWEEN children only — never after the
 *     last child, never for a single child — inset CONTENT_INSET from the
 *     left, flush on the right. Children must render ZERO borderBottom /
 *     hairlines of their own (FieldShell enforces this for field chrome).
 *   - `title` renders OUTSIDE/above the card: uppercase 12pt muted at the
 *     CONTENT_INSET so it aligns with row content. `footer` renders below
 *     the card at the same inset.
 *   - A single-child section is one clean rounded row (no separators).
 *
 * Callers must not pass children that render as zero-height placeholders —
 * filter hidden/conditional fields BEFORE the section so separators and row
 * minimums never wrap empty rows (DocumentForm filters admin.hidden fields).
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { CONTENT_INSET, defaultTheme as t, ROW_MIN_HEIGHT } from './theme'
import { useListColors } from './hooks/useListColors'

// ---------------------------------------------------------------------------
// Optional: GlassView for liquid glass containers on iOS 26+
// ---------------------------------------------------------------------------
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
// Types
// ---------------------------------------------------------------------------

export type FormSectionProps = {
  /** Section header text (uppercase, above the card at the 16pt inset) */
  title?: string
  /** Section footer text (small muted, below the card at the 16pt inset) */
  footer?: string
  /** Children are the form rows */
  children: React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormSection({ title, footer, children }: FormSectionProps) {
  // Dark-mode aware tokens (never hardcode the light palette)
  const { colors: c } = useListColors()

  // Flatten children and drop null/false renders so separators land
  // BETWEEN real rows only (conditionally hidden fields return null).
  const validChildren = React.Children.toArray(children).filter(Boolean)

  // Build rows with hairline separators strictly between them — never after
  // the last child, never for a single child.
  const rows: React.ReactNode[] = []
  validChildren.forEach((child, index) => {
    rows.push(
      <View key={`row-${index}`} style={styles.row}>
        {child}
      </View>,
    )
    if (index < validChildren.length - 1) {
      rows.push(
        <View key={`sep-${index}`} style={[styles.separator, { backgroundColor: c.separator }]} />,
      )
    }
  })

  // Pick the container: GlassView on iOS 26+ or a plain View
  const useGlass = liquidGlassAvailable && GlassView != null

  const groupContent = <>{rows}</>

  return (
    <View style={styles.wrapper}>
      {/* ── Section header (outside/above the card) ── */}
      {title ? <Text style={[styles.title, { color: c.textMuted }]}>{title.toUpperCase()}</Text> : null}

      {/* ── Grouped glass card ── */}
      {useGlass ? (
        React.createElement(GlassView as React.ComponentType<any>, { style: styles.glassContainer, glassEffectStyle: 'regular' }, groupContent)
      ) : (
        <View style={[styles.container, { backgroundColor: c.card }]}>{groupContent}</View>
      )}

      {/* ── Section footer (below the card) ── */}
      {footer ? <Text style={[styles.footer, { color: c.textMuted }]}>{footer}</Text> : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: t.spacing.lg,
  },

  // -- Header / footer text --------------------------------------------------
  title: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: CONTENT_INSET, // aligns with row content inside the card
    paddingBottom: t.spacing.sm,
    fontWeight: '400',
  },
  footer: {
    fontSize: t.fontSize.xs,
    paddingHorizontal: CONTENT_INSET,
    paddingTop: t.spacing.sm,
    lineHeight: t.fontSize.xs * 1.4,
  },

  // -- Group container -------------------------------------------------------
  container: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  glassContainer: {
    borderRadius: 10,
    overflow: 'hidden',
  },

  // -- Row & separator -------------------------------------------------------
  // The row owns the canonical horizontal inset; vertical rhythm comes from
  // FieldShell (inline minHeight 44 / stacked padding). The minHeight floor +
  // centering keeps short/legacy controls forming a clean 44pt row.
  row: {
    paddingHorizontal: CONTENT_INSET,
    minHeight: ROW_MIN_HEIGHT,
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: CONTENT_INSET, // inset from left, flush on right
  },
})
