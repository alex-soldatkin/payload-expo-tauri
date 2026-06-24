/**
 * Kanban mode renderer — same local-first docs, filtered + sorted like the
 * table; the toolbar search/sort/filter controls stay live above it. The
 * board's preview is a static long-press (no ScrollablePreview.Trigger wrap —
 * its native long-press recognizer kills the drag).
 */
import React from 'react'
import { View } from 'react-native'
import {
  KanbanBoard,
  type KanbanStatusField,
} from '@payload-universal/admin-native'
import { BoardFilterChips, type BoardFilterChipsProps } from './BoardFilterChips'
import type { KanbanConfig } from '@/src/hooks/useKanbanConfig'

export type KanbanModeViewProps = {
  headerHeight: number
  filterChips: BoardFilterChipsProps
  docs: Record<string, unknown>[]
  statusField: KanbanStatusField
  config: KanbanConfig
  fieldLabels: Record<string, string>
  useAsTitle?: string
  onPressCard: (doc: Record<string, unknown>) => void
  onMoveCard: (doc: Record<string, unknown>, toValue: string | null) => void | Promise<void>
  onPreviewCard: (doc: Record<string, unknown>) => void
  loadingDocIds: string[]
}

export function KanbanModeView({
  headerHeight,
  filterChips,
  docs,
  statusField,
  config,
  fieldLabels,
  useAsTitle,
  onPressCard,
  onMoveCard,
  onPreviewCard,
  loadingDocIds,
}: KanbanModeViewProps) {
  return (
    <View style={{ flex: 1, paddingTop: headerHeight }}>
      <BoardFilterChips {...filterChips} />
      <KanbanBoard
        docs={docs}
        statusField={statusField}
        columnOrder={config.columnOrder ?? undefined}
        columnColors={config.columnColors}
        hiddenColumns={config.hiddenColumns}
        cardFields={config.cardFields}
        fieldLabels={fieldLabels}
        useAsTitle={useAsTitle}
        onPressCard={onPressCard}
        onMoveCard={onMoveCard}
        // No ScrollablePreview.Trigger wrap here — its native long-press
        // recognizer kills the drag. Preview = static long-press (hold +
        // release without moving) or the ellipsis menu's "Preview".
        onPreviewCard={onPreviewCard}
        loadingDocIds={loadingDocIds}
      />
    </View>
  )
}
