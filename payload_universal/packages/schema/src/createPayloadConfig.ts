import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'node:path'
import { APIError, buildConfig, canAccessAdmin } from 'payload'
import type { CollectionConfig, Config } from 'payload'
import sharp from 'sharp'

import { buildAdminSchema } from '@payload-universal/admin-schema'
import { createSyncDiffEndpoint } from './endpoints/syncDiff'
import { createSyncPullEndpoint } from './endpoints/syncPull'
import { createSyncPushEndpoint } from './endpoints/syncPush'
import { SyncTombstones, createTombstoneHook } from './endpoints/syncTombstones'
import { createSyncHooks } from './endpoints/syncWebSocket'

export type PayloadUniversalConfigArgs = Omit<
  Config,
  | 'admin'
  | 'collections'
  | 'db'
  | 'editor'
  | 'endpoints'
  | 'globals'
  | 'plugins'
  | 'secret'
  | 'sharp'
  | 'typescript'
> & {
  baseDir: string
  collections: Config['collections']
  admin: Config['admin']
  globals?: Config['globals']
  endpoints?: Config['endpoints']
  plugins?: Config['plugins']
  editor?: Config['editor']
  db?: Config['db']
  secret?: Config['secret']
  sharp?: Config['sharp']
  typescript?: Config['typescript']
  includeAdminSchemaEndpoint?: boolean
  adminSchemaPath?: string
  /** Enable sync endpoints (/sync/diff, /sync/pull, /sync/push) and WS hooks. Default: true. */
  includeSyncEndpoints?: boolean
}

export const createAdminSchemaEndpoint = (
  getConfig: () => Config,
  pathOverride: string = '/admin-schema',
): NonNullable<Config['endpoints']>[number] => ({
  handler: async (req) => {
    try {
      await canAccessAdmin({ req })

      const url = new URL(req.url)
      const language =
        url.searchParams.get('language') || url.searchParams.get('lang') || req.i18n?.language

      const schema = await buildAdminSchema({
        config: getConfig(),
        importMap: req.payload.importMap,
        language: language || undefined,
      })

      return new Response(JSON.stringify(schema), {
        headers: {
          'content-type': 'application/json',
        },
      })
    } catch (err) {
      if (err instanceof APIError) {
        return new Response(JSON.stringify({ message: err.message }), {
          status: err.status || 500,
          headers: {
            'content-type': 'application/json',
          },
        })
      }

      req.payload.logger.error({ err, msg: 'Failed to build admin schema' })

      const message = err instanceof Error ? err.message : 'Failed to build admin schema'
      const body =
        process.env.NODE_ENV === 'production'
          ? { message: 'Failed to build admin schema' }
          : {
              message,
              stack: err instanceof Error ? err.stack : undefined,
            }

      return new Response(JSON.stringify(body), {
        status: 500,
        headers: {
          'content-type': 'application/json',
        },
      })
    }
  },
  method: 'get',
  path: pathOverride,
})

/**
 * Inject sync hooks (WS broadcast + tombstone on delete) into a collection config.
 */
function injectSyncHooks(collection: CollectionConfig): CollectionConfig {
  const slug = collection.slug
  const wsHooks = createSyncHooks(slug)
  const tombstoneHook = createTombstoneHook(slug)

  const existing = collection.hooks ?? {}
  return {
    ...collection,
    hooks: {
      ...existing,
      afterChange: [...(existing.afterChange ?? []), ...wsHooks.afterChange],
      afterDelete: [...(existing.afterDelete ?? []), ...wsHooks.afterDelete, tombstoneHook],
    },
  }
}

export const createRawConfig = (args: PayloadUniversalConfigArgs): Config => {
  const {
    admin,
    adminSchemaPath,
    baseDir,
    collections,
    db,
    editor,
    endpoints,
    globals,
    includeAdminSchemaEndpoint = true,
    includeSyncEndpoints = true,
    plugins,
    secret,
    sharp: sharpOverride,
    typescript,
    ...rest
  } = args

  // Inject sync hooks into all user-defined collections (skip internal ones)
  const processedCollections = includeSyncEndpoints
    ? (collections ?? []).map((col) => {
        if (typeof col === 'object' && col.slug && !col.slug.startsWith('_')) {
          return injectSyncHooks(col as CollectionConfig)
        }
        return col
      })
    : collections

  // Add the tombstone collection when sync is enabled
  const allCollections = includeSyncEndpoints
    ? [...(processedCollections ?? []), SyncTombstones]
    : processedCollections

  const config: Config = {
    ...rest,
    admin: {
      ...admin,
      importMap: {
        baseDir,
        ...(admin?.importMap || {}),
      },
    },
    collections: allCollections,
    globals: globals ?? [],
    editor: editor ?? lexicalEditor(),
    secret: secret ?? process.env.PAYLOAD_SECRET ?? '',
    typescript: {
      outputFile: path.resolve(baseDir, 'payload-types.ts'),
      ...(typescript ?? {}),
    },
    db:
      db ??
      mongooseAdapter({
        url: process.env.DATABASE_URL || '',
        allowIDOnCreate: true, // Allow mobile clients to set document IDs for sync
      }),
    endpoints: [],
    plugins: plugins ?? [],
    sharp: sharpOverride ?? sharp,
  }

  config.endpoints = [
    ...(includeAdminSchemaEndpoint ? [createAdminSchemaEndpoint(() => config, adminSchemaPath)] : []),
    ...(includeSyncEndpoints
      ? [createSyncDiffEndpoint(), createSyncPullEndpoint(), createSyncPushEndpoint()]
      : []),
    ...(endpoints ?? []),
  ]

  return config
}

export const createPayloadConfig = (args: PayloadUniversalConfigArgs): Config => {
  return buildConfig(createRawConfig(args))
}

// Re-export for consumers that need to start the WS server
export { startSyncWebSocketServer, broadcastChange, setSyncTokenVerifier } from './endpoints/syncWebSocket'
