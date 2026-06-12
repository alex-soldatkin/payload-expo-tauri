/**
 * Group field — named groups render as a titled section (native SwiftUI
 * Section inside a Form, GlassView card on iOS 26+, plain section otherwise).
 * Unnamed groups render their sub-fields transparently.
 *
 * INTERNAL — import via the `fields/structural` barrel only.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { ClientGroupField, FieldComponentProps } from '../../types'
import { defaultTheme as t } from '../../theme'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { nativeComponents, useIsInsideNativeForm } from '../shared'
import {
  GlassView,
  liquidGlassAvailable,
  renderSubFieldsWithWidth,
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

  // ── Fallback ──
  const content = (
    <>
      {field.label && (
        <View style={styles.groupHeader}>
          <Text style={[styles.groupLabel, { color: palette.textMuted }]}>{getFieldLabel(field)}</Text>
          {description && <Text style={[styles.groupDesc, { color: palette.textFaint }]}>{description}</Text>}
        </View>
      )}
      <View style={styles.groupBody}>{renderedFields}</View>
    </>
  )

  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView
        style={[
          styles.glassGroupCard,
          !(field.admin?.hideGutter ?? false) && [styles.groupGutter, { borderLeftColor: palette.textMuted }],
        ]}
        glassEffectStyle="regular"
      >
        {content}
      </GlassView>
    )
  }

  return (
    <View
      style={[
        styles.groupCard,
        { borderTopColor: palette.separator },
        !(field.admin?.hideGutter ?? false) && [styles.groupGutter, { borderLeftColor: palette.textMuted }],
      ]}
    >
      {content}
    </View>
  )
}

const styles = StyleSheet.create({
  // Group — clean section divider (no card/shadow)
  groupCard: {
    marginTop: t.spacing.sm,
    marginBottom: t.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: t.spacing.xs,
  },
  glassGroupCard: {
    marginBottom: t.spacing.xs,
    borderRadius: t.borderRadius.md,
    overflow: 'hidden',
  },
  groupGutter: { borderLeftWidth: 2 },
  groupHeader: { paddingVertical: 4 },
  groupLabel: { fontSize: t.fontSize.sm, fontWeight: '600' },
  groupDesc: { fontSize: 12, marginTop: 1, marginBottom: t.spacing.xs },
  groupBody: {},
})
