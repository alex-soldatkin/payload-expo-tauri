/**
 * Empty states — native ContentUnavailableView (iOS 17+) with a JS fallback.
 */
import React from 'react'
import { Pressable, Text, View } from 'react-native'

import type { ListColorPalette } from '../../hooks/useListColors'
import { NativeHost } from '../../fields/NativeHost'
import { nativeComponents } from '../../fields/shared'
import { FilterXIcon, InboxIcon, SearchXIcon } from '../icons'
import type { createStyles } from '../styles'
import { EMPTY_STATE_CONTENT } from '../types'
import type { EmptyVariant } from '../types'

export function EmptyState({
  variant,
  searchText,
  onClearFilters,
  colors,
  styles,
}: {
  variant: EmptyVariant
  searchText?: string
  onClearFilters?: () => void
  colors: ListColorPalette
  styles: ReturnType<typeof createStyles>
}) {
  const { title, systemImage } = EMPTY_STATE_CONTENT[variant]
  const description =
    variant === 'search'
      ? `No matches for “${searchText}”.`
      : variant === 'filtered'
        ? 'Try adjusting or clearing your filters.'
        : 'Documents you create will appear here.'

  const ContentUnavailable = nativeComponents.ContentUnavailableView
  const FallbackIcon =
    variant === 'search' ? SearchXIcon : variant === 'filtered' ? FilterXIcon : InboxIcon

  return (
    <View style={styles.emptyContainer}>
      {ContentUnavailable ? (
        // Fixed-height box so the stretched Host has an explicit frame
        <View style={styles.emptyNativeBox}>
          <NativeHost matchContents={false} style={{ flex: 1 }}>
            <ContentUnavailable
              title={title}
              systemImage={systemImage}
              description={description}
            />
          </NativeHost>
        </View>
      ) : (
        <View style={styles.emptyCenter}>
          {FallbackIcon ? <FallbackIcon size={40} color={colors.textMuted} /> : null}
          <Text style={styles.emptyTitle}>{title}</Text>
          <Text style={styles.emptyText}>{description}</Text>
        </View>
      )}
      {onClearFilters && (
        <Pressable style={styles.clearFiltersBtn} onPress={onClearFilters}>
          <Text style={styles.clearFiltersText}>Clear filters</Text>
        </Pressable>
      )}
    </View>
  )
}
