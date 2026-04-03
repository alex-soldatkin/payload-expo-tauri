/**
 * @payload-universal/ui/shared — Native entry point.
 *
 * Provides native-compatible equivalents of @payloadcms/ui/shared utilities.
 * These are used by custom components that reference groupNavItems, EntityType, etc.
 */

// ---------------------------------------------------------------------------
// EntityType enum — matches Payload's EntityType
// ---------------------------------------------------------------------------

export const EntityType = {
  collection: 'collection',
  global: 'global',
} as const

export type EntityTypeValue = (typeof EntityType)[keyof typeof EntityType]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntityToGroup = {
  type: EntityTypeValue
  entity: {
    slug: string
    admin?: {
      group?: string
      hidden?: boolean
    }
    labels?: {
      singular?: string | Record<string, string>
      plural?: string | Record<string, string>
    }
    label?: string | Record<string, string>
  }
}

export type NavGroupItem = {
  slug: string
  type: EntityTypeValue
  label: string | Record<string, string>
}

export type NavGroup = {
  label: string
  entities: NavGroupItem[]
}

// ---------------------------------------------------------------------------
// groupNavItems — groups entities by their admin.group
// ---------------------------------------------------------------------------

export function groupNavItems(
  entities: EntityToGroup[],
  _permissions?: any,
  _i18n?: any,
): NavGroup[] {
  const groupMap = new Map<string, NavGroupItem[]>()

  for (const { type, entity } of entities) {
    const groupName = entity.admin?.group ?? ''
    const label = entity.labels?.plural ?? entity.labels?.singular ?? entity.label ?? entity.slug

    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, [])
    }

    groupMap.get(groupName)!.push({
      slug: entity.slug,
      type,
      label,
    })
  }

  const result: NavGroup[] = []
  for (const [label, entities] of groupMap) {
    result.push({ label: label || 'Ungrouped', entities })
  }

  return result
}

// ---------------------------------------------------------------------------
// formatAdminURL — builds admin panel URLs
// ---------------------------------------------------------------------------

export function formatAdminURL({
  adminRoute = '/admin',
  path = '',
}: {
  adminRoute?: string
  path?: string
}): string {
  const base = adminRoute.replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

// ---------------------------------------------------------------------------
// PREFERENCE_KEYS — matches Payload's preference keys
// ---------------------------------------------------------------------------

export const PREFERENCE_KEYS = {
  NAV: 'nav',
  THEME: 'theme',
  LOCALE: 'locale',
} as const

// ---------------------------------------------------------------------------
// getVisibleEntities — returns all entity slugs (no filtering on native)
// ---------------------------------------------------------------------------

export function getVisibleEntities(config: any): {
  collections: string[]
  globals: string[]
} {
  return {
    collections: (config?.collections ?? []).map((c: any) => c.slug),
    globals: (config?.globals ?? []).map((g: any) => g.slug),
  }
}
