/**
 * VersionsBottomSheet — multi-step bottom sheet for viewing, comparing, and
 * restoring document versions.
 *
 * Step 1 (list): Shows a paginated list of versions with status pills.
 *   The user selects two versions to compare.
 * Step 2 (compare): Shows a side-by-side field diff of the two selected versions
 *   with a "Restore this version" button.
 *
 * Version data is fetched directly from the Payload REST API (server-side)
 * because versions are not stored in the local-first RxDB layer.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { ArrowLeft, RotateCcw } from 'lucide-react-native'

import { BottomSheet } from '../BottomSheet'
import { VersionDiff } from '../VersionDiff'
import { payloadApi, type VersionDoc } from '../utils/api'
import { extractRootFields } from '../utils/schemaHelpers'
import { useListColors } from '../hooks/useListColors'
import type { ClientField } from '../types'
import { VersionRow } from './components/VersionRow'
import { createStyles } from './styles'
import type { Mode, Props } from './types'
import { PAGE_SIZE, formatDate } from './utils'

// Re-export the slimmed-out seams so deep imports keep resolving through index.
export type { Mode, Props } from './types'
export { PAGE_SIZE, formatDate, relativeTime } from './utils'
export { createStyles } from './styles'
export { VersionRow } from './components/VersionRow'

export const VersionsBottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  slug,
  documentId,
  apiConfig,
  schemaMap,
  onRestore,
}) => {
  // Dark-mode aware palette (the sheet background is glass/blur — text and
  // pills must follow the system scheme)
  const { colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  // State
  const [mode, setMode] = useState<Mode>('list')
  const [versions, setVersions] = useState<VersionDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Selection for comparison (version IDs)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Comparison state
  const [comparing, setComparing] = useState(false)
  const [restoring, setRestoring] = useState(false)

  // Fields for diff rendering
  const fields = useMemo<ClientField[]>(
    () => extractRootFields(schemaMap, slug),
    [schemaMap, slug],
  )

  // ---------------------------------------------------------------------------
  // Fetch versions
  // ---------------------------------------------------------------------------

  const fetchVersions = useCallback(async (pageNum: number, append = false) => {
    if (!visible) return
    append ? setLoadingMore(true) : setLoading(true)
    setError(null)

    try {
      const result = await payloadApi.findVersions(
        apiConfig,
        slug,
        documentId,
        { page: pageNum, limit: PAGE_SIZE, sort: '-updatedAt' },
      )
      const newDocs = result.docs ?? []
      setVersions((prev) => append ? [...prev, ...newDocs] : newDocs)
      setHasMore(result.hasNextPage ?? newDocs.length === PAGE_SIZE)
      setPage(pageNum)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [visible, apiConfig, slug, documentId])

  // Load on open
  useEffect(() => {
    if (visible) {
      setMode('list')
      setSelectedIds([])
      fetchVersions(1)
    }
  }, [visible, fetchVersions])

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  const toggleSelection = useCallback((versionId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((id) => id !== versionId)
      }
      // Max 2 selected
      if (prev.length >= 2) {
        return [prev[1], versionId]
      }
      return [...prev, versionId]
    })
  }, [])

  const selectedVersions = useMemo(() => {
    return selectedIds
      .map((id) => versions.find((v) => v.id === id))
      .filter(Boolean) as VersionDoc[]
  }, [selectedIds, versions])

  // Sort so the older version is "from" and newer is "to"
  const [versionFrom, versionTo] = useMemo(() => {
    if (selectedVersions.length !== 2) return [null, null]
    const sorted = [...selectedVersions].sort(
      (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
    )
    return [sorted[0], sorted[1]]
  }, [selectedVersions])

  // ---------------------------------------------------------------------------
  // Restore
  // ---------------------------------------------------------------------------

  const handleRestore = useCallback(async (versionId: string) => {
    Alert.alert(
      'Restore Version',
      'Are you sure you want to restore this version? The current document will be replaced.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setRestoring(true)
            try {
              await payloadApi.restoreVersion(apiConfig, slug, versionId)
              onRestore?.()
              onClose()
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Restore failed')
            } finally {
              setRestoring(false)
            }
          },
        },
      ],
    )
  }, [apiConfig, slug, onRestore, onClose])

  // ---------------------------------------------------------------------------
  // Enter comparison mode
  // ---------------------------------------------------------------------------

  const enterCompare = useCallback(() => {
    if (selectedVersions.length === 2) {
      setMode('compare')
    }
  }, [selectedVersions])

  // ---------------------------------------------------------------------------
  // Render version list item
  // ---------------------------------------------------------------------------

  const renderVersionItem = useCallback(({ item }: { item: VersionDoc }) => (
    <VersionRow
      item={item}
      isSelected={selectedIds.includes(item.id)}
      onToggle={toggleSelection}
      styles={styles}
      colors={colors}
    />
  ), [selectedIds, toggleSelection, styles, colors])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const sheetHeight = mode === 'compare' ? 0.9 : 0.7

  return (
    <BottomSheet visible={visible} onClose={onClose} height={sheetHeight}>
      {mode === 'list' ? (
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Versions</Text>
            {selectedIds.length === 2 && (
              <Pressable style={styles.compareBtn} onPress={enterCompare}>
                <Text style={styles.compareBtnText}>Compare</Text>
              </Pressable>
            )}
          </View>

          {selectedIds.length > 0 && selectedIds.length < 2 && (
            <Text style={styles.selectionHint}>Select one more version to compare</Text>
          )}

          {/* Version list */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={() => fetchVersions(1)}>
                <Text style={styles.retryBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={versions}
              keyExtractor={(item) => item.id}
              renderItem={renderVersionItem}
              contentContainerStyle={styles.listContent}
              onEndReached={() => {
                if (hasMore && !loadingMore) fetchVersions(page + 1, true)
              }}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                loadingMore ? <ActivityIndicator style={styles.listFooter} /> : null
              }
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>No versions found</Text>
                </View>
              }
            />
          )}

          {/* Restore button for single selection */}
          {selectedIds.length === 1 && (
            <Pressable
              style={[styles.restoreBtn, restoring && styles.restoreBtnDisabled]}
              onPress={() => handleRestore(selectedIds[0])}
              disabled={restoring}
            >
              <RotateCcw size={18} color={colors.primaryText} />
              <Text style={styles.restoreBtnText}>
                {restoring ? 'Restoring...' : 'Restore this version'}
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        /* Comparison mode */
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable style={styles.backBtn} onPress={() => setMode('list')}>
              <ArrowLeft size={20} color={colors.text} />
            </Pressable>
            <Text style={[styles.title, { flex: 1 }]}>Compare Versions</Text>
          </View>

          {/* Version date labels */}
          {versionFrom && versionTo && (
            <View style={styles.compareDates}>
              <View style={styles.compareDate}>
                <Text style={styles.compareDateLabel}>Comparing against</Text>
                <Text style={styles.compareDateValue}>{formatDate(versionFrom.updatedAt)}</Text>
              </View>
              <View style={styles.compareDate}>
                <Text style={styles.compareDateLabel}>Currently viewing</Text>
                <Text style={styles.compareDateValue}>{formatDate(versionTo.updatedAt)}</Text>
              </View>
            </View>
          )}

          {/* Diff */}
          {versionFrom && versionTo && (
            <ScrollView style={styles.diffScroll} contentContainerStyle={styles.diffContent}>
              <VersionDiff
                fields={fields}
                versionFrom={versionFrom.version as Record<string, unknown>}
                versionTo={versionTo.version as Record<string, unknown>}
                modifiedOnly
              />
            </ScrollView>
          )}

          {/* Restore button */}
          {versionTo && (
            <Pressable
              style={[styles.restoreBtn, restoring && styles.restoreBtnDisabled]}
              onPress={() => handleRestore(versionTo.id)}
              disabled={restoring}
            >
              <RotateCcw size={18} color={colors.primaryText} />
              <Text style={styles.restoreBtnText}>
                {restoring ? 'Restoring...' : 'Restore this version'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </BottomSheet>
  )
}
