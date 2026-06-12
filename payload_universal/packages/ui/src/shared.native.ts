export enum EntityType {
  collection = 'collection',
  global = 'global',
}

export type EntityToGroup = {
  type: EntityType
  entity: any
}

// Basic shim for mobile nav grouping
export function groupNavItems(entities: EntityToGroup[], permissions: any, i18n: any) {
  // Simple fallback: group just by a 'Payload' label on mobile instead of parsing complex admin schema
  return [
    {
      label: 'Content',
      entities: entities.map(e => ({
        slug: e.entity.slug || '',
        type: e.type,
        label: e.entity.labels?.plural || e.entity.slug
      }))
    }
  ]
}

/** formatAdminURL — builds admin panel URLs (@payloadcms/ui/shared parity). */
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

/** PREFERENCE_KEYS — matches Payload's preference keys. */
export const PREFERENCE_KEYS = {
  NAV: 'nav',
  THEME: 'theme',
  LOCALE: 'locale',
} as const
