/**
 * Row field — lays sub-fields out side-by-side (stacked on compact screens
 * and inside native SwiftUI Forms, which are single-column).
 *
 * Canonical grid: the enclosing FormSection row (or SubFieldRows row) owns
 * the 16pt CONTENT_INSET; this container adds NO horizontal inset, so the
 * first child's label starts at the grid and the flex children keep their
 * admin.width proportions. Children render ZERO borders/insets of their own.
 *
 * INTERNAL — import via the `fields/structural` barrel only.
 */
import React from 'react'
import { StyleSheet, View } from 'react-native'

import type { ClientRowField, FieldComponentProps } from '../../types'
import { defaultTheme as t } from '../../theme'
import { useIsInsideNativeForm } from '../shared'
import { subPath, useCompactFields, useRenderField } from './common'

export const RowField: React.FC<FieldComponentProps<ClientRowField>> = ({
  field, path,
}) => {
  const renderField = useRenderField()
  const compact = useCompactFields()
  const insideNativeForm = useIsInsideNativeForm()

  // ── Inside a SwiftUI Form: always stack vertically (single-column cells) ──
  if (insideNativeForm) {
    return (
      <>
        {(field.fields ?? []).map((sub, i) => (
          <React.Fragment key={sub.name || `row-${i}`}>
            {renderField(sub, subPath(path, sub.name))}
          </React.Fragment>
        ))}
      </>
    )
  }

  // ── Fallback ──
  return (
    <View style={compact ? styles.rowContainerCompact : styles.rowContainer}>
      {(field.fields ?? []).map((sub, i) => (
        <View
          key={sub.name || `row-${i}`}
          style={compact
            ? undefined  // full-width stacked
            : [styles.rowItem, sub.admin?.width ? { flex: parseFloat(sub.admin.width) / 100 } : { flex: 1 }]
          }
        >
          {renderField(sub, subPath(path, sub.name))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  rowContainer: { flexDirection: 'row', gap: t.spacing.md },
  rowContainerCompact: { flexDirection: 'column', gap: 0 },
  rowItem: { flex: 1 },
})
