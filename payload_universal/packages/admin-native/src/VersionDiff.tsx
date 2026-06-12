/**
 * VersionDiff — renders a field-by-field comparison between two document
 * versions, approaching the web admin's per-field diff readability:
 *
 *   - Text-ish fields (text/textarea/email/code/json) render a word-level
 *     inline diff: deletions red + strikethrough on a subtle red tint,
 *     additions green on a subtle green tint (web HTMLDiff parity).
 *   - richText (Lexical JSON) is diffed on its extracted plain text; a
 *     "(formatting-only change)" note shows when only formatting changed.
 *   - Arrays/blocks diff per-row: added rows get a green "Added" badge,
 *     removed rows a red "Removed" badge, changed rows recurse into their
 *     changed sub-fields only. Rows are matched by `id` when present
 *     (falling back to index); blocks also show their block type.
 *   - Relationship/upload values resolve to readable labels
 *     (title/filename/id) instead of object dumps.
 *   - Localized values ({ en: …, de: … }) render per-locale sub-rows.
 *   - "Changed fields only" toggle (default on); unchanged fields collapse
 *     into a tappable "Unchanged" row when the toggle is off.
 *
 * Structural fields (groups, tabs, rows, collapsibles) are traversed
 * recursively; nested labels are prefixed ("Meta › Title").
 *
 * Dark mode aware via useListColors. All surfaces are translucent tints so
 * they sit correctly on the BottomSheet's liquid-glass background (glass is
 * applied once at the sheet level — never double-applied here).
 */
import React, { useContext, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { ChevronDown, ChevronRight } from 'lucide-react-native'

import type { ClientArrayField, ClientBlocksField, ClientField } from './types'
import { getFieldLabel } from './utils/schemaHelpers'
import {
  deepEqual,
  diffWords,
  extractLexicalText,
  getRelationLabel,
  prettyJson,
  type DiffSegment,
} from './utils/diff'
import { defaultTheme as t } from './theme'
import { useListColors, type ListColorPalette } from './hooks/useListColors'

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
// Shared theme context (one StyleSheet for the whole diff tree)
// ---------------------------------------------------------------------------

type DiffStyles = ReturnType<typeof createStyles>
type DiffTheme = { styles: DiffStyles; colors: ListColorPalette; dark: boolean }

const DiffThemeContext = React.createContext<DiffTheme | null>(null)

const useDiffTheme = (): DiffTheme => {
  const ctx = useContext(DiffThemeContext)
  if (!ctx) throw new Error('VersionDiff sub-components must render inside VersionDiff')
  return ctx
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

const TEXTISH_TYPES = new Set(['text', 'textarea', 'email', 'code', 'json'])
const MONO_TYPES = new Set(['code', 'json'])

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)

const isEmptyValue = (v: unknown): boolean => {
  if (v == null) return true
  if (typeof v === 'string') return v.length === 0
  if (Array.isArray(v)) return v.length === 0
  return false
}

const truncate = (s: string, max: number): string =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s

const safeStringify = (value: unknown, space?: number): string => {
  try {
    return JSON.stringify(value, null, space) ?? ''
  } catch {
    return String(value)
  }
}

const resolveLabelString = (
  label: string | Record<string, string> | undefined,
  fallback: string,
): string => {
  if (!label) return fallback
  if (typeof label === 'string') return label
  return label.en || Object.values(label)[0] || fallback
}

/** Stringify a text-ish field value for word-diffing. */
const textishValue = (field: ClientField, value: unknown): string => {
  if (value == null) return ''
  if (field.type === 'json') return prettyJson(value)
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ')
  return String(value)
}

const isPrimitiveArray = (v: unknown): v is Array<string | number | boolean | null> =>
  Array.isArray(v) && v.every((x) => x == null || typeof x !== 'object')

/** Format a scalar (or fallback complex) value for the old/new boxes. */
const formatScalar = (value: unknown, fieldType?: string): string => {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    if (fieldType === 'date') {
      const time = Date.parse(value)
      if (!Number.isNaN(time)) return new Date(time).toLocaleString()
    }
    return value
  }
  // hasMany select/radio etc. — join rather than dump JSON
  if (isPrimitiveArray(value)) {
    return value.length > 0 ? value.map((v) => String(v ?? '—')).join(', ') : '—'
  }
  return safeStringify(value, 2)
}

