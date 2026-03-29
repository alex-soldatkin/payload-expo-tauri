/**
 * Aggregated sync status section for the Account tab.
 * Shows overall sync state + individual cards for each pending item.
 */
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { defaultTheme as t } from './theme'
import { SyncStatusCard } from './SyncStatusCard'

type UploadItem = {
  id: string
  fileName: string
  targetCollection: string
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error: string
  createdAt: string
}

type Props = {
  pendingUploads: UploadItem[]
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline'
  onRetryUpload: (id: string) => void
  onRetryAllUploads: () => void
  onRemoveUpload: (id: string) => void
  onClearCompleted: () => void
}

export const SyncStatusSection: React.FC<Props> = ({
  pendingUploads,
  syncStatus,
  onRetryUpload,
  onRetryAllUploads,
  onRemoveUpload,
  onClearCompleted,
}) => {
  const pendingCount = pendingUploads.filter((u) => u.status === 'pending' || u.status === 'uploading').length
  const errorCount = pendingUploads.filter((u) => u.status === 'error').length
  const completedCount = pendingUploads.filter((u) => u.status === 'completed').length
  const totalActive = pendingUploads.filter((u) => u.status !== 'completed').length

  const overallColor =
    errorCount > 0 ? '#dc2626' :
    pendingCount > 0 ? '#f59e0b' :
    syncStatus === 'syncing' ? '#3b82f6' :
    syncStatus === 'offline' ? '#6b7280' :
    '#16a34a'

  const overallLabel =
    errorCount > 0 ? `${errorCount} error${errorCount !== 1 ? 's' : ''}` :
    pendingCount > 0 ? `${pendingCount} pending` :
    syncStatus === 'syncing' ? 'Syncing...' :
    syncStatus === 'offline' ? 'Offline' :
    'All synced'

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sync Status</Text>
        <View style={styles.badge}>
          <View style={[styles.badgeDot, { backgroundColor: overallColor }]} />
          <Text style={[styles.badgeText, { color: overallColor }]}>{overallLabel}</Text>
        </View>
      </View>

      {/* Summary */}
      {pendingUploads.length > 0 && (
        <Text style={styles.summary}>
          {pendingCount > 0 && `${pendingCount} uploading`}
          {pendingCount > 0 && completedCount > 0 && ' · '}
          {completedCount > 0 && `${completedCount} synced`}
          {(pendingCount > 0 || completedCount > 0) && errorCount > 0 && ' · '}
          {errorCount > 0 && `${errorCount} failed`}
        </Text>
      )}

      {/* Individual cards */}
      {pendingUploads
        .filter((u) => u.status !== 'completed')
        .map((item) => (
          <SyncStatusCard
            key={item.id}
            collectionName={item.targetCollection}
            title={item.fileName}
            status={item.status}
            errorMessage={item.error || undefined}
            timestamp={item.createdAt}
            onRetry={item.status === 'error' ? () => onRetryUpload(item.id) : undefined}
            onRemove={() => onRemoveUpload(item.id)}
          />
        ))}

      {/* Completed items (collapsed) */}
      {completedCount > 0 && (
        <View style={styles.completedRow}>
          <Text style={styles.completedText}>
            {completedCount} upload{completedCount !== 1 ? 's' : ''} synced
          </Text>
          <Pressable onPress={onClearCompleted}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        </View>
      )}

      {/* Retry all */}
      {errorCount > 0 && (
        <Pressable style={styles.retryAllBtn} onPress={onRetryAllUploads}>
          <Text style={styles.retryAllText}>Retry All Failed</Text>
        </Pressable>
      )}

      {/* Empty state */}
      {pendingUploads.length === 0 && syncStatus === 'idle' && (
        <Text style={styles.emptyText}>Everything is up to date</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginTop: t.spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: t.spacing.md,
  },
  headerTitle: { fontSize: t.fontSize.md, fontWeight: '700', color: t.colors.text },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: t.fontSize.xs, fontWeight: '700' },
  summary: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    marginBottom: t.spacing.sm,
  },
  completedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: t.spacing.sm,
  },
  completedText: { fontSize: t.fontSize.xs, color: t.colors.textMuted },
  clearText: { fontSize: t.fontSize.xs, color: t.colors.primary, fontWeight: '600' },
  retryAllBtn: {
    alignItems: 'center',
    paddingVertical: t.spacing.md,
    marginTop: t.spacing.sm,
    borderWidth: 1,
    borderColor: t.colors.error,
    borderRadius: t.borderRadius.sm,
  },
  retryAllText: { fontSize: t.fontSize.sm, color: t.colors.error, fontWeight: '600' },
  emptyText: {
    fontSize: t.fontSize.sm,
    color: t.colors.textMuted,
    textAlign: 'center',
    paddingVertical: t.spacing.md,
  },
})
