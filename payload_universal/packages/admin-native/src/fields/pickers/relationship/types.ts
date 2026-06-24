import type { ClientRelationshipField, FieldComponentProps } from '../../../types'

export type RelDoc = Record<string, unknown>

/** Normalized selected entry. `title` is set when the raw value was populated. */
export type RelItem = { relationTo: string; id: string; title?: string }

export const PAGE_SIZE = 30

export type RelationshipFieldProps = FieldComponentProps<ClientRelationshipField> & {
  /**
   * Injected by the host screen / DocumentForm: called when the user taps
   * "Create new" in the picker sheet. Navigation stays in app code —
   * packages never import expo-router (render-callback injection pattern).
   */
  onRequestCreate?: (relationTo: string) => void
}
