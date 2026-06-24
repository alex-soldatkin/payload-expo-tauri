// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const PER_COLLECTION_LIMIT = 20
export const TOTAL_LIMIT = 50
export const DEBOUNCE_MS = 200

/** Derive a display title from a document using the collection's useAsTitle field. */
export const docTitle = (doc: Record<string, unknown>, useAsTitle?: string): string => {
  if (useAsTitle && doc[useAsTitle] != null) return String(doc[useAsTitle])
  return String(doc.title ?? doc.name ?? doc.email ?? doc.id ?? '')
}

/** Derive the singular label for a collection from its menuModel entry. */
export const collectionLabel = (entry: {
  slug: string
  labels?: { singular?: string; plural?: string }
}): string => {
  if (entry.labels?.singular) return entry.labels.singular
  // Capitalise slug as fallback
  return entry.slug.charAt(0).toUpperCase() + entry.slug.slice(1)
}
