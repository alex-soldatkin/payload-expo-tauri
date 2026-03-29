/**
 * Custom RxDB SQLite storage — full implementation (no trial limits).
 *
 * Drop-in replacement for `getRxStorageSQLiteTrial()` that adds:
 *   • No document or operation limits
 *   • SQL-level WHERE filtering (uses indexes)
 *   • SQL-level ORDER BY / LIMIT / OFFSET
 *   • Expression indexes on every schema-declared index field
 *   • Efficient bulkWrite (loads only affected docs, not the full table)
 *   • Optional getChangedDocumentsSince() for fast replication
 *
 * Usage in _layout.tsx:
 * ```ts
 * import { getRxStorageSQLite } from '@payload-universal/local-db/storage'
 * import { getSQLiteBasicsExpoSQLiteAsync } from 'rxdb/plugins/storage-sqlite'
 * import * as SQLite from 'expo-sqlite'
 *
 * const storage = getRxStorageSQLite({
 *   sqliteBasics: getSQLiteBasicsExpoSQLiteAsync(SQLite.openDatabaseSync),
 * })
 * ```
 */

import {
  type RxStorage,
  type RxStorageInstance,
  type RxStorageInstanceCreationParams,
  type BulkWriteRow,
  type RxStorageBulkWriteResponse,
  type PreparedQuery,
  type RxStorageQueryResult,
  type RxStorageCountResult,
  type RxDocumentData,
  type EventBulk,
  type RxStorageChangeEvent,
  type RxJsonSchema,
  type StringKeys,
  categorizeBulkWriteRows,
  ensureRxStorageInstanceParamsAreCorrect,
  getPrimaryFieldOfPrimaryKey,
  addRxStorageMultiInstanceSupport,
  getQueryMatcher,
  ensureNotFalsy,
  promiseWait,
  RXDB_VERSION,
} from 'rxdb'
import { BehaviorSubject, Subject, filter, firstValueFrom } from 'rxjs'
import {
  getDatabaseConnection,
  closeDatabaseConnection,
  sqliteTransaction,
  getSQLiteInsertSQL,
  getSQLiteUpdateSQL,
  RX_STORAGE_NAME_SQLITE,
  TX_QUEUE_BY_DATABASE,
  getDataFromResultRow,
  ensureParamsCountIsCorrect,
  type SQLiteBasics,
  type SQLiteQueryWithParams,
} from 'rxdb/plugins/storage-sqlite'

import { mangoSelectorToSQL, mangoSortToSQL, fieldToSQL } from './mango-to-sql'

// ------------------------------------------------------------------ types

export type SQLiteStorageSettings = {
  sqliteBasics: SQLiteBasics<any>
  databaseNamePrefix?: string
}

type SQLiteInternals = {
  databasePromise: Promise<any>
}

type SQLiteInstanceCreationOptions = Record<string, never>

type SQLiteChangesCheckpoint = {
  id: string
  lwt: number
}

// --------------------------------------------------------- storage factory

export class RxStorageSQLite
  implements RxStorage<SQLiteInternals, SQLiteInstanceCreationOptions>
{
  public readonly name = RX_STORAGE_NAME_SQLITE
  public readonly rxdbVersion = RXDB_VERSION

  constructor(public readonly settings: SQLiteStorageSettings) {}

  createStorageInstance<RxDocType>(
    params: RxStorageInstanceCreationParams<RxDocType, SQLiteInstanceCreationOptions>,
  ): Promise<
    RxStorageInstance<
      RxDocType,
      SQLiteInternals,
      SQLiteInstanceCreationOptions,
      SQLiteChangesCheckpoint
    >
  > {
    ensureRxStorageInstanceParamsAreCorrect(params)
    return createSQLiteStorageInstance<RxDocType>(this, params, this.settings)
  }
}

/** Drop-in replacement for `getRxStorageSQLiteTrial()`. */
export function getRxStorageSQLite(settings: SQLiteStorageSettings): RxStorageSQLite {
  return new RxStorageSQLite(settings)
}

