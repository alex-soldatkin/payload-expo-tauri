// Grouping helpers over the schema's menuModel — shared by the sidebar nav
// and the native menu builder so both stay in sync.
import type { AdminSchema, MenuModel } from '@payload-universal/admin-schema'

export type CollectionMeta = MenuModel['collections'][number]
export type GlobalMeta = MenuModel['globals'][number]

export const UNGROUPED_LABEL = 'Other'

export type CollectionGroup = {
  group: string
  collections: CollectionMeta[]
}

export function collectionLabel(c: CollectionMeta): string {
  return c.labels?.plural || c.labels?.singular || c.slug
}

export function collectionLabelSingular(c: CollectionMeta): string {
  return c.labels?.singular || c.labels?.plural || c.slug
}

export function globalLabel(g: GlobalMeta): string {
  return g.label || g.slug
}

function sortGroupKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === UNGROUPED_LABEL) return 1
    if (b === UNGROUPED_LABEL) return -1
    return a.localeCompare(b)
  })
}

/** Visible collections, grouped exactly like the Tauri menu bridge. */
export function groupCollections(schema: AdminSchema | null): CollectionGroup[] {
  const groups = new Map<string, CollectionMeta[]>()
  for (const c of schema?.menuModel.collections ?? []) {
    if (c.hidden) continue
    const key = c.group || UNGROUPED_LABEL
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  return sortGroupKeys([...groups.keys()]).map((group) => ({
    group,
    collections: groups.get(group) ?? [],
  }))
}

/** Visible globals, grouped the same way. */
export function groupGlobals(schema: AdminSchema | null): Array<{ group: string; globals: GlobalMeta[] }> {
  const groups = new Map<string, GlobalMeta[]>()
  for (const g of schema?.menuModel.globals ?? []) {
    if (g.hidden) continue
    const key = g.group || UNGROUPED_LABEL
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(g)
  }
  return sortGroupKeys([...groups.keys()]).map((group) => ({
    group,
    globals: groups.get(group) ?? [],
  }))
}

/** Collections with drafts enabled (Workflow → Drafts). */
export function draftCollections(schema: AdminSchema | null): CollectionMeta[] {
  return (schema?.menuModel.collections ?? []).filter((c) => !c.hidden && c.drafts)
}

/** Flat list of visible collection slugs (used to pick a default view). */
export function firstCollectionSlug(schema: AdminSchema | null): string | null {
  for (const c of schema?.menuModel.collections ?? []) {
    if (!c.hidden) return c.slug
  }
  return null
}
