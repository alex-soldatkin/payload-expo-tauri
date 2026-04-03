/**
 * useEntityVisibility — Native implementation.
 *
 * Derives visible entities from admin schema + auth permissions.
 */
import { useAdminSchema, useAuth } from '@payload-universal/admin-native'

export type UseEntityVisibilityReturn = {
  visibleEntities: {
    collections: string[]
    globals: string[]
  }
}

export function useEntityVisibility(): UseEntityVisibilityReturn {
  const schema = useAdminSchema()
  const auth = useAuth()

  if (!schema) {
    return { visibleEntities: { collections: [], globals: [] } }
  }

  const menuModel = (schema as any)?.menuModel

  // Extract slugs from menu model, filtering by basic access
  const collections: string[] = []
  const globals: string[] = []

  if (menuModel?.groups) {
    for (const group of menuModel.groups) {
      if (group.collections) {
        for (const col of group.collections) {
          collections.push(col.slug)
        }
      }
    }
  }

  if (menuModel?.globals) {
    for (const g of menuModel.globals) {
      globals.push(g.slug)
    }
  }

  return { visibleEntities: { collections, globals } }
}
