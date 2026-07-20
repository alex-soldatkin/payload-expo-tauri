// Pure column model for the desktop list table: which root fields can be shown
// as columns, the per-collection defaults, sortability, and the client-side
// search predicate. Kept free of React/DOM so it is trivially testable.
import type { AdminSchema } from '@payload-universal/admin-schema'
import type { SchemaField } from '../../form/types'
import { docTitle } from '../../lib/doc'
import { flattenTransparent } from './flattenTransparent'

/** Field types renderable as a table column (scalar-ish + containers as badges). */
const DISPLAYABLE_TYPES = new Set([
  'text', 'textarea', 'email', 'number', 'date', 'select', 'radio',
  'checkbox', 'relationship', 'upload', 'array', 'blocks', 'richText',
  'code', 'json', 'point',
])

/** Field types that support server-side (RxDB) sorting. */
const SORTABLE_TYPES = new Set(['text', 'email', 'number', 'date', 'select', 'checkbox'])

/** Always-available synthetic columns backed by replication-managed keys. */
export const META_COLUMNS: Record<string, { label: string; sortable: boolean; type: string }> = {
  id: { label: 'ID', sortable: false, type: 'id' },
  updatedAt: { label: 'Updated', sortable: true, type: 'date' },
  createdAt: { label: 'Created', sortable: true, type: 'date' },
  _status: { label: 'Status', sortable: false, type: 'text' },
}

export type DisplayField = {
  key: string
  label: string
  type: string
  sortable: boolean
  field?: SchemaField
}

/** Root fields the user can pick as columns (skips hidden + presentational). */
export function displayableFields(rootFields: SchemaField[]): DisplayField[] {
  const out: DisplayField[] = []
  // Transparent containers (rows/collapsibles/unnamed tabs) don't nest data —
  // their children live at the document root, so they're list columns too.
  // Without this, container-nested fields fell back to bare text columns
  // (raw relationship ids, ALL-CAPS key labels).
  for (const f of flattenTransparent(rootFields)) {
    if (!f.name || f.admin?.hidden || f.admin?.disabled) continue
    if (!DISPLAYABLE_TYPES.has(f.type)) continue
    out.push({
      key: f.name,
      label: fieldLabel(f),
      type: f.type,
      sortable: SORTABLE_TYPES.has(f.type),
      field: f,
    })
  }
  return out
}

function fieldLabel(f: SchemaField): string {
  const explicit = typeof f.label === 'string' ? f.label : undefined
  if (explicit) return explicit
  if (f.label && typeof f.label === 'object') {
    const v = f.label.en ?? Object.values(f.label)[0]
    if (v) return v
  }
  const name = f.name ?? ''
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

export function metaOrFieldColumn(key: string, fields: DisplayField[]): DisplayField {
  const found = fields.find((f) => f.key === key)
  if (found) return found
  const meta = META_COLUMNS[key]
  if (meta) return { key, label: meta.label, type: meta.type, sortable: meta.sortable }
  return { key, label: key, type: 'text', sortable: false }
}

type CollectionMeta = { slug: string; useAsTitle?: string; drafts?: boolean; defaultColumns?: string[] }

/** Default columns for a collection, honouring defaultColumns then title+updatedAt. */
export function defaultColumns(
  schema: AdminSchema,
  slug: string,
  fields: DisplayField[],
): string[] {
  const meta = schema.menuModel.collections.find((c) => c.slug === slug) as
    | CollectionMeta
    | undefined
  const useAsTitle = meta?.useAsTitle
  const titleKey = useAsTitle ?? 'id'
  const hasDrafts = Boolean(meta?.drafts)

  let cols: string[]
  const declared = meta?.defaultColumns
  if (Array.isArray(declared) && declared.length > 0) {
    cols = [...declared]
  } else {
    cols = [titleKey, 'updatedAt']
  }
  // Strip _status when the collection has no drafts.
  if (!hasDrafts) cols = cols.filter((c) => c !== '_status')
  // Always prepend the title column if not already included.
  return ensureTitle(cols, titleKey)
}

/** Prepend the title column (useAsTitle||'id') if missing. */
export function ensureTitle(cols: string[], titleKey: string): string[] {
  if (cols.includes(titleKey)) return cols
  return [titleKey, ...cols]
}

/** Case-insensitive substring filter over docTitle + any string field value. */
export function matchesQuery(
  doc: Record<string, unknown>,
  query: string,
  useAsTitle?: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (docTitle(doc, useAsTitle).toLowerCase().includes(q)) return true
  for (const v of Object.values(doc)) {
    if (typeof v === 'string' && v.toLowerCase().includes(q)) return true
  }
  return false
}
