/**
 * Shared field wrapper — uses native SwiftUI LabeledContent when available,
 * falls back to a custom inline/stacked layout otherwise.
 *
 * When inside a SwiftUI Form (via NativeFormContext), fields automatically
 * get the iOS Mail/Settings appearance: label left, value right, native
 * separators, grouped table rows.
 *
 * Two layouts:
 *   'inline' (default) — label left, input right.
 *   'stacked' — label above, input below (multiline fields).
 */
import React, { createContext, useContext } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { defaultTheme as t } from '../../theme'
import { nativeComponents } from './native'

// ---------------------------------------------------------------------------
// NativeFormContext — set by DocumentForm when wrapping in a SwiftUI Form.
// When true, FieldShell uses LabeledContent instead of custom Views.
// ---------------------------------------------------------------------------

export const NativeFormContext = createContext(false)
export const useIsInsideNativeForm = () => useContext(NativeFormContext)

// ---------------------------------------------------------------------------
// FieldShell
// ---------------------------------------------------------------------------

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
  const insideNativeForm = useIsInsideNativeForm()
  const NativeLabeledContent = nativeComponents.LabeledContent
  const NativeText = nativeComponents.Text

  const displayLabel = `${label}${required ? ' *' : ''}`

  // ── Native LabeledContent path (inside a SwiftUI Form) ──
  // The Form provides separators, grouping, and scroll automatically.
  if (insideNativeForm && NativeLabeledContent && layout === 'inline') {
    return (
      <>
        <NativeLabeledContent label={displayLabel}>
          {children}
        </NativeLabeledContent>
        {description && NativeText ? (
          <NativeText modifiers={nativeComponents.tag ? [nativeComponents.tag('desc')] : undefined}>
            {description}
          </NativeText>
        ) : description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
        {error && <Text style={styles.error}>{error}</Text>}
      </>
    )
  }

  // ── Stacked layout inside SwiftUI Form — let the Form handle chrome ──
  if (insideNativeForm && layout === 'stacked') {
    return (
      <>
        <Text style={styles.stackedLabel}>{displayLabel}</Text>
        {children}
        {description && <Text style={styles.description}>{description}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
      </>
    )
  }

  // ── Stacked layout (multiline fields, outside native Form) ──
  if (layout === 'stacked') {
    return (
      <View style={styles.container}>
        <Text style={styles.stackedLabel}>{displayLabel}</Text>
        {children}
        {description && <Text style={styles.description}>{description}</Text>}
        <View style={[styles.separator, error && styles.separatorError]} />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    )
  }

  // ── Fallback inline layout (no native Form) ──
  return (
    <View style={styles.container}>
      <View style={styles.inlineRow}>
        <Text style={styles.inlineLabel} numberOfLines={1}>{displayLabel}</Text>
        <View style={styles.inlineContent}>{children}</View>
      </View>
      {description && <Text style={styles.description}>{description}</Text>}
      <View style={[styles.separator, error && styles.separatorError]} />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

// Keep fieldShellStyles for components that bypass FieldShell (checkbox native, etc.)
export const fieldShellStyles = StyleSheet.create({
  container: { paddingVertical: 0 },
  label: {
    fontSize: t.fontSize.sm,
    fontWeight: '400',
    color: t.colors.textMuted,
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
    marginTop: 3,
    marginBottom: 2,
  },
  disabledHost: { opacity: 0.5 },
})

const styles = StyleSheet.create({
  container: { paddingVertical: 0 },

  // Inline layout
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
  inlineContent: { flex: 1 },

  // Stacked layout
  stackedLabel: {
    fontSize: t.fontSize.md,
    fontWeight: '400',
    color: t.colors.textMuted,
    marginBottom: 6,
    marginTop: 8,
  },

  // Shared
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.separator,
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
