import { resolveI18nText } from '../common'
import type { BlockConfig, BlockItem } from './types'

export const blockLabelFor = (block: BlockConfig | undefined, item: BlockItem): string =>
  block?.labels?.singular || item.blockType || 'Block'

/** Group key for the picker — Payload block configs may carry admin.group. */
export const blockGroupFor = (block: BlockConfig): string => {
  const raw = (block as any)?.admin?.group ?? (block as any)?.group
  return resolveI18nText(raw, '')
}

/** Deep-clone a block row for Duplicate, stripping the row `id`. */
export const cloneBlock = (row: BlockItem): BlockItem => {
  try {
    const cloned = JSON.parse(JSON.stringify(row ?? {})) as BlockItem
    delete (cloned as Record<string, unknown>).id
    return cloned
  } catch {
    const { id: _id, ...rest } = row ?? {}
    return { ...rest }
  }
}
