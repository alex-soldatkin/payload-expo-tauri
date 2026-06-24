import React from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'

import { defaultTheme as t } from '../../../../theme'
import { LucideIcon, type PickerPalette, docDisplayTitle, glass, sharedStyles } from '../../shared'
import { styles } from '../styles'
import type { MediaDoc } from '../types'
import { isImageDoc, thumbnailURLFor } from '../utils'

/**
 * "Browse existing" sheet mode — search header + 3-column grid of media docs.
 * Pure presentation: all query/selection state is owned by UploadField and
 * threaded in as props (purely structural extraction).
 */
export const BrowseSheet: React.FC<{
  relationTo: string
  baseURL: string
  palette: PickerPalette
  tileSize: number
  search: string
  setSearch: (v: string) => void
  browseLoading: boolean
  browseLoaded: boolean
  browseHasNext: boolean
  browseLoadingMore: boolean
  browseDisplayDocs: MediaDoc[]
  titleField: string
  items: Array<{ id: string; doc: MediaDoc | null }>
  onBack: () => void
  onSelect: (doc: MediaDoc) => void
  onLoadMore: () => void
}> = ({
  relationTo, baseURL, palette, tileSize, search, setSearch,
  browseLoading, browseLoaded, browseHasNext, browseLoadingMore,
  browseDisplayDocs, titleField, items, onBack, onSelect, onLoadMore,
}) => {
  const searchBox = (
    <View style={[styles.searchRow, !glass.available && { backgroundColor: palette.surfaceAlt }]}>
      <LucideIcon name="Search" size={16} color={palette.placeholder} />
      <TextInput
        style={[styles.searchInput, { color: palette.text }]}
        value={search}
        onChangeText={setSearch}
        placeholder={`Search ${relationTo}...`}
        placeholderTextColor={palette.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {browseLoading && <ActivityIndicator size="small" />}
    </View>
  )
  const GlassView = glass.GlassView
  return (
    <>
      <View style={styles.browseHeader}>
        <Pressable onPress={onBack} hitSlop={8}>
          <LucideIcon name="ChevronLeft" size={22} color={palette.textMuted} />
        </Pressable>
        <Text style={[sharedStyles.sheetTitle, { color: palette.text, marginBottom: 0, flex: 1 }]}>
          {`Browse ${relationTo}`}
        </Text>
      </View>
      {glass.available && GlassView
        ? <GlassView style={styles.searchGlass} glassEffectStyle="regular">{searchBox}</GlassView>
        : <View style={styles.searchGlass}>{searchBox}</View>}
      <FlatList
        data={browseDisplayDocs}
        keyExtractor={(item) => String(item.id)}
        numColumns={3}
        keyboardShouldPersistTaps="handled"
        columnWrapperStyle={{ gap: t.spacing.sm }}
        contentContainerStyle={{ gap: t.spacing.sm, paddingBottom: t.spacing.lg }}
        renderItem={({ item }) => {
          const uri = isImageDoc(item) ? thumbnailURLFor(baseURL, item) : null
          const selected = items.some((it) => it.id === String(item.id))
          return (
            <Pressable style={{ width: tileSize }} onPress={() => onSelect(item)}>
              {uri ? (
                <Image source={{ uri }} style={[styles.browseThumb, { width: tileSize, height: tileSize }]} />
              ) : (
                <View style={[styles.browseThumb, styles.fileIconBox, { width: tileSize, height: tileSize, backgroundColor: palette.surfaceAlt }]}>
                  <LucideIcon name="FileText" size={tileSize * 0.34} color={palette.placeholder} />
                </View>
              )}
              {selected && (
                <View style={styles.browseCheck}>
                  <LucideIcon name="CircleCheck" size={20} color="#fff" />
                </View>
              )}
              <Text style={[styles.browseCaption, { color: palette.textMuted }]} numberOfLines={1}>
                {docDisplayTitle(item, titleField)}
              </Text>
            </Pressable>
          )
        }}
        ListFooterComponent={browseLoaded && browseHasNext ? (
          <Pressable style={styles.loadMoreRow} onPress={() => !browseLoadingMore && onLoadMore()}>
            {browseLoadingMore
              ? <ActivityIndicator size="small" />
              : <Text style={[styles.loadMoreText, { color: palette.primary }]}>Load more</Text>}
          </Pressable>
        ) : null}
        ListEmptyComponent={!browseLoading ? (
          <Text style={[sharedStyles.emptyText, { color: palette.textMuted }]}>No results</Text>
        ) : null}
      />
    </>
  )
}