/** One-line summary used inside added/removed row cards. */
const compactValue = (field: ClientField, value: unknown): string => {
  if (value == null) return '—'
  switch (field.type) {
    case 'richText': {
      const text = extractLexicalText(value)
      return text.length > 0 ? truncate(text.replace(/\n+/g, ' · '), 160) : '—'
    }
    case 'relationship':
    case 'upload':
      return getRelationLabel(value) || '—'
    case 'array':
      return Array.isArray(value) ? `${value.length} row${value.length === 1 ? '' : 's'}` : '—'
    case 'blocks':
      return Array.isArray(value) ? `${value.length} block${value.length === 1 ? '' : 's'}` : '—'
    case 'json':
      return truncate(safeStringify(value), 160)
    case 'date':
      return formatScalar(value, 'date')
    default:
      break
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) {
    return value
      .map((v) => (isRecord(v) ? getRelationLabel(v) || safeStringify(v) : String(v)))
      .join(', ')
  }
  if (typeof value === 'object') return truncate(safeStringify(value), 160)
  return String(value)
}

/** Full value rendering for the expanded "Unchanged" row. */
const formatExpandedValue = (field: ClientField, value: unknown): string => {
  if (value == null) return '—'
  switch (field.type) {
    case 'richText':
      return extractLexicalText(value) || '—'
    case 'relationship':
    case 'upload':
      return getRelationLabel(value) || '—'
    case 'json':
      return prettyJson(value) || '—'
    case 'array':
    case 'blocks':
      return compactValue(field, value)
    default:
      return formatScalar(value, field.type)
  }
}

/**
 * Detect a per-locale value map ({ en: …, de: … }) on a localized field.
 * Naturally-object value shapes (richText root, populated relationships,
 * groups, json, point) are excluded so they aren't misread as locale maps.
 */
const isLocaleMap = (field: ClientField, value: unknown): boolean => {
  if (!field.localized || !isRecord(value)) return false
  switch (field.type) {
    case 'richText':
      return !('root' in value)
    case 'relationship':
    case 'upload':
      return !('id' in value) && !('relationTo' in value) && !('value' in value)
    case 'group':
    case 'json':
    case 'point':
      return false
    default:
      return true
  }
}

// ---------------------------------------------------------------------------
// Field tree walker
// ---------------------------------------------------------------------------

type DiffEntry = {
  path: string
  label: string
  field: ClientField
  valueFrom: unknown
  valueTo: unknown
  changed: boolean
}

const collectDiffs = (
  fields: ClientField[],
  from: Record<string, unknown>,
  to: Record<string, unknown>,
  pathPrefix = '',
  labelPrefix = '',
): DiffEntry[] => {
  const entries: DiffEntry[] = []

  for (const field of fields) {
    const name = field.name
    const type = field.type

    // Virtual / presentational fields carry no version data
    if (type === 'ui' || type === 'join') continue

    const subFields = (field as { fields?: ClientField[] }).fields

    // Structural fields without their own name — traverse sub-fields
    if (!name && (type === 'row' || type === 'collapsible') && subFields) {
      entries.push(...collectDiffs(subFields, from, to, pathPrefix, labelPrefix))
      continue
    }
    if (!name && type === 'tabs' && (field as { tabs?: unknown[] }).tabs) {
      const tabs = (field as { tabs?: Array<{ name?: string; label?: string | Record<string, string>; fields?: ClientField[] }> }).tabs ?? []
      for (const tab of tabs) {
        if (!tab.fields) continue
        if (tab.name) {
          // Named tab — data is nested under tab.name
          const tabFrom = isRecord(from[tab.name]) ? (from[tab.name] as Record<string, unknown>) : {}
          const tabTo = isRecord(to[tab.name]) ? (to[tab.name] as Record<string, unknown>) : {}
          const tabLabel = resolveLabelString(tab.label, tab.name)
          entries.push(...collectDiffs(
            tab.fields,
            tabFrom,
            tabTo,
            pathPrefix ? `${pathPrefix}.${tab.name}` : tab.name,
            `${labelPrefix}${tabLabel} › `,
          ))
        } else {
          // Unnamed tab — data lives at the parent level
          entries.push(...collectDiffs(tab.fields, from, to, pathPrefix, labelPrefix))
        }
      }
      continue
    }

    if (!name) continue

    const path = pathPrefix ? `${pathPrefix}.${name}` : name
    const valueFrom = from[name]
    const valueTo = to[name]
    const label = getFieldLabel(field, name)

    // Group fields — recurse with a label prefix ("Meta › Title")
    if (type === 'group' && subFields) {
      const groupFrom = isRecord(valueFrom) ? valueFrom : {}
      const groupTo = isRecord(valueTo) ? valueTo : {}
      entries.push(...collectDiffs(subFields, groupFrom, groupTo, path, `${labelPrefix}${label} › `))
      continue
    }

    entries.push({
      path,
      label: `${labelPrefix}${label}`,
      field,
      valueFrom,
      valueTo,
      changed: !deepEqual(valueFrom, valueTo),
    })
  }

  return entries
}

