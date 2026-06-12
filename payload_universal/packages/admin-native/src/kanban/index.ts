/**
 * Kanban barrel — liquid-glass board for select-driven collections.
 *
 * Screens import { KanbanBoard } and inject docs + callbacks (local-first;
 * no expo-router or data fetching inside the package).
 */
export { KanbanBoard } from './KanbanBoard'
export { KanbanColumn } from './KanbanColumn'
export type { KanbanColumnProps } from './KanbanColumn'
export { KanbanCard } from './KanbanCard'
export type { KanbanCardProps, KanbanCardRow } from './KanbanCard'
export {
  buildKanbanColumns,
  DEFAULT_KANBAN_PALETTE,
  formatKanbanFieldValue,
  getKanbanColumnValue,
  KANBAN_CARD_WIDTH,
  KANBAN_COLUMN_GAP,
  KANBAN_COLUMN_WIDTH,
  NO_STATUS_COLUMN_COLOR,
  NO_STATUS_COLUMN_VALUE,
} from './types'
export type {
  KanbanBoardProps,
  KanbanColumnSpec,
  KanbanDoc,
  KanbanMoveTarget,
  KanbanStatusField,
  KanbanStatusOption,
} from './types'
