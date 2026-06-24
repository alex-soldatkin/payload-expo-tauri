import React, { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronDown, ChevronRight } from 'lucide-react-native'

import { useDiffTheme } from '../theme'
import type { DiffEntry } from '../types'
import { MONO_TYPES, formatExpandedValue } from '../utils'
import { DiffBody } from './DiffBody'

// ---------------------------------------------------------------------------
// Field rows
// ---------------------------------------------------------------------------

export const FieldDiffRow: React.FC<{ entry: DiffEntry }> = ({ entry }) => {
  const { styles } = useDiffTheme()
  return (
    <View style={styles.diffRow}>
      <Text style={styles.diffLabel}>{entry.label}</Text>
      <DiffBody field={entry.field} valueFrom={entry.valueFrom} valueTo={entry.valueTo} />
    </View>
  )
}

/** Collapsed row for an unchanged field; tap to reveal the current value. */
export const UnchangedRow: React.FC<{ entry: DiffEntry }> = ({ entry }) => {
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
