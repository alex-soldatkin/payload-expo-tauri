/**
 * VersionDiff — renders a field-by-field comparison between two document versions.
 *
 * Walks the collection's field schema and highlights changed values:
 *   - Old value: light red background with red left border
 *   - New value: light blue background with blue left border
 *
 * For complex types (arrays, blocks, rich text, JSON), falls back to formatted
 * JSON diff. Structural fields (groups, tabs, rows, collapsibles) are traversed
 * recursively to compare their sub-fields.
 */
import React, { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native'

import type { ClientField } from './types'
import { getFieldLabel } from './utils/schemaHelpers'
import { defaultTheme as t } from './theme'

type Props = {
  /** Field definitions for this collection. */
  fields: ClientField[]
  /** The older version's data (comparing against). */
  versionFrom: Record<string, unknown>
  /** The newer version's data (currently viewing). */
  versionTo: Record<string, unknown>
  /** Only show fields that changed. Defaults to true. */
  modifiedOnly?: boolean
}

// ---------------------------------------------------------------------------
// Deep equality check
// ---------------------------------------------------------------------------

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  const jsonA = JSON.stringify(a)
  const jsonB = JSON.stringify(b)
  return jsonA === jsonB
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

const formatValue = (value: unknown, fieldType?: string): string => {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    if (fieldType === 'date' || fieldType === 'dateTime') {
      try {
        return new Date(value).toLocaleString()
      } catch {
        return value
      }
    }
    return value
  }
  if (Array.isArray(value)) return JSON.stringify(value, null, 2)
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

// ---------------------------------------------------------------------------
// DiffRow — single field comparison
// ---------------------------------------------------------------------------

const DiffRow: React.FC<{
  label: string
  valueFrom: unknown
  valueTo: unknown
  fieldType?: string
}> = ({ label, valueFrom, valueTo, fieldType }) => {
  const fromStr = formatValue(valueFrom, fieldType)
  const toStr = formatValue(valueTo, fieldType)
  const isComplex = typeof valueFrom === 'object' || typeof valueTo === 'object'

  return (
    <View style={styles.diffRow}>
      <Text style={styles.diffLabel}>{label}</Text>
      <View style={isComplex ? styles.diffValuesVertical : styles.diffValues}>
        <View style={[styles.diffOldBox, isComplex && styles.diffBoxFullWidth]}>
          <Text style={[styles.diffValueText, isComplex && styles.diffValueMono]} numberOfLines={isComplex ? undefined : 3}>
            {fromStr}
          </Text>
        </View>
        <View style={[styles.diffNewBox, isComplex && styles.diffBoxFullWidth]}>
          <Text style={[styles.diffValueText, isComplex && styles.diffValueMono]} numberOfLines={isComplex ? undefined : 3}>
            {toStr}
          </Text>
        </View>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Field tree walker
// ---------------------------------------------------------------------------

type DiffEntry = {
  label: string
  valueFrom: unknown
  valueTo: unknown
  fieldType?: string
  changed: boolean
}

const collectDiffs = (
  fields: ClientField[],
  from: Record<string, unknown>,
  to: Record<string, unknown>,
  prefix = '',
): DiffEntry[] => {
  const entries: DiffEntry[] = []

  for (const field of fields) {
    const name = field.name
    const type = field.type

    // Structural fields without their own name — traverse sub-fields
    if (!name && type === 'row' && field.fields) {
      entries.push(...collectDiffs(field.fields as ClientField[], from, to, prefix))
      continue
    }
    if (!name && type === 'collapsible' && field.fields) {
      entries.push(...collectDiffs(field.fields as ClientField[], from, to, prefix))
      continue
    }
    if (!name && type === 'tabs' && field.tabs) {
      for (const tab of field.tabs) {
        const tabFields = (tab as { fields?: ClientField[] }).fields
        const tabName = (tab as { name?: string }).name
        if (tabFields) {
          if (tabName) {
            // Named tab — data is nested under tab.name
            const tabFrom = (from[tabName] ?? {}) as Record<string, unknown>
            const tabTo = (to[tabName] ?? {}) as Record<string, unknown>
            entries.push(...collectDiffs(tabFields, tabFrom, tabTo, prefix ? `${prefix}.${tabName}` : tabName))
          } else {
            // Unnamed tab — data lives at the parent level
            entries.push(...collectDiffs(tabFields, from, to, prefix))
          }
        }
      }
      continue
    }

    if (!name) continue

    const path = prefix ? `${prefix}.${name}` : name
    const valueFrom = from[name]
    const valueTo = to[name]
    const label = getFieldLabel(field, name)
    const changed = !deepEqual(valueFrom, valueTo)

    // Group fields — recurse
    if (type === 'group' && field.fields) {
      const groupFrom = (valueFrom ?? {}) as Record<string, unknown>
      const groupTo = (valueTo ?? {}) as Record<string, unknown>
      entries.push(...collectDiffs(field.fields as ClientField[], groupFrom, groupTo, path))
      continue
    }

    entries.push({ label, valueFrom, valueTo, fieldType: type, changed })
  }

  return entries
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const VersionDiff: React.FC<Props> = ({
  fields,
  versionFrom,
  versionTo,
  modifiedOnly: initialModifiedOnly = true,
}) => {
  const [modifiedOnly, setModifiedOnly] = useState(initialModifiedOnly)

  const allEntries = useMemo(
    () => collectDiffs(fields, versionFrom, versionTo),
    [fields, versionFrom, versionTo],
  )

  const visibleEntries = useMemo(
    () => modifiedOnly ? allEntries.filter((e) => e.changed) : allEntries,
    [allEntries, modifiedOnly],
  )

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Modified only</Text>
        <Switch
          value={modifiedOnly}
          onValueChange={setModifiedOnly}
          trackColor={{ false: '#ddd', true: '#000' }}
          thumbColor="#fff"
        />
      </View>

      {visibleEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {modifiedOnly ? 'No fields were modified between these versions.' : 'No fields to display.'}
          </Text>
        </View>
      ) : (
        visibleEntries.map((entry, i) => (
          <DiffRow
            key={`${entry.label}-${i}`}
            label={entry.label}
            valueFrom={entry.valueFrom}
            valueTo={entry.valueTo}
            fieldType={entry.fieldType}
          />
        ))
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: t.spacing.sm,
    marginBottom: t.spacing.sm,
  },
  toggleLabel: {
    fontSize: t.fontSize.sm,
    color: t.colors.textMuted,
    fontWeight: '500',
  },

  // Diff row
  diffRow: {
    paddingVertical: t.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
  },
  diffLabel: {
    fontSize: t.fontSize.sm,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: t.spacing.sm,
  },
  diffValues: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  diffValuesVertical: {
    flexDirection: 'column',
    gap: t.spacing.sm,
  },
  diffOldBox: {
    flex: 1,
    backgroundColor: '#fef2f2',
    borderLeftWidth: 3,
    borderLeftColor: '#fca5a5',
    padding: t.spacing.sm,
    borderRadius: 4,
  },
  diffNewBox: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderLeftWidth: 3,
    borderLeftColor: '#93c5fd',
    padding: t.spacing.sm,
    borderRadius: 4,
  },
  diffBoxFullWidth: {
    flex: undefined,
  },
  diffValueText: {
    fontSize: t.fontSize.sm,
    color: t.colors.text,
  },
  diffValueMono: {
    fontFamily: 'monospace',
    fontSize: t.fontSize.xs,
  },

  // Empty
  emptyState: {
    padding: t.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: t.fontSize.sm,
    color: t.colors.textMuted,
    textAlign: 'center',
  },
})