// Re-export helpers the consumer will need
export { getSQLiteBasicsExpoSQLiteAsync } from 'rxdb/plugins/storage-sqlite'

// ------------------------------------------------------- storage instance

class RxStorageInstanceSQLite<RxDocType> {
  public readonly changes$ = new Subject<
    EventBulk<RxStorageChangeEvent<RxDocType>, SQLiteChangesCheckpoint>
  >()
  public readonly openWriteCount$ = new BehaviorSubject<number>(0)
  public readonly primaryPath: StringKeys<RxDocType>
  public readonly sqliteBasics: SQLiteBasics<any>
  private closed?: Promise<void>

  constructor(
    public readonly storage: RxStorageSQLite,
    public readonly databaseName: string,
    public readonly collectionName: string,
    public readonly schema: Readonly<RxJsonSchema<RxDocumentData<RxDocType>>>,
    public readonly internals: SQLiteInternals,
    public readonly options: Readonly<SQLiteInstanceCreationOptions>,
    public readonly settings: SQLiteStorageSettings,
    public readonly tableName: string,
    public readonly devMode: boolean,
  ) {
    this.sqliteBasics = storage.settings.sqliteBasics
    this.primaryPath = getPrimaryFieldOfPrimaryKey(this.schema.primaryKey) as any
  }

  // ---- low-level SQL helpers ----

  private run(db: any, q: SQLiteQueryWithParams): Promise<void> {
    if (this.devMode) ensureParamsCountIsCorrect(q)
    return this.sqliteBasics.run(db, q)
  }

  private all(db: any, q: SQLiteQueryWithParams): Promise<any[]> {
    if (this.devMode) ensureParamsCountIsCorrect(q)
    return this.sqliteBasics.all(db, q)
  }

  // ---- bulkWrite ----

  async bulkWrite(
    documentWrites: BulkWriteRow<RxDocType>[],
    context: string,
  ): Promise<RxStorageBulkWriteResponse<RxDocType>> {
    this.openWriteCount$.next(this.openWriteCount$.getValue() + 1)
    const database = await this.internals.databasePromise
    const ret: RxStorageBulkWriteResponse<RxDocType> = { error: [] }
    let categorized: any = {}

    await sqliteTransaction(
      database,
      this.sqliteBasics,
      async () => {
        if (this.closed) {
          this.openWriteCount$.next(this.openWriteCount$.getValue() - 1)
          throw new Error(`SQLite.bulkWrite(${context}) already closed ${this.tableName}`)
        }

        // Only fetch the documents being written — not the whole table.
        const ids = documentWrites.map(
          (w) => (w.document as any)[this.primaryPath] as string,
        )
        const placeholders = ids.map(() => '?').join(', ')
        const result = await this.all(database, {
          query: `SELECT data FROM "${this.tableName}" WHERE id IN (${placeholders})`,
          params: ids,
          context: { method: 'bulkWrite.select', data: documentWrites },
        })

        const docsInDb = new Map<string, RxDocumentData<RxDocType>>()
        result.forEach((row: any) => {
          const doc = JSON.parse(getDataFromResultRow(row))
          docsInDb.set(doc[this.primaryPath], doc)
        })

        categorized = categorizeBulkWriteRows(
          this as any,
          this.primaryPath,
          docsInDb,
          documentWrites,
          context,
        )
        ret.error = categorized.errors

        const ops: Promise<any>[] = []

        categorized.bulkInsertDocs.forEach((row: any) => {
          const q = getSQLiteInsertSQL(
            this.tableName,
            this.primaryPath as any,
            row.document,
          )
          ops.push(
            this.all(database, {
              query: q.query,
              params: q.params,
              context: { method: 'bulkWrite.insert', data: categorized },
            }),
          )
        })

        categorized.bulkUpdateDocs.forEach((row: any) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const q = (getSQLiteUpdateSQL as any)(this.tableName, this.primaryPath, row)
          ops.push(this.run(database, q))
        })

        await Promise.all(ops)

        this.openWriteCount$.next(this.openWriteCount$.getValue() - 1)
        return this.closed ? 'ROLLBACK' : 'COMMIT'
      },
      { databaseName: this.databaseName, collectionName: this.collectionName },
    )

