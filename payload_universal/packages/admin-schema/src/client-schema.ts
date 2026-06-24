import type { initI18n } from '@payloadcms/translations'
import type { ClientConfig, ClientFieldSchemaMap, FieldSchemaMap, Payload } from 'payload'

import { buildClientFieldSchemaMap } from '@payload-universal/admin-core'

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
