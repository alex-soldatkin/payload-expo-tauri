import type { ClientField, SerializedSchemaMap } from '../types'

/** Deserialize schema entries back to a Map. */
export const deserializeSchemaMap = <T>(entries: SerializedSchemaMap<T>): Map<string, T> =>
  new Map(entries)

/** Extract root-level fields from a collection/global schema map. */
export const extractRootFields = (
  serializedMap: SerializedSchemaMap<unknown>,
  slug: string,
): ClientField[] => {
  const map = deserializeSchemaMap(serializedMap)
  const root = map.get(slug) as { fields?: ClientField[] } | undefined
  if (!root || !Array.isArray(root.fields)) return []
  return root.fields
}

/** Resolve a localised or plain string label. */
const resolveLabel = (
  label: string | Record<string, string> | undefined,
  fallback: string,
): string => {
  if (!label) return fallback
  if (typeof label === 'string') return label
  return label.en || Object.values(label)[0] || fallback
}

/** Get a human-readable label for a field. */
export const getFieldLabel = (field: ClientField, fallback?: string): string => {
  if (field.label) return resolveLabel(field.label, field.name || fallback || 'Untitled')
  if (field.name) {
    // "createdAt" → "Created At"
    return field.name.charAt(0).toUpperCase() + field.name.slice(1).replace(/([A-Z])/g, ' $1')
  }
  return fallback || 'Untitled'
}

/** Get description text from a field. */
export const getFieldDescription = (field: ClientField): string | undefined => {
  const desc = field.admin?.description
  if (!desc) return undefined
  return resolveLabel(desc, '')
}

/** Check if a field should be hidden in the UI. */
export const isFieldHidden = (field: ClientField): boolean =>
  Boolean(field.admin?.hidden)

/** Check if a field is positioned in the sidebar. */
export const isFieldSidebar = (field: ClientField): boolean =>
  field.admin?.position === 'sidebar'

/** Split root fields into main and sidebar groups. */
export const splitFieldsBySidebar = (
  fields: ClientField[],
): { mainFields: ClientField[]; sidebarFields: ClientField[] } => {
  const mainFields: ClientField[] = []
  const sidebarFields: ClientField[] = []
  for (const field of fields) {
    if (isFieldSidebar(field)) {
      sidebarFields.push(field)
    } else {
      mainFields.push(field)
    }
  }
  return { mainFields, sidebarFields }
}

/** Best-effort title for a document row. */
export const getDocumentTitle = (
  doc: Record<string, unknown>,
  titleField?: string,
): string => {
  if (titleField && doc[titleField]) return String(doc[titleField])
  for (const key of ['title', 'name', 'label', 'email', 'slug', 'filename']) {
    if (doc[key]) return String(doc[key])
  }
  return doc.id ? String(doc.id) : 'Untitled'
}

/** Look up a collection's plural or singular label from the menu model. */
export const getCollectionLabel = (
  menuModel: { collections: Array<{ slug: string; labels?: { singular?: string; plural?: string } }> },
  slug: string,
  plural = true,
): string => {
  const c = menuModel.collections.find((col) => col.slug === slug)
  if (!c?.labels) return slug.charAt(0).toUpperCase() + slug.slice(1)
  return (plural ? c.labels.plural : c.labels.singular) || slug
}

/** Look up a global's label from the menu model. */
export const getGlobalLabel = (
  menuModel: { globals: Array<{ slug: string; label?: string }> },
  slug: string,
): string => {
  const g = menuModel.globals.find((gl) => gl.slug === slug)
  return g?.label || slug.charAt(0).toUpperCase() + slug.slice(1)
}

/** Normalise a select/radio option to { label, value }. */
export const normalizeOption = (
  opt: string | { label: string | Record<string, string>; value: string },
): { label: string; value: string } => {
  if (typeof opt === 'string') return { label: opt, value: opt }
  return { label: resolveLabel(opt.label, opt.value), value: opt.value }
}

/** Get a nested value from an object by dot-separated path. */
export const getByPath = (obj: Record<string, unknown>, path: string): unknown => {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

// ---------------------------------------------------------------------------
// Width-aware field grouping
// ---------------------------------------------------------------------------

export type FieldWidthGroup =
  | { type: 'single'; field: ClientField }
  | { type: 'width-row'; fields: ClientField[] }

/**
 * Groups consecutive fields that have `admin.width` into width-row groups.
 * Fields without width remain individual entries. Used to render fields
 * side-by-side when they have explicit width percentages (e.g. '50%').
 */
export const groupFieldsByWidth = (fields: ClientField[]): FieldWidthGroup[] => {
  const groups: FieldWidthGroup[] = []
  let i = 0
  while (i < fields.length) {
    if (fields[i].admin?.width) {
      const wFields: ClientField[] = []
      while (i < fields.length && fields[i].admin?.width) {
        wFields.push(fields[i])
        i++
      }
      groups.push({ type: 'width-row', fields: wFields })
    } else {
      groups.push({ type: 'single', field: fields[i] })
      i++
    }
  }
  return groups
}

/** Set a nested value in an object by dot-separated path (immutable). */
export const setByPath = (
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> => {
  const keys = path.split('.')
  const result = { ...obj }
  let current: Record<string, unknown> = result

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    const next = current[key]
    const clone = (next != null && typeof next === 'object') ? { ...(next as Record<string, unknown>) } : {}
    current[key] = clone
    current = clone
  }

  current[keys[keys.length - 1]] = value
  return result
}
