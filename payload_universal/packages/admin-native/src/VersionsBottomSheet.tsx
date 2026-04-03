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
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { ArrowLeft, Check, RotateCcw } from 'lucide-react-native'

import { BottomSheet } from './BottomSheet'
import { VersionDiff } from './VersionDiff'
import { payloadApi, type PayloadAPIConfig, type VersionDoc } from './utils/api'
import { extractRootFields } from './utils/schemaHelpers'
import { defaultTheme as t } from './theme'
import type { ClientField, SerializedSchemaMap } from './types'

type Props = {
  visible: boolean
  onClose: () => void
  /** Collection slug. */
  slug: string
  /** ID of the parent document. */
  documentId: string
  /** API config for direct server calls. */
  apiConfig: PayloadAPIConfig
  /** Schema map for this collection (used to render field labels in the diff). */
  schemaMap: SerializedSchemaMap<unknown>
  /** Called after a version is successfully restored so the caller can refresh. */
  onRestore?: () => void
}

type Mode = 'list' | 'compare'

const PAGE_SIZE = 20

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ', ' + d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const relativeTime = (iso: string): string => {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  } catch {
    return ''
  }
}

export const VersionsBottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  slug,
  documentId,
  apiConfig,
  schemaMap,
  onRestore,
}) => {
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

  const renderVersionItem = useCallback(({ item }: { item: VersionDoc }) => {
    const isSelected = selectedIds.includes(item.id)
    const status = (item.version as Record<string, unknown>)?._status as string | undefined

    return (
      <Pressable
        style={[styles.versionRow, isSelected && styles.versionRowSelected]}
        onPress={() => toggleSelection(item.id)}
      >
        <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
          {isSelected && <Check size={14} color="#fff" />}
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
            {item.autosave && (
              <Text style={styles.autosaveLabel}>Autosave</Text>
            )}
          </View>
        </View>
      </Pressable>
    )
  }, [selectedIds, toggleSelection])

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
              <RotateCcw size={18} color="#fff" />
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
              <ArrowLeft size={20} color={t.colors.text} />
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
              <RotateCcw size={18} color="#fff" />
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: t.spacing.md,
    gap: t.spacing.sm,
  },
  title: {
    fontSize: t.fontSize.lg,
    fontWeight: '700',
    color: t.colors.text,
  },
  backBtn: {
    padding: t.spacing.xs,
  },

  // Selection hint
  selectionHint: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    marginBottom: t.spacing.sm,
    fontStyle: 'italic',
  },

  // Compare button
  compareBtn: {
    marginLeft: 'auto',
    backgroundColor: t.colors.primary,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
    borderRadius: t.borderRadius.sm,
  },
  compareBtnText: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: t.colors.primaryText,
  },

  // List
  listContent: {
    paddingBottom: t.spacing.xl,
  },
  listFooter: {
    paddingVertical: t.spacing.md,
  },

  // Version row
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
    gap: t.spacing.md,
  },
  versionRowSelected: {
    backgroundColor: '#f8f8f8',
  },

  // Check circle
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },

  // Version info
  versionInfo: { flex: 1 },
  versionDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionDate: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: t.colors.text,
  },
  versionRelative: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
  },
  versionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginTop: 4,
  },

  // Status pills
  versionStatusPill: {
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusDraftPill: { backgroundColor: '#fefce8' },
  statusPublishedPill: { backgroundColor: '#f0fdf4' },
  versionStatusText: {
    fontSize: t.fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusDraftColor: { color: '#ca8a04' },
  statusPublishedColor: { color: '#16a34a' },
  autosaveLabel: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    fontStyle: 'italic',
  },

  // Comparison dates
  compareDates: {
    flexDirection: 'row',
    gap: t.spacing.sm,
    marginBottom: t.spacing.md,
  },
  compareDate: {
    flex: 1,
    backgroundColor: '#fafafa',
    padding: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  compareDateLabel: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  compareDateValue: {
    fontSize: t.fontSize.sm,
    color: t.colors.text,
    fontWeight: '600',
  },

  // Diff scroll
  diffScroll: { flex: 1 },
  diffContent: { paddingBottom: t.spacing.xl },

  // Restore button
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.sm,
    backgroundColor: t.colors.primary,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.sm,
    marginTop: t.spacing.sm,
  },
  restoreBtnDisabled: { opacity: 0.5 },
  restoreBtnText: {
    fontSize: t.fontSize.md,
    fontWeight: '600',
    color: t.colors.primaryText,
  },

  // Loading / error / empty states
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.spacing.xl,
  },
  errorText: {
    fontSize: t.fontSize.sm,
    color: t.colors.error,
    textAlign: 'center',
    marginBottom: t.spacing.md,
  },
  retryBtn: {
    backgroundColor: t.colors.primary,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
  },
  retryBtnText: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: t.colors.primaryText,
  },
  emptyText: {
    fontSize: t.fontSize.sm,
    color: t.colors.textMuted,
  },
})
