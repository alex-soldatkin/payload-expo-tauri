import React from 'react'
import { Pressable, Text, View } from 'react-native'

import { CollectionIcon } from '../../../CollectionIcon'
import { GlassView, liquidGlassAvailable } from '../deps'
import { styles } from '../styles'
import type { FlatRow, MentionResult } from '../types'

type ListColors = {
  text: string
  textMuted: string
  pressed: string
  separator: string
}

/**
 * Renders a single FlatList row — either a collection section header or a
 * selectable mention result (liquid-glass card on iOS 26+, plain row else).
 */
export const MentionRow: React.FC<{
  row: FlatRow
  c: ListColors
  onSelect: (item: MentionResult) => void
}> = ({ row, c, onSelect }) => {
  if (row.type === 'header') {
    return (
      <View style={styles.sectionHeader}>
        <CollectionIcon icon={row.section.icon} size={16} color={c.textMuted} />
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>{row.section.label}</Text>
      </View>
    )
  }

  const { item } = row

  const content = (
    <>
      <Text style={[styles.itemTitle, { color: c.text }]} numberOfLines={1}>{item.title}</Text>
      <View style={[styles.badge, { backgroundColor: c.pressed }]}>
        <Text style={[styles.badgeText, { color: c.textMuted }]}>{item.collectionLabel}</Text>
      </View>
    </>
  )

  if (liquidGlassAvailable && GlassView) {
    return (
      <Pressable onPress={() => onSelect(item)}>
        <GlassView style={styles.glassItemRow} glassEffectStyle="regular" isInteractive>
          {content}
        </GlassView>
      </Pressable>
    )
  }

  return (
    <Pressable style={[styles.itemRow, { borderBottomColor: c.separator }]} onPress={() => onSelect(item)}>
      {content}
    </Pressable>
  )
}
