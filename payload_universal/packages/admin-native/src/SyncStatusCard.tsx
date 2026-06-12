/**
 * A card showing the sync status of a single pending item (upload or document push).
 * Used in the Account tab's Sync Status section.
 */
import React, { useEffect, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { defaultTheme as t } from './theme'
import { useListColors } from './hooks/useListColors'

// Optional: GlassView for liquid glass cards on iOS 26+ (graceful fallback)
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

type Status = 'pending' | 'uploading' | 'completed' | 'error'

type Props = {
  collectionName: string
  title: string
  status: Status
  errorMessage?: string
  onRetry?: () => void
  onRemove?: () => void
  timestamp?: string
}

const STATUS_CONFIG: Record<Status, { color: string; label: string }> = {
  pending: { color: '#f59e0b', label: 'Pending' },
  uploading: { color: '#3b82f6', label: 'Uploading' },
  completed: { color: '#16a34a', label: 'Synced' },
  error: { color: '#dc2626', label: 'Error' },
}

export const SyncStatusCard: React.FC<Props> = ({
  collectionName,
  title,
  status,
  errorMessage,
  onRetry,
  onRemove,
  timestamp,
}) => {
  const config = STATUS_CONFIG[status]
  const { colors: c } = useListColors()
  const pulseAnim = useRef(new Animated.Value(1)).current

  // Pulse animation for uploading status
  useEffect(() => {
    if (status === 'uploading') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      )
      anim.start()
      return () => anim.stop()
    } else {
      pulseAnim.setValue(1)
    }
  }, [status, pulseAnim])

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const cardContent = (
    <>
      {/* Status dot */}
      <Animated.View
        style={[styles.dot, { backgroundColor: config.color, opacity: pulseAnim }]}
      />

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.collection, { color: c.textMuted }]}>{collectionName}</Text>
          <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
        </View>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{title}</Text>
        {errorMessage && (
          <Text style={[styles.error, { color: c.error }]} numberOfLines={2}>{errorMessage}</Text>
        )}
        {timestamp && (
          <Text style={[styles.timestamp, { color: c.textMuted }]}>{formatTime(timestamp)}</Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {status === 'error' && onRetry && (
          <Pressable onPress={onRetry} style={[styles.retryBtn, { backgroundColor: c.primary }]}>
            <Text style={[styles.retryText, { color: c.primaryText }]}>Retry</Text>
          </Pressable>
        )}
        {(status === 'completed' || status === 'error') && onRemove && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Text style={[styles.removeText, { color: c.textMuted }]}>✕</Text>
          </Pressable>
        )}
      </View>
    </>
  )

  // Liquid glass card on iOS 26+ — themed bordered card elsewhere
  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView style={styles.glassCard} glassEffectStyle="regular">
        {cardContent}
      </GlassView>
    )
  }

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      {cardContent}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    padding: t.spacing.md,
    marginBottom: t.spacing.sm,
    gap: t.spacing.md,
  },
  glassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: t.borderRadius.md,
    padding: t.spacing.md,
    marginBottom: t.spacing.sm,
    gap: t.spacing.md,
    overflow: 'hidden',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  content: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  collection: { fontSize: t.fontSize.xs, fontWeight: '700', color: t.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusLabel: { fontSize: t.fontSize.xs, fontWeight: '700' },
  title: { fontSize: t.fontSize.sm, fontWeight: '600', color: t.colors.text, marginTop: 2 },
  error: { fontSize: t.fontSize.xs, color: t.colors.error, marginTop: 2 },
  timestamp: { fontSize: t.fontSize.xs, color: t.colors.textMuted, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
  retryBtn: {
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
  },
  retryText: { fontSize: t.fontSize.xs, fontWeight: '700', color: t.colors.primaryText },
  removeText: { fontSize: 14, color: t.colors.textMuted, fontWeight: '700' },
})
