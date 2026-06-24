import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Check } from 'lucide-react-native'

import type { VersionDoc } from '../../utils/api'
import type { ListColorPalette } from '../../hooks/useListColors'
import type { createStyles } from '../styles'
import { formatDate, relativeTime } from '../utils'

type VersionRowStyles = ReturnType<typeof createStyles>

// ---------------------------------------------------------------------------
// Render version list item
// ---------------------------------------------------------------------------

export const VersionRow: React.FC<{
  item: VersionDoc
  isSelected: boolean
  onToggle: (versionId: string) => void
  styles: VersionRowStyles
  colors: ListColorPalette
}> = ({ item, isSelected, onToggle, styles, colors }) => {
  const versionData = item.version as Record<string, unknown> | undefined
  const status = versionData?._status as string | undefined
  // Autosave flag lives on the version doc itself (REST) — tolerate it
  // nested in the version data too (older Payload shapes).
  const isAutosave = item.autosave === true || versionData?.autosave === true

  return (
    <Pressable
      style={[styles.versionRow, isSelected && styles.versionRowSelected]}
      onPress={() => onToggle(item.id)}
    >
      <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
        {isSelected && <Check size={14} color={colors.primaryText} />}
      </View>
      <View style={styles.versionInfo}>
        <View style={styles.versionDateRow}>
          <Text style={styles.versionDate}>{formatDate(item.updatedAt)}</Text>
          <Text style={styles.versionRelative}>{relativeTime(item.updatedAt)}</Text>
        </View>
        <View style={styles.versionMeta}>
          {status && (
            <View style={[styles.versionStatusPill, status === 'draft' ? styles.statusDraftPill : styles.statusPublishedPill]}>
              <Text style={[styles.versionStatusText, status === 'draft' ? styles.statusDraftColor : styles.statusPublishedColor]}>
                {status === 'draft' ? 'Draft' : 'Published'}
              </Text>
            </View>
          )}
          {isAutosave && (
            <View style={[styles.versionStatusPill, styles.autosavePill]}>
              <Text style={[styles.versionStatusText, styles.autosaveColor]}>Autosave</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  )
}
