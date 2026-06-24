/**
 * DragOverlay — the elevated copy of the picked-up card.
 *
 * Mounted at the dragged card's measured origin and driven by the board's
 * Animated.ValueXY during the gesture (pointerEvents disabled so it never
 * intercepts touches). The in-tree source card hides while this is live.
 */
import React from 'react'
import { Animated, type StyleProp, type ViewStyle } from 'react-native'

import { KanbanCard } from '../../KanbanCard'
import type { KanbanCardRow } from '../../KanbanCard'
import { KANBAN_CARD_WIDTH } from '../../types'
import type { KanbanDoc } from '../../types'

type DragOverlayProps = {
  doc: KanbanDoc
  title: string
  rows: KanbanCardRow[]
  accentColor: string
  overlayXY: Animated.ValueXY
  overlayStyle: StyleProp<ViewStyle>
}

export const DragOverlay: React.FC<DragOverlayProps> = ({
  doc,
  title,
  rows,
  accentColor,
  overlayXY,
  overlayStyle,
}) => (
  <Animated.View
    pointerEvents="none"
    style={[
      overlayStyle,
      { width: KANBAN_CARD_WIDTH, transform: overlayXY.getTranslateTransform() },
    ]}
  >
    <KanbanCard overlay doc={doc} title={title} rows={rows} accentColor={accentColor} />
  </Animated.View>
)
