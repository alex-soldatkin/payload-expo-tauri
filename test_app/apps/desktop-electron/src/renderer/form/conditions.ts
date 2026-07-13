// Client-side condition registry. Payload admin.condition functions cannot be
// serialized — the admin schema only marks fields with admin.hasCondition and
// lists their paths. Real predicates are registered here per collection, the
// same pattern the Expo app uses (ConditionRegistryProvider).
//
// KEEP IN SYNC with test_app/apps/server/src/{collections,globals} — each
// entry mirrors an admin.condition in the SSOT config. Resolution and
// fail-open semantics mirror admin-native/contexts/ConditionContext.tsx.
import { getAtPath, normalizeIndexes, parentPath } from './paths'

export type ConditionFn = (
  data: Record<string, unknown>,
  siblingData: Record<string, unknown>,
) => boolean

type Registry = Record<string, Record<string, ConditionFn>>

/** Mirrors the SSOT config's admin.condition functions (see file:line refs). */
const registry: Registry = {
  pages: {
    // Pages.ts CallToActionBlock — block-scoped paths: {field}.{blockSlug}.{name}
    'layout.cta.internalPage': (_d, s) => s.linkType === 'internal',
    'layout.cta.externalUrl': (_d, s) => s.linkType === 'external',
    'layout.cta.openInNewTab': (_d, s) => s.linkType === 'external',
    // Pages.ts named tab `settings`
    'settings.navOrder': (_d, s) => Boolean(s.showInNav),
  },
  events: {
    'registrationUrl': (_d, s) => Boolean(s.requiresRegistration),
    'capacity': (_d, s) => Boolean(s.requiresRegistration),
  },
  'site-settings': {
    'maintenanceMessage': (d) => Boolean(d.maintenanceMode),
  },
  'view-presets': {
    'statusField': (d) => d.viewType !== 'table',
    'calendarSources': (d) => d.viewType === 'calendar',
    'calendarDefaultMode': (d) => d.viewType === 'calendar',
    'ganttSources': (d) => d.viewType === 'gantt',
    'ganttOptions': (d) => d.viewType === 'gantt',
    'sharedWith': (d) => d.accessMode === 'specificUsers',
  },
}

/**
 * Resolve the condition for a concrete form path: exact match first, then
 * index-normalized (`items.0.title` → `items.title`), then block-scoped
 * (`layout.0.internalPage` + blockType 'cta' → `layout.cta.internalPage`).
 */
function resolveCondition(slug: string, path: string, blockType?: string): ConditionFn | undefined {
  const bySlug = registry[slug]
  if (!bySlug) return undefined
  if (bySlug[path]) return bySlug[path]
  const normalized = normalizeIndexes(path)
  if (bySlug[normalized]) return bySlug[normalized]
  if (blockType) {
    const segs = normalized.split('.')
    const name = segs.pop()
    const scoped = [...segs, blockType, name].join('.')
    if (bySlug[scoped]) return bySlug[scoped]
  }
  return undefined
}

/**
 * Is the field at `path` visible? Fail-open: unregistered or throwing
 * conditions keep the field visible (matches mobile).
 */
export function isFieldVisible(
  slug: string,
  path: string,
  formData: Record<string, unknown>,
  blockType?: string,
): boolean {
  const fn = resolveCondition(slug, path, blockType)
  if (!fn) return true
  try {
    const sibling = getAtPath(formData, parentPath(path))
    return fn(formData, (sibling ?? {}) as Record<string, unknown>)
  } catch {
    return true
  }
}
