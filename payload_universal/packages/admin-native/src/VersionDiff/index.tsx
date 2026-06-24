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
import React, { useMemo, useState } from 'react'
import { Platform, Switch, Text, View } from 'react-native'

import { useListColors } from '../hooks/useListColors'
import { FieldDiffRow, UnchangedRow } from './components/FieldRows'
import { createStyles } from './styles'
import { DiffThemeContext } from './theme'
import type { DiffTheme, Props } from './types'
import { collectDiffs } from './utils'

// Re-export every symbol the diff tree is composed of, so deep imports and
// future consumers resolve through the folder index.
export type { DiffEntry, DiffStyles, DiffTheme, Props, RowPair, RowRecord } from './types'
export { DiffThemeContext, useDiffTheme } from './theme'
export { createStyles } from './styles'
export {
  TEXTISH_TYPES,
  MONO_TYPES,
  isRecord,
  isEmptyValue,
  textishValue,
  isPrimitiveArray,
  formatScalar,
  compactValue,
  formatExpandedValue,
  isLocaleMap,
  collectDiffs,
  pairRows,
} from './utils'
export { InlineDiffText } from './components/InlineDiffText'
export { OldNewBoxes } from './components/OldNewBoxes'
export { RowCard, ChangedRowCard, RowsDiff } from './components/RowsDiff'
export { DiffBody } from './components/DiffBody'
export { FieldDiffRow, UnchangedRow } from './components/FieldRows'

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
