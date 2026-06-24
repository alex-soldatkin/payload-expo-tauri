/**
 * KanbanBoard styles — board container + drag overlay.
 */
import { StyleSheet } from 'react-native'

import { KANBAN_COLUMN_GAP } from '../types'

export const createStyles = (background: string) =>
  StyleSheet.create({
    board: { flex: 1, backgroundColor: background },
    scrollContent: {
      // Leading padding matches the inter-column gap so snapToInterval
      // (width + gap) lands each column flush at the same inset.
      paddingHorizontal: KANBAN_COLUMN_GAP,
      paddingVertical: 12,
      gap: KANBAN_COLUMN_GAP,
      alignItems: 'stretch',
    },
    overlay: {
      position: 'absolute',
      left: 0,
      top: 0,
      zIndex: 1000,
      elevation: 12,
    },
  })
