import type { AcceptedLanguages } from '@payloadcms/translations'
import type { Config, ImportMap, Payload, SanitizedConfig } from 'payload'

import { initI18n } from '@payloadcms/translations'
import { buildConfig, createClientConfig } from 'payload'

import { buildClientFieldSchemaMap, buildFieldSchemaMap } from '@payload-universal/admin-core'

import type { AdminSchema, BuildAdminSchemaArgs, SerializedSchemaMap } from './types'

import { buildLocalization } from './localization'
import { applyServerFieldMarkers } from './markers'
import { buildMenuModel } from './menu-model'
import { serializeSchemaMap } from './serialization'

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
