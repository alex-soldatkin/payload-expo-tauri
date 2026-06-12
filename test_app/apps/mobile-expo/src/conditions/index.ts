/**
 * Client-side `admin.condition` registry — Metro-bundled condition functions
 * mirroring the SERVER config's `admin.condition` fields 1:1.
 *
 * Server condition functions cannot serialize through the admin schema JSON;
 * the schema only carries `admin.hasCondition: true` markers plus
 * `AdminSchema.conditions[slug] = [fieldPaths]`. The actual logic must be
 * re-implemented here and registered via <ConditionRegistryProvider> in
 * app/_layout.tsx (same pattern as client validators / action handlers).
 *
 * Path convention (must match AdminSchema.conditions — see
 * payload_universal/packages/admin-native/src/contexts/ConditionContext.tsx):
 *   - dot paths from the document root ('group.subField')
 *   - NAMED tab fields are prefixed with the tab name ('settings.navOrder')
 *   - block subfields are '{blocksFieldPath}.{blockSlug}.{name}'
 *     ('layout.cta.externalUrl')
 *   - array/blocks row indices are NOT part of the key (runtime paths like
 *     'layout.0.externalUrl' are normalized before lookup)
 *
 * Sources of truth (server config):
 *   - apps/server/src/collections/Events.ts
 *   - apps/server/src/collections/Pages.ts   (CTA block + settings tab)
 *   - apps/server/src/globals/SiteSettings.ts
 */
import type { ConditionRegistry } from '@payload-universal/admin-native'

export const clientConditions: ConditionRegistry = {
  // ── Events ───────────────────────────────────────────────────────────
  // Server: condition: (_data, siblingData) => Boolean(siblingData?.requiresRegistration)
  events: {
    registrationUrl: (_data, siblingData) =>
      Boolean(siblingData?.requiresRegistration),
    capacity: (_data, siblingData) =>
      Boolean(siblingData?.requiresRegistration),
  },

  // ── Pages ────────────────────────────────────────────────────────────
  // CTA block lives in the `layout` blocks field (block slug 'cta').
  // Server: condition: (_data, siblingData) => siblingData?.linkType === 'internal' | 'external'
  pages: {
    'layout.cta.internalPage': (_data, siblingData) =>
      siblingData?.linkType === 'internal',
    'layout.cta.externalUrl': (_data, siblingData) =>
      siblingData?.linkType === 'external',
    'layout.cta.openInNewTab': (_data, siblingData) =>
      siblingData?.linkType === 'external',
    // NAMED tab 'settings' — data nests under `settings.*`.
    // Server: condition: (_data, siblingData) => Boolean(siblingData?.showInNav)
    'settings.navOrder': (_data, siblingData) =>
      Boolean(siblingData?.showInNav),
  },

  // ── Site Settings (global) ───────────────────────────────────────────
  // Unnamed tabs — fields stay at the document root.
  // Server: condition: (data) => Boolean(data?.maintenanceMode)
  'site-settings': {
    maintenanceMessage: (data) => Boolean(data?.maintenanceMode),
  },
}

export default clientConditions
