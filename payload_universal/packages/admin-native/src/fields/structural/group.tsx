/**
 * Group field — named groups render as a nested sub-section that follows the
 * canonical section contract: uppercase muted header OUTSIDE/above the card
 * at the 16pt inset, one card for the body (GlassView on iOS 26+, subtle fill
 * otherwise), description as a footer BELOW the card. The body's field list
 * uses the FormSection separator system via SubFieldRows — the group draws no
 * hairlines or gutters of its own (FormSection separates the group from its
 * sibling rows). Unnamed groups render their sub-fields transparently.
 *
 * Inside a SwiftUI Form (dormant opt-in nativeForm path) a native Section is
 * used instead — the Form supplies grouping and separators.
 *
 * INTERNAL — import via the `fields/structural` barrel only.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { ClientGroupField, FieldComponentProps } from '../../types'
import { CONTENT_INSET, defaultTheme as t } from '../../theme'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { nativeComponents, useIsInsideNativeForm } from '../shared'
import {
  GlassView,
  liquidGlassAvailable,
  renderSubFieldsWithWidth,
  SubFieldRows,
  subPath,
  useCompactFields,
  usePalette,
  useRenderField,
} from './common'

export const GroupField: React.FC<FieldComponentProps<ClientGroupField>> = ({
  field, path,
}) => {
  const renderField = useRenderField()
  const compact = useCompactFields()
  const insideNativeForm = useIsInsideNativeForm()
  const palette = usePalette()
  const subFields = field.fields ?? []
  const description = getFieldDescription(field)
  const NativeSection = nativeComponents.Section

  if (!field.name) {
    return <>{renderSubFieldsWithWidth(subFields, (sub) => subPath(path, sub.name), renderField, 'group', compact)}</>
  }

  const renderedFields = renderSubFieldsWithWidth(subFields, (sub) => `${path}.${sub.name ?? ''}`, renderField, 'grp', compact)

  // ── Native Section inside a SwiftUI Form ──
  if (insideNativeForm && NativeSection) {
    return (
      <NativeSection
        title={field.label ? getFieldLabel(field) : undefined}
        footer={description ? <Text style={[styles.groupDesc, { color: palette.textFaint }]}>{description}</Text> : undefined}
      >
        {renderedFields}
      </NativeSection>
    )
  }

  // ── Fallback — canonical sub-section: header outside, one card, footer ──
  const body = <SubFieldRows>{renderedFields}</SubFieldRows>

  return (
    <View style={styles.groupWrapper}>
      {field.label ? (
        <Text style={[styles.groupLabel, { color: palette.textMuted }]}>
          {getFieldLabel(field).toUpperCase()}
        </Text>
      ) : null}
      {liquidGlassAvailable && GlassView ? (
        <GlassView style={styles.groupCard} glassEffectStyle="regular">{body}</GlassView>
      ) : (
        <View style={[styles.groupCard, { backgroundColor: palette.cardBg }]}>{body}</View>
      )}
      {description ? (
        <Text style={[styles.groupDesc, { color: palette.textFaint }]}>{description}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  groupWrapper: {
    marginTop: t.spacing.sm,
    marginBottom: t.spacing.xs,
  },
  // Section-header style — uppercase 12pt muted at the card's 16pt inset
  // (matches FormSection's title chrome).
  groupLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '400',
    paddingHorizontal: CONTENT_INSET,
    paddingBottom: t.spacing.sm,
  },
  // One card per group body — glass on iOS 26+, subtle fill otherwise.
  // No borders, no gutters: SubFieldRows owns the inner separators.
  groupCard: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  // Footer below the card at the same inset (FormSection footer chrome).
  groupDesc: {
    fontSize: 12,
    paddingHorizontal: CONTENT_INSET,
    paddingTop: t.spacing.sm,
    lineHeight: 12 * 1.4,
  },
})
