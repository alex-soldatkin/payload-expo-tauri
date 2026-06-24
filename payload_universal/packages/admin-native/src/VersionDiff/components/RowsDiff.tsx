import React, { useMemo } from 'react'
import { Text, View } from 'react-native'

import type { ClientArrayField, ClientBlocksField, ClientField } from '../../types'
import { useDiffTheme } from '../theme'
import type { RowPair, RowRecord } from '../types'
import { collectDiffs, compactValue, isEmptyValue, isRecord, pairRows } from '../utils'
import { DiffBody } from './DiffBody'

// ---------------------------------------------------------------------------
// Array / blocks per-row diff
// ---------------------------------------------------------------------------

/** Added / removed row card: badge + one-sided sub-field summary. */
export const RowCard: React.FC<{
  status: 'added' | 'removed'
  row: RowRecord
  num: number
  subFields: ClientField[]
  singular: string
  blockLabel?: string
}> = ({ status, row, num, subFields, singular, blockLabel }) => {
  const { styles } = useDiffTheme()
  const added = status === 'added'

  const lines = useMemo(() => {
    const entries = added
      ? collectDiffs(subFields, {}, row)
      : collectDiffs(subFields, row, {})
    return entries
      .map((e) => ({ label: e.label, field: e.field, value: added ? e.valueTo : e.valueFrom }))
      .filter((l) => l.field.name !== 'id' && !isEmptyValue(l.value))
  }, [added, subFields, row])

  return (
    <View style={[styles.rowCard, added ? styles.rowCardAdded : styles.rowCardRemoved]}>
      <View style={styles.rowCardHeader}>
        <Text style={styles.rowCardTitle} numberOfLines={1}>
          {singular} {num}{blockLabel ? ` · ${blockLabel}` : ''}
        </Text>
        <View style={[styles.rowBadge, added ? styles.rowBadgeAdded : styles.rowBadgeRemoved]}>
          <Text style={[styles.rowBadgeText, added ? styles.rowBadgeTextAdded : styles.rowBadgeTextRemoved]}>
            {added ? 'Added' : 'Removed'}
          </Text>
        </View>
      </View>
      {lines.map((line, i) => (
        <View key={`${line.label}-${i}`} style={styles.rowFieldLine}>
          <Text style={styles.rowFieldLabel} numberOfLines={1}>{line.label}</Text>
          <Text
            style={[styles.rowFieldValue, !added && styles.rowFieldValueRemoved]}
            numberOfLines={3}
          >
            {compactValue(line.field, line.value)}
          </Text>
        </View>
      ))}
    </View>
  )
}

/** Changed row card: recurses into changed sub-fields only. */
export const ChangedRowCard: React.FC<{
  pair: RowPair
  subFields: ClientField[]
  singular: string
  blockLabel?: string
}> = ({ pair, subFields, singular, blockLabel }) => {
  const { styles } = useDiffTheme()

  const entries = useMemo(
    () => collectDiffs(subFields, pair.from ?? {}, pair.to ?? {}).filter((e) => e.changed && e.field.name !== 'id'),
    [subFields, pair.from, pair.to],
  )

  return (
    <View style={[styles.rowCard, styles.rowCardChanged]}>
      <View style={styles.rowCardHeader}>
        <Text style={styles.rowCardTitle} numberOfLines={1}>
          {singular} {pair.num}{blockLabel ? ` · ${blockLabel}` : ''}
        </Text>
        <View style={[styles.rowBadge, styles.rowBadgeChanged]}>
          <Text style={[styles.rowBadgeText, styles.rowBadgeTextChanged]}>Changed</Text>
        </View>
      </View>
      {entries.length === 0 ? (
        <Text style={styles.rowsUnchangedNote}>(no visible field changes)</Text>
      ) : (
        entries.map((entry) => (
          <View key={entry.path} style={styles.nestedField}>
            <Text style={styles.nestedFieldLabel}>{entry.label}</Text>
            <DiffBody field={entry.field} valueFrom={entry.valueFrom} valueTo={entry.valueTo} />
          </View>
        ))
      )}
    </View>
  )
}

export const RowsDiff: React.FC<{
  field: ClientField
  valueFrom: unknown
  valueTo: unknown
}> = ({ field, valueFrom, valueTo }) => {
  const { styles } = useDiffTheme()
  const isBlocks = field.type === 'blocks'

  const pairs = useMemo(() => {
    const fromRows = Array.isArray(valueFrom) ? (valueFrom as unknown[]).filter(isRecord) : []
    const toRows = Array.isArray(valueTo) ? (valueTo as unknown[]).filter(isRecord) : []
    return pairRows(fromRows, toRows)
  }, [valueFrom, valueTo])

  const blockDefs = isBlocks ? ((field as ClientBlocksField).blocks ?? []) : []
  const arraySubFields = !isBlocks ? (((field as ClientArrayField).fields ?? []) as ClientField[]) : []
  const singular = isBlocks
    ? 'Block'
    : ((field as ClientArrayField).labels?.singular ?? 'Row')

  const subFieldsFor = (row?: RowRecord): ClientField[] => {
    if (!isBlocks) return arraySubFields
    const slug = row && typeof row.blockType === 'string' ? row.blockType : undefined
    return (blockDefs.find((b) => b.slug === slug)?.fields ?? []) as ClientField[]
  }

  const blockLabelFor = (row?: RowRecord): string | undefined => {
    if (!isBlocks || !row) return undefined
    const slug = typeof row.blockType === 'string' ? row.blockType : ''
    const def = blockDefs.find((b) => b.slug === slug)
    return def?.labels?.singular ?? (slug || undefined)
  }

  if (pairs.length === 0) {
    return <Text style={styles.emptyDash}>—</Text>
  }

  const visible = pairs.filter((p) => p.status !== 'same')
  const sameCount = pairs.length - visible.length

  return (
    <View style={styles.rowsContainer}>
      {visible.map((pair) => {
        // Block type swapped — render as a remove + add
        if (
          pair.status === 'changed' &&
          isBlocks &&
          pair.from?.blockType !== pair.to?.blockType
        ) {
          return (
            <React.Fragment key={pair.key}>
              <RowCard
                status="removed"
                row={pair.from as RowRecord}
                num={pair.num}
                subFields={subFieldsFor(pair.from)}
                singular={singular}
                blockLabel={blockLabelFor(pair.from)}
              />
              <RowCard
                status="added"
                row={pair.to as RowRecord}
                num={pair.num}
                subFields={subFieldsFor(pair.to)}
                singular={singular}
                blockLabel={blockLabelFor(pair.to)}
              />
            </React.Fragment>
          )
        }
        if (pair.status === 'changed') {
          return (
            <ChangedRowCard
              key={pair.key}
              pair={pair}
              subFields={subFieldsFor(pair.to)}
              singular={singular}
              blockLabel={blockLabelFor(pair.to)}
            />
          )
        }
        const row = (pair.status === 'added' ? pair.to : pair.from) as RowRecord
        return (
          <RowCard
            key={pair.key}
            // 'same' pairs are filtered out above; only added/removed remain
            status={pair.status as 'added' | 'removed'}
            row={row}
            num={pair.num}
            subFields={subFieldsFor(row)}
            singular={singular}
            blockLabel={blockLabelFor(row)}
          />
        )
      })}
      {sameCount > 0 && (
        <Text style={styles.rowsUnchangedNote}>
          {sameCount} unchanged row{sameCount === 1 ? '' : 's'}
        </Text>
      )}
    </View>
  )
}
