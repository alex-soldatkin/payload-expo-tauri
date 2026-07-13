// Root field tree for a collection — the canonical read path per admin-core:
// the serialized schema map stores `{ fields }` under the plain slug key.
import { deserializeSchemaMap } from '@payload-universal/admin-schema/client'
import type { AdminSchema } from '@payload-universal/admin-schema'
import type { SchemaField } from '../form/types'

export function getRootFields(schema: AdminSchema, slug: string): SchemaField[] {
  const entries = schema.collections[slug]
  if (!entries) return []
  const map = deserializeSchemaMap(entries as Array<[string, unknown]>)
  const root = map.get(slug) as { fields?: SchemaField[] } | undefined
  return root?.fields ?? []
}
