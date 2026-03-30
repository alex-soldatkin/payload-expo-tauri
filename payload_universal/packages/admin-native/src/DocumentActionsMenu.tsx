/**
 * DocumentActionsMenu — a bottom sheet action menu for the document edit header.
 *
 * Shows contextual actions based on collection capabilities:
 *  - "Versions" (when the collection has versions enabled)
 *  - "Save as Draft" / "Publish" / "Unpublish" (when the collection has drafts enabled)
 */
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { FileText, Globe, History, EyeOff } from 'lucide-react-native'

import { BottomSheet } from './BottomSheet'
import { defaultTheme as t } from './theme'

type Props = {
  visible: boolean
  onClose: () => void
  /** Whether the collection has versions enabled. */
  hasVersions?: boolean
  /** Whether the collection has drafts enabled. */
  hasDrafts?: boolean
  /** Current document _status. */
  currentStatus?: 'draft' | 'published' | string
  /** Callbacks for each action. */
  onViewVersions?: () => void
  onSaveDraft?: () => void
  onPublish?: () => void
  onUnpublish?: () => void
}

type ActionItem = {
  icon: React.ReactNode
  label: string
  onPress: () => void
  destructive?: boolean
}

export const DocumentActionsMenu: React.FC<Props> = ({
  visible,
  onClose,
  hasVersions,
  hasDrafts,
  currentStatus,
  onViewVersions,
  onSaveDraft,
  onPublish,
  onUnpublish,
}) => {
  const actions: ActionItem[] = []

  if (hasVersions && onViewVersions) {
    actions.push({
      icon: <History size={20} color={t.colors.text} />,
      label: 'Versions',
      onPress: onViewVersions,
    })
  }

  if (hasDrafts) {
    if (currentStatus === 'published' && onSaveDraft) {
      actions.push({
        icon: <FileText size={20} color={t.colors.text} />,
        label: 'Save as Draft',
        onPress: onSaveDraft,
      })
    }
    if (currentStatus === 'draft' && onPublish) {
      actions.push({
        icon: <Globe size={20} color={t.colors.text} />,
        label: 'Publish',
        onPress: onPublish,
      })
    }
    if (currentStatus === 'published' && onUnpublish) {
      actions.push({
        icon: <EyeOff size={20} color={t.colors.destructive} />,
        label: 'Unpublish',
        onPress: onUnpublish,
        destructive: true,
      })
    }
  }

  if (actions.length === 0) return null

  // Dynamic height based on item count (header + items + padding)
  const sheetHeight = Math.min(0.4, (actions.length * 56 + 70) / 800)

  return (
    <BottomSheet visible={visible} onClose={onClose} height={sheetHeight}>
      <Text style={styles.title}>Actions</Text>
      {actions.map((action, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => {
            action.onPress()
            onClose()
          }}
        >
          {action.icon}
          <Text style={[styles.rowLabel, action.destructive && styles.rowDestructive]}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: t.fontSize.lg,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: t.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
  },
  rowPressed: {
    backgroundColor: '#f5f5f5',
  },
  rowLabel: {
    fontSize: t.fontSize.md,
    color: t.colors.text,
    fontWeight: '500',
  },
  rowDestructive: {
    color: t.colors.destructive,
  },
})
