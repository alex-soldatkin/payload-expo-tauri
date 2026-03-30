import type {
  ClientConfig,
  ClientFieldSchemaMap,
  Config,
  FieldSchemaMap,
  ImportMap,
  Payload,
  SanitizedConfig,
} from 'payload'

import { initI18n } from '@payloadcms/translations'
import { buildConfig, createClientConfig } from 'payload'

import { buildClientFieldSchemaMap, buildFieldSchemaMap } from '@payload-universal/admin-core'

export type SerializedSchemaMap<T> = Array<[string, T]>

export type AdminSchema = {
  clientConfig: ClientConfig
  collections: Record<string, SerializedSchemaMap<unknown>>
  generatedAt: string
  globals: Record<string, SerializedSchemaMap<unknown>>
  menuModel: MenuModel
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
  }>
  globals: Array<{
    slug: string
    label?: string
    group?: string | null
    hidden?: boolean
    drafts?: boolean
  }>
  capabilities: {
    adminSchemaJson: boolean
  }
}

export type BuildAdminSchemaArgs = {
  config: Config
  importMap?: ImportMap
  language?: string
}

export const serializeSchemaMap = <T>(map: Map<string, T>): SerializedSchemaMap<T> => {
  return Array.from(map.entries())
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
    : await buildConfig(config)

  // Use the config's fallback language if none specified
  const resolvedLanguage = language || sanitizedConfig.i18n?.fallbackLanguage || 'en'
  const i18n = await initI18n({
    config: sanitizedConfig.i18n,
    context: 'api',
    language: resolvedLanguage,
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
    generatedAt: new Date().toISOString(),
    globals,
    menuModel: buildMenuModel(sanitizedConfig),
  }
}

const buildMenuModel = (config: Config): MenuModel => {
  const groups = new Set<string>()

  const normalizeGroup = (group: unknown): string | null => {
    if (typeof group === 'string') {
      const trimmed = group.trim()
      return trimmed.length > 0 ? trimmed : null
    }
    return null
  }

  const collections = config.collections.map((collection) => {
    const group = normalizeGroup(collection.admin?.group)
    if (group) {
      groups.add(group)
    }

    return {
      slug: collection.slug,
      labels: collection.labels,
      group,
      hidden: collection.admin?.hidden,
      drafts: Boolean(collection.versions?.drafts),
      versions: Boolean(collection.versions),
      useAsTitle: collection.admin?.useAsTitle,
    }
  })

  const globals = (config.globals ?? []).map((global) => {
    const group = normalizeGroup(global.admin?.group)
    if (group) {
      groups.add(group)
    }

    return {
      slug: global.slug,
      label: global.label,
      group,
      hidden: global.admin?.hidden,
      drafts: Boolean(global.versions?.drafts),
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
