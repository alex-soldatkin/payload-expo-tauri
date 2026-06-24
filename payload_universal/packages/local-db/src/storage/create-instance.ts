/**
 * Private instance factory: opens the database connection, creates the
 * collection table and its indexes (built-in + schema-declared expression
 * indexes on json_extract), then wires up multi-instance support.
 */

import {
  type RxStorageInstanceCreationParams,
  getPrimaryFieldOfPrimaryKey,
  addRxStorageMultiInstanceSupport,
} from 'rxdb'
import {
  getDatabaseConnection,
  sqliteTransaction,
  RX_STORAGE_NAME_SQLITE,
} from 'rxdb/plugins/storage-sqlite'

import { RxStorageInstanceSQLite } from './instance'
import type { RxStorageSQLite } from './rx-storage'
import type {
  SQLiteStorageSettings,
  SQLiteInternals,
  SQLiteInstanceCreationOptions,
} from './types'

export async function createSQLiteStorageInstance<RxDocType>(
  storage: RxStorageSQLite,
  params: RxStorageInstanceCreationParams<RxDocType, SQLiteInstanceCreationOptions>,
  settings: SQLiteStorageSettings,
): Promise<RxStorageInstanceSQLite<RxDocType>> {
  const sqliteBasics = settings.sqliteBasics
  const tableName = params.collectionName + '-' + params.schema.version
  const useDatabaseName = (settings.databaseNamePrefix ?? '') + params.databaseName
  const primaryPath = getPrimaryFieldOfPrimaryKey(params.schema.primaryKey) as string

  const internals: SQLiteInternals = {
    databasePromise: getDatabaseConnection(sqliteBasics, useDatabaseName).then(
      async (database: any) => {
        await sqliteTransaction(
          database,
          sqliteBasics,
          async () => {
            // ---- main table ----
            await sqliteBasics.run(database, {
              query: `
                CREATE TABLE IF NOT EXISTS "${tableName}" (
                  id            TEXT    NOT NULL PRIMARY KEY,
                  revision      TEXT    NOT NULL,
                  deleted       INTEGER NOT NULL DEFAULT 0,
                  lastWriteTime INTEGER NOT NULL,
                  data          TEXT    NOT NULL
                )
              `,
              params: [],
              context: {
                method: 'createStorageInstance.createTable',
                data: params.databaseName,
              },
            })

            // ---- built-in indexes ----

            // Compound (deleted, lastWriteTime) — covers most queries and cleanup
            await sqliteBasics.run(database, {
              query: `CREATE INDEX IF NOT EXISTS "idx_${tableName}_del_lwt"
                      ON "${tableName}"(deleted, lastWriteTime)`,
              params: [],
              context: { method: 'createStorageInstance.idx', data: 'del_lwt' },
            })

            // ---- schema-declared indexes (expression indexes on json_extract) ----

            const schemaIndexes: (string | string[])[] =
              (params.schema as any).indexes ?? []

            for (const def of schemaIndexes) {
              const fields = Array.isArray(def) ? def : [def]
              const safeName = fields.join('_').replace(/\./g, '_')
              const indexName = `idx_${tableName}_${safeName}`

              const exprs = fields.map((f) => {
                if (f === primaryPath || f === 'id') return 'id'
                if (f === '_deleted') return 'deleted'
                if (f === '_meta.lwt') return 'lastWriteTime'
                return `json_extract(data, '$.${f}')`
              })

              await sqliteBasics.run(database, {
                query: `CREATE INDEX IF NOT EXISTS "${indexName}"
                        ON "${tableName}"(${exprs.join(', ')})`,
                params: [],
                context: { method: 'createStorageInstance.idx', data: indexName },
              })
            }

            return 'COMMIT'
          },
          {
            indexCreation: true,
            databaseName: params.databaseName,
            collectionName: params.collectionName,
          },
        )

        return database
      },
    ),
  }

  const instance = new RxStorageInstanceSQLite<RxDocType>(
    storage,
    params.databaseName,
    params.collectionName,
    params.schema,
    internals,
    params.options,
    settings,
    tableName,
    params.devMode,
  )

  await addRxStorageMultiInstanceSupport(RX_STORAGE_NAME_SQLITE, params, instance as any)
  return instance
}