    if (categorized?.eventBulk?.events?.length > 0) {
      const lastState = ensureNotFalsy(categorized.newestRow).document
      categorized.eventBulk.checkpoint = {
        id: lastState[this.primaryPath],
        lwt: lastState._meta.lwt,
      }
      this.changes$.next(categorized.eventBulk)
    }

    return ret
  }

  // ---- findDocumentsById ----

  async findDocumentsById(
    ids: string[],
    withDeleted: boolean,
  ): Promise<RxDocumentData<RxDocType>[]> {
    if (ids.length === 0) return []
    const database = await this.internals.databasePromise
    if (this.closed) {
      throw new Error('SQLite.findDocumentsById() already closed: ' + this.tableName)
    }

    const placeholders = ids.map(() => '?').join(', ')
    const deletedFilter = withDeleted ? '' : ' AND deleted = 0'

    const result = await this.all(database, {
      query: `SELECT data FROM "${this.tableName}" WHERE id IN (${placeholders})${deletedFilter}`,
      params: ids,
      context: { method: 'findDocumentsById', data: ids },
    })

    return result.map((row: any) => JSON.parse(getDataFromResultRow(row)))
  }

  // ---- query ----

  async query(
    preparedQuery: PreparedQuery<RxDocType>,
  ): Promise<RxStorageQueryResult<RxDocType>> {
    const database = await this.internals.databasePromise
    const q = preparedQuery.query
    const skip = q.skip || 0
    const limit = q.limit ?? Infinity

    // Convert selector → SQL WHERE
    const { where, params, needsPostFilter } = mangoSelectorToSQL(
      q.selector as any,
      this.primaryPath as string,
    )

    // Convert sort → SQL ORDER BY
    const orderBy = mangoSortToSQL(q.sort as any, this.primaryPath as string)

    // Assemble SQL
    let sql = `SELECT data FROM "${this.tableName}"`
    const sqlParams: (string | number | null)[] = [...params]

    if (where) sql += ` WHERE ${where}`
    if (orderBy) sql += ` ORDER BY ${orderBy}`

    // Apply LIMIT/OFFSET at the SQL level when no JS post-filter is needed.
    if (!needsPostFilter) {
      if (limit !== Infinity) {
        if (skip > 0) {
          sql += ' LIMIT ? OFFSET ?'
          sqlParams.push(limit, skip)
        } else {
          sql += ' LIMIT ?'
          sqlParams.push(limit)
        }
      } else if (skip > 0) {
        // SQLite requires LIMIT for OFFSET to work; -1 means no limit.
        sql += ' LIMIT -1 OFFSET ?'
        sqlParams.push(skip)
      }
    }

    const result = await this.all(database, {
      query: sql,
      params: sqlParams,
      context: { method: 'query', data: preparedQuery },
    })

    let docs: RxDocumentData<RxDocType>[] = result.map((row: any) =>
      JSON.parse(getDataFromResultRow(row)),
    )

    // When the SQL couldn't fully express the selector, do a JS pass.
    if (needsPostFilter) {
      const matcher = getQueryMatcher(this.schema, q as any)
      docs = docs.filter((d) => matcher(d))
      docs = docs.slice(skip, limit === Infinity ? undefined : skip + limit)
    }

    return { documents: docs }
  }

  // ---- count ----

  async count(
    preparedQuery: PreparedQuery<RxDocType>,
  ): Promise<RxStorageCountResult> {
    const database = await this.internals.databasePromise
    const { where, params, needsPostFilter } = mangoSelectorToSQL(
      preparedQuery.query.selector as any,
      this.primaryPath as string,
    )

    if (needsPostFilter) {
      // Fallback: run the full query and count in JS.
      const r = await this.query(preparedQuery)
      return { count: r.documents.length, mode: 'slow' }
    }

    let sql = `SELECT COUNT(*) as cnt FROM "${this.tableName}"`
    if (where) sql += ` WHERE ${where}`

    const result = await this.all(database, {
      query: sql,
      params,
      context: { method: 'count', data: preparedQuery },
    })

    return { count: result[0]?.cnt ?? 0, mode: 'fast' }
  }

  // ---- getChangedDocumentsSince (optional replication optimisation) ----

  async getChangedDocumentsSince(
    limit: number,
    checkpoint?: SQLiteChangesCheckpoint,
  ): Promise<{
    documents: RxDocumentData<RxDocType>[]
    checkpoint: SQLiteChangesCheckpoint
  }> {
    const database = await this.internals.databasePromise
    let sql: string
    let params: (string | number)[]

    if (checkpoint) {
      sql =
        `SELECT data FROM "${this.tableName}" ` +
        'WHERE (lastWriteTime > ?) OR (lastWriteTime = ? AND id > ?) ' +
        'ORDER BY lastWriteTime ASC, id ASC LIMIT ?'
      params = [checkpoint.lwt, checkpoint.lwt, checkpoint.id, limit]
    } else {
      sql =
        `SELECT data FROM "${this.tableName}" ` +
        'ORDER BY lastWriteTime ASC, id ASC LIMIT ?'
      params = [limit]
    }

    const result = await this.all(database, {
      query: sql,
      params,
      context: { method: 'getChangedDocumentsSince', data: { limit, checkpoint } },
    })

    const documents: RxDocumentData<RxDocType>[] = result.map((row: any) =>
      JSON.parse(getDataFromResultRow(row)),
    )

    const last = documents.length > 0 ? documents[documents.length - 1] : undefined
    const newCheckpoint: SQLiteChangesCheckpoint = last
      ? { id: (last as any)[this.primaryPath], lwt: last._meta.lwt }
      : checkpoint ?? { id: '', lwt: 0 }

    return { documents, checkpoint: newCheckpoint }
  }

  // ---- getAttachmentData ----

  async getAttachmentData(
    _documentId: string,
    _attachmentId: string,
    _digest: string,
  ): Promise<string> {
    throw new Error('Attachments are not supported by this SQLite storage.')
  }

  // ---- changeStream ----

  changeStream() {
    return this.changes$.asObservable()
  }

  // ---- cleanup ----

  async cleanup(minimumDeletedTime: number): Promise<boolean> {
    await promiseWait(0)
    const database = await this.internals.databasePromise
    const minTs = Date.now() - minimumDeletedTime

    await this.run(database, {
      query: `DELETE FROM "${this.tableName}" WHERE deleted = 1 AND lastWriteTime < ?`,
      params: [minTs],
      context: { method: 'cleanup', data: minimumDeletedTime },
    })

    return true
  }

  // ---- close ----

  async close(): Promise<void> {
    const queue = TX_QUEUE_BY_DATABASE.get(await this.internals.databasePromise)
    if (queue) await queue
    if (this.closed) return this.closed

    this.closed = (async () => {
      await firstValueFrom(this.openWriteCount$.pipe(filter((v) => v === 0)))
      const database = await this.internals.databasePromise

      // Drain any in-flight transaction before closing
      await sqliteTransaction(database, this.sqliteBasics, () =>
        Promise.resolve('COMMIT' as const),
      ).catch(() => {})

      this.changes$.complete()
      await closeDatabaseConnection(this.databaseName, this.storage.settings.sqliteBasics)
    })()

    return this.closed
  }

  // ---- remove ----

  async remove(): Promise<void> {
    if (this.closed) throw new Error('already closed')
    const database = await this.internals.databasePromise

    await this.run(database, {
      query: `DROP TABLE IF EXISTS "${this.tableName}"`,
      params: [],
      context: { method: 'remove', data: this.tableName },
    })

    return this.close()
  }
}

// ------------------------------------------------- instance factory (private)

async function createSQLiteStorageInstance<RxDocType>(
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
