/**
 * KanbanBoard drag constants + local frame type.
 *
 * Tunables for the board-owned PanResponder drag machinery (press
 * disambiguation, auto-scroll cadence, fallback sizing) plus the
 * window-space column drop-target frame shape.
 */
import {
  KANBAN_COLUMN_GAP,
  KANBAN_COLUMN_WIDTH,
} from '../types'

// Max finger travel (pt) for a long-press to count as STATIC (open preview)
// rather than a drag — Telegram-style press disambiguation.
export const STATIC_PRESS_MAX_DIST = 8
/** Edge zone (pt) that triggers horizontal auto-scroll while dragging. */
export const AUTO_SCROLL_EDGE = 56
/** Minimum gap (ms) between auto-scroll steps. */
export const AUTO_SCROLL_COOLDOWN = 650
export const SNAP_INTERVAL = KANBAN_COLUMN_WIDTH + KANBAN_COLUMN_GAP
/** Fallback card height (pt) until the pick-up measure resolves. */
export const FALLBACK_CARD_HEIGHT = 80

/** A column container's window-space frame (drop target). */
export type ColumnFrame = { x: number; y: number; width: number; height: number }
