import type { AcceptedLanguages, I18n } from '@payloadcms/translations'
import type {
  ClientConfig,
  ClientFieldSchemaMap,
  Config,
  FieldSchemaMap,
  ImportMap,
  LabelFunction,
  Payload,
  SanitizedConfig,
  StaticLabel,
} from 'payload'

import { getTranslation, initI18n } from '@payloadcms/translations'
import { buildConfig, createClientConfig } from 'payload'

import { buildClientFieldSchemaMap, buildFieldSchemaMap } from '@payload-universal/admin-core'

export type SerializedSchemaMap<T> = Array<[string, T]>

/** A single configured locale (serializable subset of Payload's Locale). */
export type AdminLocale = {
  code: string
  label?: string | Record<string, string>
  rtl?: boolean
  fallbackLocale?: string
}

/** Top-level localization config, or `false` when localization is disabled. */
export type AdminLocalization =
  | {
      locales: AdminLocale[]
      defaultLocale: string
      fallback?: boolean
    }
  | false

export type AdminSchema = {
  clientConfig: ClientConfig
  collections: Record<string, SerializedSchemaMap<unknown>>
  /**
   * Field schema paths (keyed by collection/global slug) whose server config
   * declares an `admin.condition` function. Condition functions cannot
   * serialize — the affected client fields also carry an
   * `admin.hasCondition: true` marker so a client-side condition registry
   * can match by path and evaluate locally. Unnamed fields (row/collapsible)
   * use `_index-{n}` segments; block subfields use `{path}.{blockSlug}.{name}`.
   */
  conditions?: Record<string, string[]>
  generatedAt: string
  globals: Record<string, SerializedSchemaMap<unknown>>
  /** Localization config ({ locales, defaultLocale, fallback }) or false. */
  localization?: AdminLocalization
  menuModel: MenuModel
}

/**
 * Metadata for a native action menu item.
 * Mobile clients render these as toolbar/menu buttons.
 */
export type NativeActionMeta = {
  /** Unique key for this action within the collection. */
  key: string
  /** Human-readable label shown in the menu. */
  label: string
  /** SF Symbol name (iOS) / lucide icon name. */
  icon?: string
  /** Whether this action is destructive (renders in red). */
  destructive?: boolean
}

export type MenuModel = {
  groups: string[]
  collections: Array<{
    slug: string
    labels?: {
      singular?: string
      plural?: string
    }
    group?: string | null
    hidden?: boolean
    drafts?: boolean
    versions?: boolean
    useAsTitle?: string
    /** Lucide icon name (e.g. 'users', 'image', 'file-text') or raw SVG string. */
    icon?: string
    /** Custom action items for the collection list view (rendered in toolbar menu). */
    listActions?: NativeActionMeta[]
    /** Custom action items for the document edit view (rendered in toolbar menu). */
    editActions?: NativeActionMeta[]
  }>
  globals: Array<{
    slug: string
    label?: string
    group?: string | null
    hidden?: boolean
    drafts?: boolean
    /** Lucide icon name or raw SVG string. */
    icon?: string
  }>
  capabilities: {
    adminSchemaJson: boolean
  }
}

export type BuildAdminSchemaArgs = {
  /** Raw or already-sanitized Payload config (e.g. `req.payload.config`). */
  config: Config | SanitizedConfig
  importMap?: ImportMap
  language?: string
}

export const serializeSchemaMap = <T>(map: Map<string, T>): SerializedSchemaMap<T> => {
  return Array.from(map.entries())
}

/** Extract a serializable localization config from the sanitized config. */
const buildLocalization = (config: SanitizedConfig): AdminLocalization => {
  const localization = config.localization
  if (!localization) {
    return false
  }

  const locales: AdminLocale[] = (localization.locales ?? []).map((locale) => {
    if (typeof locale === 'string') {
      return { code: locale }
    }
    const label = (locale as { label?: unknown }).label
    return {
      code: locale.code,
      ...(label && typeof label !== 'function'
        ? { label: label as string | Record<string, string> }
        : {}),
      ...(locale.rtl ? { rtl: true } : {}),
      ...(typeof locale.fallbackLocale === 'string'
        ? { fallbackLocale: locale.fallbackLocale }
        : {}),
    }
  })

  return {
    locales,
    defaultLocale: localization.defaultLocale,
    ...(typeof (localization as { fallback?: boolean }).fallback === 'boolean'
      ? { fallback: (localization as { fallback?: boolean }).fallback }
      : {}),
  }
}

