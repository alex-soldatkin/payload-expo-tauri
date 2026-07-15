import type { I18n } from '@payloadcms/translations'
import type { LabelFunction, SanitizedConfig, StaticLabel } from 'payload'

import { getTranslation } from '@payloadcms/translations'

import type { MenuModel, NativeActionMeta } from './types'

export const buildMenuModel = (config: SanitizedConfig, i18n: I18n<any, any>): MenuModel => {
  const groups = new Set<string>()

  const normalizeGroup = (group: unknown): string | null => {
    if (typeof group === 'string') {
      const trimmed = group.trim()
      return trimmed.length > 0 ? trimmed : null
    }
    return null
  }

  /** Resolve a label (string / i18n record / label function) to a plain string. */
  const normalizeLabel = (
    label: LabelFunction | StaticLabel | undefined,
  ): string | undefined => {
    if (label == null) {
      return undefined
    }
    const resolved = getTranslation(label, i18n)
    return typeof resolved === 'string' && resolved.length > 0 ? resolved : undefined
  }

  /** `admin.hidden` functions need a user to evaluate — only booleans serialize. */
  const normalizeHidden = (hidden: unknown): boolean | undefined =>
    typeof hidden === 'boolean' ? hidden : undefined

  const collections = config.collections.map((collection) => {
    const group = normalizeGroup(collection.admin?.group)
    if (group) {
      groups.add(group)
    }

    // Extensions added by payload-universal — read safely via cast.
    const adminExt = collection.admin as Record<string, unknown> | undefined
    const icon = adminExt?.icon as string | undefined
    const listActions = adminExt?.listActions as NativeActionMeta[] | undefined
    const editActions = adminExt?.editActions as NativeActionMeta[] | undefined

    return {
      slug: collection.slug,
      labels: collection.labels
        ? {
            singular: normalizeLabel(collection.labels.singular),
            plural: normalizeLabel(collection.labels.plural),
          }
        : undefined,
      group,
      hidden: normalizeHidden(collection.admin?.hidden),
      drafts: Boolean(collection.versions?.drafts),
      versions: Boolean(collection.versions),
      useAsTitle: collection.admin?.useAsTitle,
      // Drives the desktop list's default column set (falls back client-side).
      defaultColumns: collection.admin?.defaultColumns,
      ...(icon ? { icon } : {}),
      ...(listActions?.length ? { listActions } : {}),
      ...(editActions?.length ? { editActions } : {}),
    }
  })

  const globals = (config.globals ?? []).map((global) => {
    const group = normalizeGroup(global.admin?.group)
    if (group) {
      groups.add(group)
    }

    const icon = (global.admin as Record<string, unknown> | undefined)?.icon as
      | string
      | undefined

    return {
      slug: global.slug,
      label: normalizeLabel(global.label),
      group,
      hidden: normalizeHidden(global.admin?.hidden),
      drafts: Boolean(global.versions?.drafts),
      ...(icon ? { icon } : {}),
    }
  })

  return {
    groups: Array.from(groups).sort((a, b) => a.localeCompare(b)),
    collections,
    globals,
    capabilities: {
      adminSchemaJson: true,
    },
  }
}
