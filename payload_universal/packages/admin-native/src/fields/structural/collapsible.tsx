/**
 * Collapsible field — native SwiftUI Section (inside a Form) or
 * DisclosureGroup (standalone), falling back to a LayoutAnimation-based
 * custom collapsible.
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
import { defaultTheme as t } from '../../theme'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { nativeComponents, useIsInsideNativeForm } from '../shared'
import { NativeHost } from '../NativeHost'
import {
  ErrorBadge,
  GlassView,
  liquidGlassAvailable,
  renderSubFieldsWithWidth,
  subPath,
  useCompactFields,
  useErrorCountForFields,
  usePalette,
  useRenderField,
  withErrorSuffix,
} from './common'

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

  // ── Standalone: DisclosureGroup with custom container ──
  const Glass = liquidGlassAvailable ? GlassView : null
  const Container = Glass
    ? ({ children }: any) => <Glass style={styles.glassContainer} glassEffectStyle="regular">{children}</Glass>
    : ({ children }: any) => <View style={[styles.container, { borderTopColor: palette.separator }]}>{children}</View>

  return (
    <Container>
      <NativeHost>
        <DisclosureGroup label={label} isExpanded={expanded} onIsExpandedChange={setExpanded} />
      </NativeHost>
      {expanded && (
        <View style={styles.body}>
          {description && <Text style={[styles.desc, { color: palette.textFaint }]}>{description}</Text>}
          {renderedFields}
        </View>
      )}
    </Container>
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

  // ── Fallback: custom animated collapsible (error count = badge, not text) ──
  const Glass = liquidGlassAvailable ? GlassView : null
  const Wrapper = Glass
    ? ({ children, style }: any) => <Glass style={[styles.glassContainer, style]} glassEffectStyle="regular">{children}</Glass>
    : ({ children, style }: any) => <View style={[styles.container, { borderTopColor: palette.separator }, style]}>{children}</View>

  return (
    <Wrapper>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
        onPress={toggle}
      >
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: palette.text }]}>{getFieldLabel(field)}</Text>
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
        <View style={styles.body}>
          {description && <Text style={[styles.desc, { color: palette.textFaint }]}>{description}</Text>}
          {renderedFields}
        </View>
      )}
    </Wrapper>
  )
}

export const CollapsibleField: React.FC<FieldComponentProps<ClientCollapsibleField>> = (props) =>
  nativeComponents.DisclosureGroup
    ? <CollapsibleFieldNative {...props} />
    : <CollapsibleFieldFallback {...props} />

const styles = StyleSheet.create({
  container: {
    marginTop: t.spacing.xs,
    marginBottom: t.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  glassContainer: {
    marginBottom: t.spacing.xs,
    borderRadius: t.borderRadius.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    minHeight: 44,
  },
  headerPressed: { opacity: 0.6 },
  headerContent: { flex: 1 },
  title: { fontSize: t.fontSize.md, fontWeight: '500' },
  hint: { fontSize: 12, marginTop: 1 },
  chevron: { fontSize: 16, fontWeight: '600', marginLeft: t.spacing.xs },
  body: { paddingTop: 2, paddingBottom: t.spacing.sm },
  desc: { fontSize: 12, marginTop: 1, marginBottom: t.spacing.xs },
})