/**
 * Walks the sanitized (server) field tree in parallel with the client field
 * tree (createClientFields preserves order 1:1) and re-attaches serializable
 * metadata that `createClientConfig` strips:
 *
 * - `admin.condition` functions → `admin.hasCondition: true` marker on the
 *   client field, plus the schema path collected into `conditionPaths`.
 * - object-form `filterOptions` (Where clauses) on relationship/upload
 *   fields → copied back onto the client field (function-form stays server-only).
 *
 * Mutates the client fields in place — they are shared by reference between
 * `clientConfig` and the serialized field schema maps, so both carry markers.
 */
const applyServerFieldMarkers = ({
  clientFields,
  conditionPaths,
  parentPath,
  serverFields,
}: {
  clientFields: unknown
  conditionPaths: string[]
  parentPath: string
  serverFields: unknown
}): void => {
  if (!Array.isArray(serverFields) || !Array.isArray(clientFields)) {
    return
  }

  for (let i = 0; i < serverFields.length; i++) {
    const server = serverFields[i] as Record<string, any> | undefined
    const client = clientFields[i] as Record<string, any> | undefined
    if (!server || !client || client.type !== server.type) {
      continue
    }

    const name = typeof server.name === 'string' ? server.name : undefined
    const path = name ? (parentPath ? `${parentPath}.${name}` : name) : parentPath

    if (typeof server.admin?.condition === 'function') {
      client.admin = client.admin ?? {}
      client.admin.hasCondition = true
      conditionPaths.push(
        name ? path : parentPath ? `${parentPath}._index-${i}` : `_index-${i}`,
      )
    }

    if (
      (server.type === 'relationship' || server.type === 'upload') &&
      server.filterOptions &&
      typeof server.filterOptions === 'object'
    ) {
      client.filterOptions = server.filterOptions
    }

    if (Array.isArray(server.fields)) {
      applyServerFieldMarkers({
        clientFields: client.fields,
        conditionPaths,
        parentPath: path,
        serverFields: server.fields,
      })
    }

    if (Array.isArray(server.tabs)) {
      const clientTabs = Array.isArray(client.tabs) ? client.tabs : []
      for (let t = 0; t < server.tabs.length; t++) {
        const serverTab = server.tabs[t] as Record<string, any> | undefined
        const clientTab = clientTabs[t] as Record<string, any> | undefined
        if (!serverTab || !clientTab) {
          continue
        }
        const tabPath =
          typeof serverTab.name === 'string'
            ? path
              ? `${path}.${serverTab.name}`
              : serverTab.name
            : path
        applyServerFieldMarkers({
          clientFields: clientTab.fields,
          conditionPaths,
          parentPath: tabPath,
          serverFields: serverTab.fields,
        })
      }
    }

    if (Array.isArray(server.blocks)) {
      const clientBlocks = Array.isArray(client.blocks) ? client.blocks : []
      for (let b = 0; b < server.blocks.length; b++) {
        const serverBlock = server.blocks[b] as Record<string, any> | string | undefined
        const clientBlock = clientBlocks[b] as Record<string, any> | string | undefined
        // String entries reference the global block registry — skip (rare).
        if (
          !serverBlock ||
          typeof serverBlock === 'string' ||
          !clientBlock ||
          typeof clientBlock === 'string'
        ) {
          continue
        }
        applyServerFieldMarkers({
          clientFields: clientBlock.fields,
          conditionPaths,
          parentPath: `${path}.${serverBlock.slug}`,
          serverFields: serverBlock.fields,
        })
      }
    }
  }
}

export const deserializeSchemaMap = <T>(entries: SerializedSchemaMap<T>): Map<string, T> => {
  return new Map(entries)
}

