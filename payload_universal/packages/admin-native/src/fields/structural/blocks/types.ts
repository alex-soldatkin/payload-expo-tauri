import type { ClientBlocksField } from '../../../types'

export type BlockConfig = NonNullable<ClientBlocksField['blocks']>[number]
export type BlockItem = Record<string, unknown> & { blockType?: string; blockName?: string }
