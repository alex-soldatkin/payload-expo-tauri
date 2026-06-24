/**
 * GanttCustomizeSheet — prop + domain types.
 */
import type { CalendarSource } from '@payload-universal/admin-native'

import type { CalendarDateFieldOption } from '@/src/components/CalendarCustomizeSheet'
import type { GanttConfig } from '@/src/hooks/useGanttConfig'

export type GanttCustomizeSheetProps = {
  visible: boolean
  onClose: () => void
  /** The collection's date fields (dot-paths for nested group fields). */
  dateFieldOptions: CalendarDateFieldOption[]
  config: GanttConfig
  /** Effective sources (config.sources ?? pickDefaultSources) seeding the draft. */
  resolvedSources: CalendarSource[]
  onSave: (next: GanttConfig) => void
}

export type Draft = { sources: CalendarSource[]; pxPerDay: number | null }

export type SourceEditorState = {
  /** Index into draft.sources when editing; null = adding a new source. */
  index: number | null
  startField: string | null
  endField: string | null
  label: string
  /** True once the user typed in the label input (stops auto-fill). */
  labelTouched: boolean
  color: string
}
