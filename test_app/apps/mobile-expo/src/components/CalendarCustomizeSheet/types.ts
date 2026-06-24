/**
 * CalendarCustomizeSheet — prop + domain types.
 */
import type { CalendarMode, CalendarSource } from '@payload-universal/admin-native'

import type { CalendarConfig } from '@/src/hooks/useCalendarConfig'

/** A date field offered as a start/end candidate (name is a dot-path). */
export type CalendarDateFieldOption = { name: string; label: string }

export type CalendarCustomizeSheetProps = {
  visible: boolean
  onClose: () => void
  /** The collection's date fields (dot-paths for nested group fields). */
  dateFieldOptions: CalendarDateFieldOption[]
  config: CalendarConfig
  /** Effective sources (config.sources ?? pickDefaultSources) seeding the draft. */
  resolvedSources: CalendarSource[]
  onSave: (next: CalendarConfig) => void
}

export type Draft = { sources: CalendarSource[]; defaultMode: CalendarMode }

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
