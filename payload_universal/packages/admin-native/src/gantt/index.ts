/**
 * Gantt barrel — infinitely scrollable, user-editable gantt over Payload docs.
 *
 * Screens import { GanttChart } and inject docs + sources + callbacks
 * (local-first; no expo-router or data fetching inside the package). The
 * sources are plain ScheduleSource entries — identical to the server
 * view-presets `ganttSources` field and the calendar's `calendarSources`.
 * All view-agnostic mapping/date/scale logic lives in ../scheduling.
 */
export { GanttChart } from './GanttChart'
export { GanttBar } from './GanttBar'
export type { GanttBarProps } from './GanttBar'
export { TimeAxis } from './TimeAxis'
export type { TimeAxisProps } from './TimeAxis'
export {
  buildGanttRows,
  computeNextRange,
  GANTT_AXIS_HEIGHT,
  GANTT_BAR_HEIGHT,
  GANTT_BAR_MIN_TITLE_WIDTH,
  GANTT_BODY_HOLD_MS,
  GANTT_CHART_DEFAULT_PX_PER_DAY,
  GANTT_EXTEND_DAYS,
  GANTT_EXTEND_THRESHOLD_DAYS,
  GANTT_HANDLE_WIDTH,
  GANTT_LANE_GAP,
  GANTT_MAX_AUTO_WINDOW_DAYS,
  GANTT_MIN_ROW_HEIGHT,
  GANTT_POINT_SIZE,
  GANTT_REGULAR_WIDTH,
  GANTT_ROW_VERTICAL_PADDING,
  GANTT_STATIC_PRESS_MAX_DIST,
  GANTT_TITLE_COLUMN_WIDTH,
  GANTT_WINDOW_PAD_AFTER_DAYS,
  GANTT_WINDOW_PAD_BEFORE_DAYS,
  initialGanttWindow,
  shiftIsoByDays,
} from './types'
export type {
  GanttBarSpec,
  GanttChartProps,
  GanttDragMode,
  GanttRowModel,
} from './types'
