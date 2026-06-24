// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MentionItem = {
  collection: string
  id: string
  title: string
}

export type MentionResult = MentionItem & {
  /** Collection display label for the badge. */
  collectionLabel: string
  /** Collection icon string from menuModel. */
  collectionIcon?: string
}

export type SectionData = {
  slug: string
  label: string
  icon?: string
  data: MentionResult[]
}

export type Props = {
  visible: boolean
  /** Current search text from the onChangeMention event (text after `@`). */
  searchText: string
  /** Called when the user selects a document to mention. */
  onSelect: (item: MentionItem) => void
  /** Called when the picker should be dismissed without selection. */
  onDismiss: () => void
}

/** A flattened row in the FlatList: either a section header or a result item. */
export type FlatRow =
  | { type: 'header'; section: SectionData }
  | { type: 'item'; item: MentionResult }
