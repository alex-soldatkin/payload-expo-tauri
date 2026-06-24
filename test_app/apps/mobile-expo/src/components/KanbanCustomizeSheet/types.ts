import type { ClientField } from '@payload-universal/admin-native'

import type { KanbanConfig } from '@/src/hooks/useKanbanConfig'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type KanbanCustomizeSheetProps = {
  visible: boolean
  onClose: () => void
  /** Eligible status fields: plain selects (hasMany false) and radios. */
  statusFieldCandidates: ClientField[]
  /** Fields offered in the card-fields multi-select. */
  cardFieldCandidates: ClientField[]
  config: KanbanConfig
  onSave: (next: KanbanConfig) => void
}

export type OptionLike = { label: string; value: string }

export type FieldWithOptions = ClientField & {
  options?: Array<string | { label: string | Record<string, string>; value: string }>
}
