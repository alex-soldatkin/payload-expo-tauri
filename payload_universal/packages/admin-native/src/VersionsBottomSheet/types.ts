import type { PayloadAPIConfig } from '../utils/api'
import type { ClientField, SerializedSchemaMap } from '../types'

export type Props = {
  visible: boolean
  onClose: () => void
  /** Collection slug. */
  slug: string
  /** ID of the parent document. */
  documentId: string
  /** API config for direct server calls. */
  apiConfig: PayloadAPIConfig
  /** Schema map for this collection (used to render field labels in the diff). */
  schemaMap: SerializedSchemaMap<unknown>
  /** Called after a version is successfully restored so the caller can refresh. */
  onRestore?: () => void
}

export type Mode = 'list' | 'compare'

export type { ClientField }
