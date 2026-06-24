/**
 * Shared types for the collection-list screen (route:
 * app/(admin)/collections/[slug]/index.tsx) and its extracted pieces.
 */
import type { DocumentListSort } from '@payload-universal/admin-native'

// Table-mode pin preferences (sticky header band / frozen title column) —
// both default ON; toggled in the list settings sheet, persisted per slug.
export type TablePins = { header: boolean; firstColumn: boolean }

// Date fields offered as calendar/gantt sources. Names are dot-paths (the
// server view-presets convention, e.g. 'scheduling.scheduledPublish').
export type DateFieldOption = { name: string; label: string; type: 'date' }

export type SelectionActionBarProps = {
  selectedCount: number
  actions: Array<{ key: string; label: string; icon?: string; destructive?: boolean }>
  onAction: (key: string) => void
  onDone: () => void
}

// Re-export for convenience so siblings can `import type { DocumentListSort }`
// from one screen-local module if desired.
export type { DocumentListSort }
