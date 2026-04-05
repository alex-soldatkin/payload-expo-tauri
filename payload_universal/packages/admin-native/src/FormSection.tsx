/**
 * FormSection — iOS Settings-style grouped inset form section.
 *
 * Replicates the visual appearance of a SwiftUI Form > Section using pure
 * React Native Views (+ GlassView on iOS 26+ when available). Works with
 * all field types including richText, tables, and arrays — no native
 * SwiftUI dependencies required.
 *
 * Visual style:
 *   - Rounded corner group container (cornerRadius 10)
 *   - White/surface background (or liquid glass on iOS 26+)
 *   - Hairline separators between rows, inset 16px from the left
 *   - Small uppercase muted header above the group
 *   - Small muted footer below the group
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { defaultTheme as t } from './theme'

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
  /** Section header text (rendered uppercase above the group) */
  title?: string
  /** Section footer text (rendered small below the group) */
  footer?: string
  /** Children are the form rows */
  children: React.ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormSection({ title, footer, children }: FormSectionProps) {
  // Flatten children and filter out nulls so separators land correctly
  const validChildren = React.Children.toArray(children).filter(Boolean)

  // Build rows with hairline separators between them
  const rows: React.ReactNode[] = []
  validChildren.forEach((child, index) => {
    rows.push(
      <View key={`row-${index}`} style={styles.row}>
        {child}
      </View>,
    )
    if (index < validChildren.length - 1) {
      rows.push(<View key={`sep-${index}`} style={styles.separator} />)
    }
  })

  // Pick the container: GlassView on iOS 26+ or a plain View
  const useGlass = liquidGlassAvailable && GlassView != null

  const groupContent = <>{rows}</>

  return (
    <View style={styles.wrapper}>
      {/* ── Section header ── */}
      {title ? <Text style={styles.title}>{title.toUpperCase()}</Text> : null}

      {/* ── Grouped container ── */}
      {useGlass ? (
        React.createElement(GlassView as React.ComponentType<any>, { style: styles.glassContainer, glassEffectStyle: 'regular' }, groupContent)
      ) : (
        <View style={styles.container}>{groupContent}</View>
      )}

      {/* ── Section footer ── */}
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
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
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    letterSpacing: 0.5,
    paddingHorizontal: t.spacing.lg + 4, // align with row text + container inset
    paddingBottom: t.spacing.sm,
    fontWeight: '400',
  },
  footer: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    paddingHorizontal: t.spacing.lg + 4,
    paddingTop: t.spacing.sm,
    lineHeight: t.fontSize.xs * 1.4,
  },

  // -- Group container -------------------------------------------------------
  container: {
    backgroundColor: t.colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
  },
  glassContainer: {
    borderRadius: 10,
    overflow: 'hidden',
  },

  // -- Row & separator -------------------------------------------------------
  row: {
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.separator,
    marginLeft: t.spacing.lg, // inset from left, flush on right
  },
})
