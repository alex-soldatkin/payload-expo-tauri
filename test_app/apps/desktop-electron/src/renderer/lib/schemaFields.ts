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

// Payload auto-injects this metadata field set into every upload collection.
// Their combined presence is a reliable signal even when the server's admin
// schema predates the explicit `menuModel.upload` flag.
const UPLOAD_MARKER_FIELDS = ['filename', 'mimeType', 'filesize', 'url']

/**
 * Whether a collection is an upload collection. Prefers the explicit
 * `menuModel.upload` flag; falls back to detecting the auto-injected upload
 * metadata fields so the desktop file picker works against older servers too.
 */
export function isUploadCollection(schema: AdminSchema, slug: string): boolean {
  const meta = schema.menuModel.collections.find((c) => c.slug === slug)
  if (meta?.upload) return true
  const names = new Set(getRootFields(schema, slug).map((f) => (f as { name?: string }).name))
  return UPLOAD_MARKER_FIELDS.every((n) => names.has(n))
}
