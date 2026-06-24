import React from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'

import { CollectionIcon } from '../../../../CollectionIcon'
import { LucideIcon, type PickerPalette, docDisplayTitle, glass, sharedStyles } from '../../shared'
import { styles } from '../styles'
import type { RelDoc } from '../types'

/**
 * Picker sheet body — collection switcher (polymorphic), liquid-glass search
 * header, results list with "Create new" header injection + "Load more"
 * pagination, and the done/clear footer. Pure presentation: all query and
 * selection state stays in RelationshipField (purely structural extraction).
 */
export const PickerSheet: React.FC<{
  palette: PickerPalette
  activeCollection: string
  collections: string[]
  isPoly: boolean
  hasMany: boolean
  allowCreate: boolean
  loading: boolean
  loadingMore: boolean
  serverLoaded: boolean
  hasNextPage: boolean
  search: string
  setSearch: (v: string) => void
  displayDocs: RelDoc[]
  selectedItems: { length: number }
  maxReached: boolean | undefined
  collectionLabel: (slug: string, plural?: boolean) => string
  collectionMeta: (slug: string) => { icon?: string } | undefined
  titleFieldFor: (slug: string) => string | undefined
  isSelected: (relationTo: string, id: string) => boolean
  canPreviewFor: (slug: string) => boolean
  onSwitchCollection: (slug: string) => void
  onSelectDoc: (doc: RelDoc, relationTo: string) => void
  onPreview: (doc: RelDoc, relationTo: string) => void
  onRequestCreate: () => void
  onLoadMore: () => void
  onDone: () => void
  onClear: () => void
}> = ({
  palette, activeCollection, collections, isPoly, hasMany, allowCreate,
  loading, loadingMore, serverLoaded, hasNextPage, search, setSearch,
  displayDocs, selectedItems, maxReached, collectionLabel, collectionMeta,
  titleFieldFor, isSelected, canPreviewFor, onSwitchCollection, onSelectDoc,
  onPreview, onRequestCreate, onLoadMore, onDone, onClear,
}) => {
  const renderSearchHeader = () => {
    const input = (
      <View style={[styles.searchRow, !glass.available && { backgroundColor: palette.surfaceAlt }]}>
        <LucideIcon name="Search" size={16} color={palette.placeholder} />
        <TextInput
          style={[styles.searchInput, { color: palette.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${collectionLabel(activeCollection, true)}...`}
          placeholderTextColor={palette.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" />}
      </View>
    )
    // Liquid glass search header (iOS 26+); plain pill elsewhere.
    if (glass.available && glass.GlassView) {
      const GlassView = glass.GlassView
      return (
        <GlassView style={styles.searchGlass} glassEffectStyle="regular">
          {input}
        </GlassView>
      )
    }
    return <View style={styles.searchGlass}>{input}</View>
  }

  const renderCollectionSwitcher = () => {
    if (!isPoly) return null
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll} contentContainerStyle={styles.switcherRow}>
        {collections.map((slug) => {
          const active = slug === activeCollection
          return (
            <Pressable
              key={slug}
              style={[
                styles.switcherChip,
                { borderColor: palette.border },
                active && { backgroundColor: palette.primary, borderColor: palette.primary },
              ]}
              onPress={() => onSwitchCollection(slug)}
            >
              <CollectionIcon icon={collectionMeta(slug)?.icon} size={14} color={active ? palette.primaryText : palette.textMuted} />
              <Text style={[styles.switcherText, { color: active ? palette.primaryText : palette.text }]}>
                {collectionLabel(slug, true)}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    )
  }

  const renderDocRow = ({ item }: { item: RelDoc }) => {
    const id = String(item.id ?? '')
    const title = docDisplayTitle(item, titleFieldFor(activeCollection))
    const selected = isSelected(activeCollection, id)
    const rowDisabled = !selected && maxReached
    return (
      <Pressable
        style={[sharedStyles.optionRow, { borderBottomColor: palette.separator }, rowDisabled && styles.rowDisabled]}
        onPress={() => !rowDisabled && onSelectDoc(item, activeCollection)}
        onLongPress={canPreviewFor(activeCollection) ? () => onPreview(item, activeCollection) : undefined}
        delayLongPress={350}
      >
        <CollectionIcon icon={collectionMeta(activeCollection)?.icon} size={18} color={palette.textMuted} />
        <Text style={[sharedStyles.optionText, { color: palette.text }, selected && styles.optionTextSelected]} numberOfLines={1}>
          {title}
        </Text>
        {selected && <LucideIcon name="Check" size={18} color={palette.primary} />}
      </Pressable>
    )
  }

  return (
    <>
      <Text style={[sharedStyles.sheetTitle, { color: palette.text }]}>
        {`Select ${collectionLabel(activeCollection, true)}`}
        {hasMany && selectedItems.length > 0 ? `  ·  ${selectedItems.length} selected` : ''}
      </Text>
      {renderCollectionSwitcher()}
      {renderSearchHeader()}
      <FlatList
        data={displayDocs}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        renderItem={renderDocRow}
        ListHeaderComponent={allowCreate ? (
          <Pressable
            style={[sharedStyles.optionRow, { borderBottomColor: palette.separator }]}
            onPress={onRequestCreate}
          >
            <LucideIcon name="Plus" size={18} color={palette.primary} />
            <Text style={[sharedStyles.optionText, { color: palette.primary, fontWeight: '600' }]}>
              {`Create new ${collectionLabel(activeCollection)}`}
            </Text>
          </Pressable>
        ) : null}
        ListFooterComponent={serverLoaded && hasNextPage ? (
          <Pressable style={styles.loadMoreRow} onPress={() => !loadingMore && onLoadMore()}>
            {loadingMore
              ? <ActivityIndicator size="small" />
              : <Text style={[styles.loadMoreText, { color: palette.primary }]}>Load more</Text>}
          </Pressable>
        ) : null}
        ListEmptyComponent={!loading ? (
          <Text style={[sharedStyles.emptyText, { color: palette.textMuted }]}>No results</Text>
        ) : null}
      />
      {hasMany ? (
        <Pressable style={[styles.doneBtn, { backgroundColor: palette.primary }]} onPress={onDone}>
          <Text style={[styles.doneText, { color: palette.primaryText }]}>Done</Text>
        </Pressable>
      ) : selectedItems.length > 0 ? (
        <Pressable style={styles.clearBtn} onPress={onClear}>
          <Text style={[styles.clearText, { color: palette.destructive }]}>Clear selection</Text>
        </Pressable>
      ) : null}
    </>
  )
}
