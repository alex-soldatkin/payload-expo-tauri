/**
 * MentionPicker — BottomSheet picker for document mentions in the rich text editor.
 *
 * Activated when the user types `@` in a rich text field. Queries all user-facing
 * collections from the local RxDB database (with REST API fallback) and displays
 * results grouped by collection. Selecting a result inserts a document mention.
 */
import React, { useCallback } from 'react'
import { ActivityIndicator, FlatList, Text, TextInput } from 'react-native'

import { BottomSheet } from '../../BottomSheet'
import { useListColors } from '../../hooks/useListColors'
import { MentionRow } from './components/MentionRow'
import { useMentionSearch } from './hooks/useMentionSearch'
import { styles } from './styles'
import type { FlatRow, MentionResult, Props } from './types'

// Re-export types for consumer convenience (preserves old in-file exports)
export type { MentionItem, MentionResult, Props, SectionData } from './types'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MentionPicker: React.FC<Props> = ({
  visible,
  searchText: externalSearchText,
  onSelect,
  onDismiss,
}) => {
  const { colors: c } = useListColors()
  const { search, setSearch, loading, flatData } = useMentionSearch(visible, externalSearchText)

  // ---- Handlers ----

  const handleSelect = useCallback((item: MentionResult) => {
    onSelect({
      collection: item.collection,
      id: item.id,
      title: item.title,
    })
  }, [onSelect])

  // ---- Render ----

  const renderRow = useCallback(
    ({ item: row }: { item: FlatRow }) => <MentionRow row={row} c={c} onSelect={handleSelect} />,
    [handleSelect, c],
  )

  const keyExtractor = useCallback(
    (row: FlatRow, _index: number) =>
      row.type === 'header' ? `header-${row.section.slug}` : `${row.item.collection}-${row.item.id}`,
    [],
  )

  return (
    <BottomSheet visible={visible} onClose={onDismiss} height={0.6}>
      <Text style={[styles.sheetTitle, { color: c.text }]}>Mention a document</Text>
      <TextInput
        style={[styles.searchInput, { borderColor: c.border, color: c.text }]}
        value={search}
        onChangeText={setSearch}
        placeholder="Search across collections..."
        placeholderTextColor={c.textPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
      {loading && <ActivityIndicator style={styles.loader} />}
      <FlatList
        data={flatData}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.emptyText, { color: c.textMuted }]}>
              {search.trim().length > 0 ? 'No matching documents' : 'Type to search...'}
            </Text>
          ) : null
        }
      />
    </BottomSheet>
  )
}
