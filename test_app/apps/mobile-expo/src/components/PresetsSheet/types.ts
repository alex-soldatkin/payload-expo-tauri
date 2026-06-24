import type { CalendarConfig } from '@/src/hooks/useCalendarConfig'
import type { GanttConfig } from '@/src/hooks/useGanttConfig'
import type { KanbanConfig, ListViewMode } from '@/src/hooks/useKanbanConfig'
import type {
  ViewPresetAccessMode,
  ViewPresetDoc,
} from '@/src/hooks/useViewPresets'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type PresetsSheetProps = {
  visible: boolean
  onClose: () => void
  slug: string
  /** Current view mode — lifted into new/updated presets. */
  currentViewType: ListViewMode
  /** Current board config — lifted into new/updated presets. */
  currentConfig: KanbanConfig
  /** Current calendar config (RESOLVED sources) — lifted into new/updated presets. */
  currentCalendarConfig: CalendarConfig
  /** Current gantt config (RESOLVED sources) — lifted into new/updated presets. */
  currentGanttConfig: GanttConfig
  /** Current structured filters as a Payload where (search excluded). */
  currentWhere: Record<string, unknown> | null
  /** Apply a preset: the screen writes config + view mode + filters. */
  onApply: (preset: ViewPresetDoc) => void
}

export type EditorState = {
  mode: 'create' | 'edit'
  id?: string
  title: string
  accessMode: ViewPresetAccessMode
  sharedWith: string[]
}

export type RowAction = {
  key: string
  label: string
  /** SF Symbol (iOS menu). */
  icon?: string
  destructive?: boolean
  onPress: () => void
}
