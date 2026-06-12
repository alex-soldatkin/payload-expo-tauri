/**
 * Collapsible field — canonical sub-section chrome: the toggle header sits
 * OUTSIDE/above the body card in the section-header style (uppercase 12pt
 * muted at the 16pt inset) and stays tappable; the expanded body is one card
 * (GlassView on iOS 26+, subtle fill otherwise) whose field list uses the
 * FormSection separator system via SubFieldRows. The collapsible draws no
 * hairlines of its own — FormSection separates it from sibling rows.
 *
 * Native tiers: SwiftUI Section (inside a Form — dormant opt-in path) or
 * DisclosureGroup as the header affordance, falling back to a
 * LayoutAnimation-based custom header.
 *
 * Error counts render as a badge wherever the header is a custom layout.
 * Native Section / DisclosureGroup labels are plain strings, so the count
 * folds into the label text there (badge not feasible).
 *
 * INTERNAL — import via the `fields/structural` barrel only.
 */
import React, { useRef, useState } from 'react'
import { Animated, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native'

import type { ClientCollapsibleField, FieldComponentProps } from '../../types'
import { CONTENT_INSET, defaultTheme as t } from '../../theme'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { nativeComponents, useIsInsideNativeForm } from '../shared'
import { NativeHost } from '../NativeHost'
import {
  ErrorBadge,
  GlassView,
  liquidGlassAvailable,
  renderSubFieldsWithWidth,
  SubFieldRows,
  subPath,
  useCompactFields,
  useErrorCountForFields,
  usePalette,
  useRenderField,
  withErrorSuffix,
} from './common'

/** Expanded body card — glass on iOS 26+, subtle fill otherwise. Rows render
 *  through SubFieldRows (canonical inset + separators between rows only). */
const CollapsibleBody: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const palette = usePalette()
  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView style={styles.card} glassEffectStyle="regular">
        <SubFieldRows>{children}</SubFieldRows>
      </GlassView>
    )
  }
  return (
    <View style={[styles.card, { backgroundColor: palette.cardBg }]}>
      <SubFieldRows>{children}</SubFieldRows>
    </View>
  )
}

const CollapsibleFieldNative: React.FC<FieldComponentProps<ClientCollapsibleField>> = ({
  field, path,
}) => {
  const renderField = useRenderField()
  const compact = useCompactFields()
  const insideNativeForm = useIsInsideNativeForm()
  const palette = usePalette()
  const DisclosureGroup = nativeComponents.DisclosureGroup!
  const NativeSection = nativeComponents.Section
  const [expanded, setExpanded] = useState(!(field.admin?.initCollapsed ?? false))
  const subFields = field.fields ?? []
  const description = getFieldDescription(field)
  const errorCount = useErrorCountForFields(subFields, path)

  // String-only native labels: fold the error count into the text.
  const label = withErrorSuffix(getFieldLabel(field), errorCount)

  const renderedFields = renderSubFieldsWithWidth(subFields, (sub) => subPath(path, sub.name), renderField, 'coln', compact)

  // ── Inside a SwiftUI Form: use native Section with expand/collapse ──
  if (insideNativeForm && NativeSection) {
    return (
      <NativeSection
        title={label}
        isExpanded={expanded}
        onIsExpandedChange={setExpanded}
        footer={description ? <Text style={[styles.desc, { color: palette.textFaint }]}>{description}</Text> : undefined}
      >
        {renderedFields}
      </NativeSection>
    )
  }

  // ── Standalone: DisclosureGroup header OUTSIDE the body card ──
  return (
    <View style={styles.wrapper}>
      <NativeHost>
        <DisclosureGroup label={label} isExpanded={expanded} onIsExpandedChange={setExpanded} />
      </NativeHost>
      {expanded && (
        <>
          <CollapsibleBody>{renderedFields}</CollapsibleBody>
          {description ? (
            <Text style={[styles.desc, { color: palette.textFaint }]}>{description}</Text>
          ) : null}
        </>
      )}
    </View>
  )
}

const CollapsibleFieldFallback: React.FC<FieldComponentProps<ClientCollapsibleField>> = ({
  field, path,
}) => {
  const renderField = useRenderField()
  const compact = useCompactFields()
  const insideNativeForm = useIsInsideNativeForm()
  const palette = usePalette()
  const NativeSection = nativeComponents.Section
  const [expanded, setExpanded] = useState(!(field.admin?.initCollapsed ?? false))
  const subFields = field.fields ?? []
  const description = getFieldDescription(field)
  const errorCount = useErrorCountForFields(subFields, path)

  const chevronAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current
  const rotation = chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] })

  const toggle = () => {
    const next = !expanded
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded(next)
    Animated.spring(chevronAnim, { toValue: next ? 1 : 0, useNativeDriver: true, damping: 15, stiffness: 200 }).start()
  }

  const renderedFields = renderSubFieldsWithWidth(subFields, (sub) => subPath(path, sub.name), renderField, 'colf', compact)

  // ── Inside a SwiftUI Form: use native Section with expand/collapse ──
  if (insideNativeForm && NativeSection) {
    return (
      <NativeSection
        title={withErrorSuffix(getFieldLabel(field), errorCount)}
        isExpanded={expanded}
        onIsExpandedChange={setExpanded}
        footer={description ? <Text style={[styles.desc, { color: palette.textFaint }]}>{description}</Text> : undefined}
      >
        {renderedFields}
      </NativeSection>
    )
  }

  // ── Fallback: tappable section-style header OUTSIDE the body card ──
  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        onPress={toggle}
      >
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: palette.textMuted }]}>
            {getFieldLabel(field).toUpperCase()}
          </Text>
          {!expanded && description && (
            <Text style={[styles.hint, { color: palette.textFaint }]} numberOfLines={1}>{description}</Text>
          )}
        </View>
        <ErrorBadge count={errorCount} />
        <Animated.Text style={[styles.chevron, { color: palette.textMuted, transform: [{ rotate: rotation }] }]}>
          ‹
        </Animated.Text>
      </Pressable>
      {expanded && (
        <>
          <CollapsibleBody>{renderedFields}</CollapsibleBody>
          {description ? (
            <Text style={[styles.desc, { color: palette.textFaint }]}>{description}</Text>
          ) : null}
        </>
      )}
    </View>
  )
}

export const CollapsibleField: React.FC<FieldComponentProps<ClientCollapsibleField>> = (props) =>
  nativeComponents.DisclosureGroup
    ? <CollapsibleFieldNative {...props} />
    : <CollapsibleFieldFallback {...props} />

const styles = StyleSheet.create({
  wrapper: {
    marginTop: t.spacing.xs,
    marginBottom: t.spacing.xs,
  },
  // One card per expanded body — no borders, SubFieldRows owns separators.
  card: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  // Tappable header in the section-header style (uppercase 12pt muted at the
  // card's 16pt inset) with chevron + error badge.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CONTENT_INSET,
    paddingVertical: t.spacing.sm,
    minHeight: 36,
  },
  headerPressed: { opacity: 0.6 },
  headerContent: { flex: 1 },
  title: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '400',
  },
  hint: { fontSize: 12, marginTop: 1 },
  chevron: { fontSize: 16, fontWeight: '600', marginLeft: t.spacing.xs },
  // Footer below the card at the same inset (FormSection footer chrome).
  desc: {
    fontSize: 12,
    paddingHorizontal: CONTENT_INSET,
    paddingTop: t.spacing.sm,
    lineHeight: 12 * 1.4,
  },
})
