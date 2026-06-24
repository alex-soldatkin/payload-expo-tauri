import React, { useEffect, useMemo, useState } from 'react'
import { Image as RNImage, Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { BottomSheet } from '../../../../BottomSheet'
import { resolveI18nText, type StructuralPalette } from '../../common'
import type { BlockConfig } from '../types'
import { blockGroupFor } from '../utils'
import { styles } from '../styles'

// ---------------------------------------------------------------------------
// Block picker — searchable, grouped list in the package BottomSheet
// ---------------------------------------------------------------------------

export const BlockPickerSheet: React.FC<{
  visible: boolean
  onClose: () => void
  blocks: BlockConfig[]
  onSelect: (slug: string) => void
  palette: StructuralPalette
}> = ({ visible, onClose, blocks, onSelect, palette }) => {
  const [query, setQuery] = useState('')

  // Clear the search when the sheet closes so it reopens fresh.
  useEffect(() => {
    if (!visible) setQuery('')
  }, [visible])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = blocks.filter((block) => {
      if (!q) return true
      const label = (block.labels?.singular || block.slug).toLowerCase()
      const desc = resolveI18nText(block.description, '').toLowerCase()
      return label.includes(q) || block.slug.toLowerCase().includes(q) || desc.includes(q)
    })
    const map = new Map<string, BlockConfig[]>()
    for (const block of filtered) {
      const group = blockGroupFor(block)
      const list = map.get(group) ?? []
      list.push(block)
      map.set(group, list)
    }
    return [...map.entries()]
  }, [blocks, query])

  const showGroupHeaders = groups.length > 1 || (groups.length === 1 && groups[0][0] !== '')

  return (
    <BottomSheet visible={visible} onClose={onClose} height={0.6}>
      <Text style={[styles.pickerTitle, { color: palette.text }]}>Add Block</Text>
      <View style={[styles.searchBox, { backgroundColor: palette.inputBg }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search blocks"
          placeholderTextColor={palette.textFaint}
          style={[styles.searchInput, { color: palette.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {groups.length === 0 && (
          <Text style={[styles.pickerEmpty, { color: palette.textFaint }]}>
            No blocks match “{query.trim()}”
          </Text>
        )}
        {groups.map(([group, groupBlocks]) => (
          <View key={group || '_ungrouped'}>
            {showGroupHeaders && (
              <Text style={[styles.pickerGroup, { color: palette.textMuted }]}>
                {group || 'Blocks'}
              </Text>
            )}
            {groupBlocks.map((block) => {
              const label = block.labels?.singular || block.slug
              const description = resolveI18nText(block.description, '')
              return (
                <Pressable
                  key={block.slug}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    { borderBottomColor: palette.separator },
                    pressed && { backgroundColor: palette.cardBg },
                  ]}
                  onPress={() => onSelect(block.slug)}
                >
                  {block.imageURL ? (
                    <RNImage
                      source={{ uri: block.imageURL }}
                      style={styles.pickerThumb}
                      accessibilityLabel={block.imageAltText || label}
                    />
                  ) : (
                    <View style={[styles.pickerThumb, styles.pickerThumbFallback, { backgroundColor: palette.inputBg }]}>
                      <Text style={[styles.pickerThumbLetter, { color: palette.textMuted }]}>
                        {label.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.pickerRowText}>
                    <Text style={[styles.pickerRowLabel, { color: palette.text }]}>{label}</Text>
                    {!!description && (
                      <Text style={[styles.pickerRowDesc, { color: palette.textFaint }]} numberOfLines={2}>
                        {description}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.pickerRowPlus, { color: palette.primary }]}>+</Text>
                </Pressable>
              )
            })}
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  )
}