export const buildAdminSchema = async ({
  config,
  importMap,
  language,
}: BuildAdminSchemaArgs): Promise<AdminSchema> => {
  // Detect whether the config is already sanitized (has i18n.supportedLanguages
  // or the payload-kv collection added during sanitization). If so, skip
  // re-running buildConfig to avoid issues with translation imports in
  // compiled server contexts.
  const isAlreadySanitized =
    Boolean((config as SanitizedConfig).i18n?.supportedLanguages) ||
    (Array.isArray(config.collections) &&
      config.collections.some((collection) => collection.slug === 'payload-kv') &&
      Boolean((config as SanitizedConfig).kv?.kvCollection))

  const sanitizedConfig = isAlreadySanitized
    ? (config as SanitizedConfig)
    : await buildConfig(config as Config)

  // Use the config's fallback language if none specified
  const resolvedLanguage = language || sanitizedConfig.i18n?.fallbackLanguage || 'en'
  const i18n = await initI18n({
    config: sanitizedConfig.i18n,
    context: 'api',
    // Callers may pass arbitrary language strings (e.g. from a query param);
    // initI18n falls back internally for unsupported codes.
    language: resolvedLanguage as AcceptedLanguages,
  })

  const resolvedImportMap = (importMap ?? {}) as ImportMap
  const clientConfig = createClientConfig({
    config: sanitizedConfig,
    i18n,
    importMap: resolvedImportMap,
    user: true,
  })

  const payloadStub = {
    config: sanitizedConfig,
    importMap: resolvedImportMap,
  } as Payload

  // Re-attach serializable server-only metadata (condition markers, object-form
  // filterOptions) onto the client fields BEFORE building the schema maps —
  // the maps reference the same field objects, so markers flow into both.
  const conditions: Record<string, string[]> = {}
  for (const collection of sanitizedConfig.collections) {
    const clientCollection = clientConfig.collections.find(
      (candidate) => candidate.slug === collection.slug,
    )
    if (!clientCollection) {
      continue
    }
    const conditionPaths: string[] = []
    applyServerFieldMarkers({
      clientFields: clientCollection.fields,
      conditionPaths,
      parentPath: '',
      serverFields: collection.fields,
    })
    if (conditionPaths.length) {
      conditions[collection.slug] = conditionPaths
    }
  }
  for (const global of sanitizedConfig.globals) {
    const clientGlobal = clientConfig.globals.find((candidate) => candidate.slug === global.slug)
    if (!clientGlobal) {
      continue
    }
    const conditionPaths: string[] = []
    applyServerFieldMarkers({
      clientFields: clientGlobal.fields,
      conditionPaths,
      parentPath: '',
      serverFields: global.fields,
    })
    if (conditionPaths.length) {
      conditions[global.slug] = conditionPaths
    }
  }

  const collections: Record<string, SerializedSchemaMap<unknown>> = {}
  for (const collection of sanitizedConfig.collections) {
    const { fieldSchemaMap } = buildFieldSchemaMap({
      collectionSlug: collection.slug,
      config: sanitizedConfig,
      i18n,
    })

    const { clientFieldSchemaMap } = buildClientFieldSchemaMap({
      collectionSlug: collection.slug,
      config: clientConfig,
      i18n,
      payload: payloadStub,
      schemaMap: fieldSchemaMap,
    })

    collections[collection.slug] = serializeSchemaMap(clientFieldSchemaMap)
  }

  const globals: Record<string, SerializedSchemaMap<unknown>> = {}
  for (const global of sanitizedConfig.globals) {
    const { fieldSchemaMap } = buildFieldSchemaMap({
      config: sanitizedConfig,
      globalSlug: global.slug,
      i18n,
    })

    const { clientFieldSchemaMap } = buildClientFieldSchemaMap({
      config: clientConfig,
      globalSlug: global.slug,
      i18n,
      payload: payloadStub,
      schemaMap: fieldSchemaMap,
    })

    globals[global.slug] = serializeSchemaMap(clientFieldSchemaMap)
  }

  return {
    clientConfig,
    collections,
    conditions,
    generatedAt: new Date().toISOString(),
    globals,
    localization: buildLocalization(sanitizedConfig),
    menuModel: buildMenuModel(sanitizedConfig, i18n),
  }
}

const buildMenuModel = (config: SanitizedConfig, i18n: I18n<any, any>): MenuModel => {
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

export const buildClientFieldSchemaMapForCollection = ({
  clientConfig,
  i18n,
  payload,
  schemaMap,
  slug,
}: {
  clientConfig: ClientConfig
  i18n: Awaited<ReturnType<typeof initI18n>>
  payload: Payload
  schemaMap: FieldSchemaMap
  slug: string
}): ClientFieldSchemaMap => {
  const { clientFieldSchemaMap } = buildClientFieldSchemaMap({
    collectionSlug: slug,
    config: clientConfig,
    i18n,
    payload,
    schemaMap,
  })

  return clientFieldSchemaMap
}

export const buildClientFieldSchemaMapForGlobal = ({
  clientConfig,
  i18n,
  payload,
  schemaMap,
  slug,
}: {
  clientConfig: ClientConfig
  i18n: Awaited<ReturnType<typeof initI18n>>
  payload: Payload
  schemaMap: FieldSchemaMap
  slug: string
}): ClientFieldSchemaMap => {
  const { clientFieldSchemaMap } = buildClientFieldSchemaMap({
    config: clientConfig,
    globalSlug: slug,
    i18n,
    payload,
    schemaMap,
  })

  return clientFieldSchemaMap
}