// ---------------------------------------------------------------------------
// Inline word-level diff text
// ---------------------------------------------------------------------------

const InlineDiffText: React.FC<{ segments: DiffSegment[]; mono?: boolean }> = ({ segments, mono }) => {
  const { styles } = useDiffTheme()
  if (segments.length === 0) {
    return (
      <View style={styles.inlineDiffBox}>
        <Text style={styles.emptyDash}>—</Text>
      </View>
    )
  }
  return (
    <View style={styles.inlineDiffBox}>
      <Text style={[styles.diffValueText, mono && styles.diffValueMono]}>
        {segments.map((seg, i) => (
          <Text
            key={i}
            style={seg.type === 'add' ? styles.addText : seg.type === 'del' ? styles.delText : undefined}
          >
            {seg.text}
          </Text>
        ))}
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Old / new value boxes (scalars, relationships, fallback)
// ---------------------------------------------------------------------------

const OldNewBoxes: React.FC<{
  fromStr: string
  toStr: string
  mono?: boolean
  vertical?: boolean
}> = ({ fromStr, toStr, mono, vertical }) => {
  const { styles } = useDiffTheme()
  return (
    <View style={vertical ? styles.diffValuesVertical : styles.diffValues}>
      <View style={[styles.diffOldBox, vertical && styles.diffBoxFullWidth]}>
        <Text style={[styles.diffValueText, styles.delPlainText, mono && styles.diffValueMono]}>
          {fromStr}
        </Text>
      </View>
      <View style={[styles.diffNewBox, vertical && styles.diffBoxFullWidth]}>
        <Text style={[styles.diffValueText, mono && styles.diffValueMono]}>
          {toStr}
        </Text>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Array / blocks per-row diff
// ---------------------------------------------------------------------------

type RowRecord = Record<string, unknown>

type RowPair = {
  key: string
  status: 'added' | 'removed' | 'changed' | 'same'
  from?: RowRecord
  to?: RowRecord
  /** 1-based row number (to-side position, or from-side for removed rows). */
  num: number
}

const rowId = (row: RowRecord): string | null => {
  const id = row.id
  if (typeof id === 'string' && id.length > 0) return id
  if (typeof id === 'number') return String(id)
  return null
}

/** Pair up rows by `id` when every row has one, else by index. */
const pairRows = (fromRows: RowRecord[], toRows: RowRecord[]): RowPair[] => {
  const pairs: RowPair[] = []
  const useIds =
    fromRows.length > 0 &&
    toRows.length > 0 &&
    fromRows.every((r) => rowId(r) !== null) &&
    toRows.every((r) => rowId(r) !== null)

  if (useIds) {
    const fromById = new Map<string, RowRecord>()
    for (const row of fromRows) fromById.set(rowId(row) as string, row)
    const toIds = new Set(toRows.map((r) => rowId(r) as string))

    toRows.forEach((row, i) => {
      const id = rowId(row) as string
      const match = fromById.get(id)
      if (!match) {
        pairs.push({ key: id, status: 'added', to: row, num: i + 1 })
      } else {
        pairs.push({
          key: id,
          status: deepEqual(match, row) ? 'same' : 'changed',
          from: match,
          to: row,
          num: i + 1,
        })
      }
    })
    fromRows.forEach((row, i) => {
      const id = rowId(row) as string
      if (!toIds.has(id)) pairs.push({ key: id, status: 'removed', from: row, num: i + 1 })
    })
  } else {
    const max = Math.max(fromRows.length, toRows.length)
    for (let i = 0; i < max; i++) {
      const from = fromRows[i]
      const to = toRows[i]
      if (from && to) {
        pairs.push({
          key: String(i),
          status: deepEqual(from, to) ? 'same' : 'changed',
          from,
          to,
          num: i + 1,
        })
      } else if (to) {
        pairs.push({ key: String(i), status: 'added', to, num: i + 1 })
      } else if (from) {
        pairs.push({ key: String(i), status: 'removed', from, num: i + 1 })
      }
    }
  }
  return pairs
}

/** Added / removed row card: badge + one-sided sub-field summary. */
const RowCard: React.FC<{
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
const ChangedRowCard: React.FC<{
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

const RowsDiff: React.FC<{
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

// ---------------------------------------------------------------------------
// DiffBody — per-field-type diff visualization
// ---------------------------------------------------------------------------

const DiffBodyInner: React.FC<{
  field: ClientField
  valueFrom: unknown
  valueTo: unknown
}> = ({ field, valueFrom, valueTo }) => {
  const { styles } = useDiffTheme()
  const type = field.type

  if (type === 'array' || type === 'blocks') {
    return <RowsDiff field={field} valueFrom={valueFrom} valueTo={valueTo} />
  }

  if (type === 'richText') {
    const fromText = extractLexicalText(valueFrom)
    const toText = extractLexicalText(valueTo)
    if (fromText === toText) {
      return <Text style={styles.formattingOnlyNote}>(formatting-only change)</Text>
    }
    return <InlineDiffText segments={diffWords(fromText, toText)} />
  }

  if (TEXTISH_TYPES.has(type)) {
    return (
      <InlineDiffText
        segments={diffWords(textishValue(field, valueFrom), textishValue(field, valueTo))}
        mono={MONO_TYPES.has(type)}
      />
    )
  }

  if (type === 'relationship' || type === 'upload') {
    return (
      <OldNewBoxes
        fromStr={getRelationLabel(valueFrom) || '—'}
        toStr={getRelationLabel(valueTo) || '—'}
      />
    )
  }

  // Scalars and unknown complex values (primitive arrays render inline)
  const isComplexValue = (v: unknown): boolean =>
    v != null && typeof v === 'object' && !isPrimitiveArray(v)
  const isComplex = isComplexValue(valueFrom) || isComplexValue(valueTo)
  return (
    <OldNewBoxes
      fromStr={formatScalar(valueFrom, type)}
      toStr={formatScalar(valueTo, type)}
      mono={isComplex}
      vertical={isComplex}
    />
  )
}

/** Wraps DiffBodyInner with per-locale sub-rows for localized values. */
const DiffBody: React.FC<{
  field: ClientField
  valueFrom: unknown
  valueTo: unknown
}> = ({ field, valueFrom, valueTo }) => {
  const { styles } = useDiffTheme()

  if (isLocaleMap(field, valueFrom) || isLocaleMap(field, valueTo)) {
    const fromMap = isRecord(valueFrom) ? valueFrom : {}
    const toMap = isRecord(valueTo) ? valueTo : {}
    const locales = [...new Set([...Object.keys(fromMap), ...Object.keys(toMap)])]
    return (
      <View>
        {locales.map((locale) => {
          const lf = fromMap[locale]
          const lt = toMap[locale]
          const changed = !deepEqual(lf, lt)
          return (
            <View key={locale} style={styles.localeRow}>
              <View style={styles.localePill}>
                <Text style={styles.localePillText}>{locale}</Text>
              </View>
              <View style={styles.localeBody}>
                {changed ? (
                  <DiffBodyInner field={field} valueFrom={lf} valueTo={lt} />
                ) : (
                  <Text style={styles.rowsUnchangedNote}>Unchanged</Text>
                )}
              </View>
            </View>
          )
        })}
      </View>
    )
  }

  return <DiffBodyInner field={field} valueFrom={valueFrom} valueTo={valueTo} />
}

// ---------------------------------------------------------------------------
// Field rows
// ---------------------------------------------------------------------------

const FieldDiffRow: React.FC<{ entry: DiffEntry }> = ({ entry }) => {
  const { styles } = useDiffTheme()
  return (
    <View style={styles.diffRow}>
      <Text style={styles.diffLabel}>{entry.label}</Text>
      <DiffBody field={entry.field} valueFrom={entry.valueFrom} valueTo={entry.valueTo} />
    </View>
  )
}

/** Collapsed row for an unchanged field; tap to reveal the current value. */
const UnchangedRow: React.FC<{ entry: DiffEntry }> = ({ entry }) => {
  const { styles, colors } = useDiffTheme()
  const [expanded, setExpanded] = useState(false)
  const Chevron = expanded ? ChevronDown : ChevronRight
  const mono = MONO_TYPES.has(entry.field.type)

  return (
    <View style={styles.diffRow}>
      <Pressable
        style={styles.unchangedHeader}
        onPress={() => setExpanded((e) => !e)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={styles.unchangedLabel} numberOfLines={1}>{entry.label}</Text>
        <View style={styles.unchangedPill}>
          <Text style={styles.unchangedPillText}>Unchanged</Text>
        </View>
        <Chevron size={14} color={colors.textMuted} />
      </Pressable>
      {expanded && (
        <View style={styles.neutralBox}>
          <Text style={[styles.diffValueText, mono && styles.diffValueMono]}>
            {formatExpandedValue(entry.field, entry.valueTo)}
          </Text>
        </View>
      )}
    </View>
  )
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
  const { dark, colors } = useListColors()
  const styles = useMemo(() => createStyles(colors, dark), [colors, dark])
  const theme = useMemo<DiffTheme>(() => ({ styles, colors, dark }), [styles, colors, dark])
  const [modifiedOnly, setModifiedOnly] = useState(initialModifiedOnly)

  const allEntries = useMemo(
    () => collectDiffs(fields, versionFrom, versionTo),
    [fields, versionFrom, versionTo],
  )

  const visibleEntries = useMemo(
    () => (modifiedOnly ? allEntries.filter((e) => e.changed) : allEntries),
    [allEntries, modifiedOnly],
  )

  return (
    <DiffThemeContext.Provider value={theme}>
      <View style={styles.container}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Changed fields only</Text>
          <Switch
            value={modifiedOnly}
            onValueChange={setModifiedOnly}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
          />
        </View>

        {visibleEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {modifiedOnly ? 'No fields were modified between these versions.' : 'No fields to display.'}
            </Text>
          </View>
        ) : (
          visibleEntries.map((entry) =>
            entry.changed ? (
              <FieldDiffRow key={entry.path} entry={entry} />
            ) : (
              <UnchangedRow key={entry.path} entry={entry} />
            ),
          )
        )}
      </View>
    </DiffThemeContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette, dark: boolean) => {
  // Diff tints chosen to read on both light surfaces and dark glass
  const addColor = dark ? '#86efac' : '#15803d'
  const addBg = dark ? 'rgba(74,222,128,0.22)' : 'rgba(22,163,74,0.14)'
  const delColor = dark ? '#fca5a5' : '#b91c1c'
  const delBg = dark ? 'rgba(255,107,102,0.22)' : 'rgba(220,38,38,0.12)'
  const addSurface = dark ? 'rgba(74,222,128,0.10)' : '#f0fdf4'
  const addBorder = dark ? 'rgba(74,222,128,0.45)' : '#86efac'
  const delSurface = dark ? 'rgba(255,107,102,0.10)' : '#fef2f2'
  const delBorder = dark ? 'rgba(255,107,102,0.45)' : '#fca5a5'
  const neutralSurface = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'

  return StyleSheet.create({
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
      color: c.textMuted,
      fontWeight: '500',
    },

    // Field row
    diffRow: {
      paddingVertical: t.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    diffLabel: {
      fontSize: t.fontSize.sm,
      fontWeight: '700',
      color: c.text,
      marginBottom: t.spacing.sm,
    },

    // Old / new boxes
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
      backgroundColor: delSurface,
      borderLeftWidth: 3,
      borderLeftColor: delBorder,
      padding: t.spacing.sm,
      borderRadius: 4,
    },
    diffNewBox: {
      flex: 1,
      backgroundColor: addSurface,
      borderLeftWidth: 3,
      borderLeftColor: addBorder,
      padding: t.spacing.sm,
      borderRadius: 4,
    },
    diffBoxFullWidth: {
      flex: undefined,
    },
    diffValueText: {
      fontSize: t.fontSize.sm,
      color: c.text,
    },
    diffValueMono: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: t.fontSize.xs,
    },
    delPlainText: {
      textDecorationLine: 'line-through',
      color: c.textMuted,
    },

    // Inline word diff
    inlineDiffBox: {
      backgroundColor: neutralSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: t.borderRadius.sm,
      padding: t.spacing.sm,
    },
    addText: {
      backgroundColor: addBg,
      color: addColor,
      fontWeight: '600',
    },
    delText: {
      backgroundColor: delBg,
      color: delColor,
      textDecorationLine: 'line-through',
    },
    formattingOnlyNote: {
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      fontStyle: 'italic',
    },
    emptyDash: {
      fontSize: t.fontSize.sm,
      color: c.textMuted,
    },

    // Array / blocks rows
    rowsContainer: {
      gap: t.spacing.sm,
    },
    rowCard: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: t.borderRadius.sm,
      padding: t.spacing.sm,
      backgroundColor: neutralSurface,
    },
    rowCardAdded: {
      backgroundColor: addSurface,
      borderColor: addBorder,
    },
    rowCardRemoved: {
      backgroundColor: delSurface,
      borderColor: delBorder,
    },
    rowCardChanged: {},
    rowCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.spacing.sm,
      marginBottom: t.spacing.xs,
    },
    rowCardTitle: {
      flex: 1,
      fontSize: t.fontSize.sm,
      fontWeight: '600',
      color: c.text,
    },
    rowBadge: {
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 2,
      borderRadius: 4,
    },
    rowBadgeAdded: { backgroundColor: addBg },
    rowBadgeRemoved: { backgroundColor: delBg },
    rowBadgeChanged: { backgroundColor: c.warningBackground },
    rowBadgeText: {
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    rowBadgeTextAdded: { color: addColor },
    rowBadgeTextRemoved: { color: delColor },
    rowBadgeTextChanged: { color: c.warning },
    rowFieldLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.sm,
      paddingVertical: 2,
    },
    rowFieldLabel: {
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      color: c.textMuted,
      maxWidth: '40%',
    },
    rowFieldValue: {
      flex: 1,
      fontSize: t.fontSize.xs,
      color: c.text,
    },
    rowFieldValueRemoved: {
      textDecorationLine: 'line-through',
      color: c.textMuted,
    },
    rowsUnchangedNote: {
      fontSize: t.fontSize.xs,
      color: c.textMuted,
      fontStyle: 'italic',
    },
    nestedField: {
      marginTop: t.spacing.sm,
    },
    nestedFieldLabel: {
      fontSize: t.fontSize.xs,
      fontWeight: '700',
      color: c.text,
      marginBottom: 4,
    },

    // Locale sub-rows
    localeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.sm,
      marginBottom: t.spacing.sm,
    },
    localePill: {
      backgroundColor: c.pressed,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginTop: 2,
    },
    localePillText: {
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      color: c.textMuted,
    },
    localeBody: { flex: 1 },

    // Unchanged (collapsed) field row
    unchangedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
    },
    unchangedLabel: {
      flexShrink: 1,
      fontSize: t.fontSize.sm,
      fontWeight: '600',
      color: c.textMuted,
    },
    unchangedPill: {
      marginLeft: 'auto',
      backgroundColor: c.pressed,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    unchangedPillText: {
      fontSize: t.fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      color: c.textMuted,
    },
    neutralBox: {
      marginTop: t.spacing.sm,
      backgroundColor: neutralSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: t.borderRadius.sm,
      padding: t.spacing.sm,
    },

    // Empty
    emptyState: {
      padding: t.spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: t.fontSize.sm,
      color: c.textMuted,
      textAlign: 'center',
    },
  })
}
