import React from 'react'
import { Text, View } from 'react-native'

import type { DiffSegment } from '../../utils/diff'
import { useDiffTheme } from '../theme'

// ---------------------------------------------------------------------------
// Inline word-level diff text
// ---------------------------------------------------------------------------

export const InlineDiffText: React.FC<{ segments: DiffSegment[]; mono?: boolean }> = ({ segments, mono }) => {
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
