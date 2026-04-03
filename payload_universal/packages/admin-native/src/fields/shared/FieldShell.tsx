/**
 * Shared field wrapper — iOS 26 Mail compose style.
 *
 * Two layouts:
 *   'inline' (default) — label left, input right on a single row.
 *     Matches "To: [value]" pattern in Mail compose.
 *   'stacked' — label above, input below.
 *     Used for multiline fields (textarea, code, richText, arrays, etc.)
 *
 * Full-width hairline separator beneath each field.
 * Error text renders below the separator in red.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { defaultTheme as t } from '../../theme'

type FieldShellProps = {
  label: string
  description?: string
  required?: boolean
  error?: string
  children: React.ReactNode
  /**
   * 'inline' — label left, input right (default).
   * 'stacked' — label above, input below.
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
  if (layout === 'stacked') {
    return (
      <View style={styles.container}>
        <Text style={styles.stackedLabel}>
          {label}{required ? ':' : ':'}<Text style={styles.required}>{required ? ' *' : ''}</Text>
        </Text>
        {children}
        {description && <Text style={styles.description}>{description}</Text>}
        <View style={[styles.separator, error && styles.separatorError]} />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    )
  }

  // Inline layout: label left, children right
  return (
    <View style={styles.container}>
      <View style={styles.inlineRow}>
        <Text style={styles.inlineLabel} numberOfLines={1}>
          {label}{required ? ':' : ':'}<Text style={styles.required}>{required ? ' *' : ''}</Text>
        </Text>
        <View style={styles.inlineContent}>
          {children}
        </View>
      </View>
      {description && <Text style={styles.description}>{description}</Text>}
      <View style={[styles.separator, error && styles.separatorError]} />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

export const fieldShellStyles = StyleSheet.create({
  // Keep these for components that bypass FieldShell (checkbox native, etc.)
  container: { paddingVertical: 0 },
  label: {
    fontSize: t.fontSize.sm,
    fontWeight: '400',
    color: t.colors.textMuted,
  },
  required: { color: t.colors.error },
  description: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    marginTop: 2,
  },
  error: {
    fontSize: t.fontSize.xs,
    color: t.colors.error,
    marginTop: 3,
    marginBottom: 2,
  },
  disabledHost: { opacity: 0.5 },
})

const styles = StyleSheet.create({
  container: {
    paddingVertical: 0,
  },

  // ── Inline layout (label left, input right) ──
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  inlineLabel: {
    fontSize: t.fontSize.md,
    fontWeight: '400',
    color: t.colors.textMuted,
    marginRight: t.spacing.sm,
    flexShrink: 0,
  },
  inlineContent: {
    flex: 1,
  },

  // ── Stacked layout (label above, input below) ──
  stackedLabel: {
    fontSize: t.fontSize.md,
    fontWeight: '400',
    color: t.colors.textMuted,
    marginBottom: 6,
    marginTop: 8,
  },

  // ── Shared ──
  required: { color: t.colors.error },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.separator,
    marginTop: 0,
  },
  separatorError: {
    backgroundColor: t.colors.error,
    height: 1,
  },
  description: {
    fontSize: 12,
    color: t.colors.textPlaceholder,
    marginTop: 2,
    marginBottom: 2,
  },
  error: {
    fontSize: 12,
    color: t.colors.error,
    marginTop: 3,
    marginBottom: 2,
  },
})
