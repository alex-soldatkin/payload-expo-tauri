/**
 * The `RxStorage` factory: the storage object RxDB consumes, plus the
 * `getRxStorageSQLite()` convenience constructor.
 */

import {
  type RxStorage,
  type RxStorageInstance,
  type RxStorageInstanceCreationParams,
  ensureRxStorageInstanceParamsAreCorrect,
  RXDB_VERSION,
} from 'rxdb'
import { RX_STORAGE_NAME_SQLITE } from 'rxdb/plugins/storage-sqlite'

import { createSQLiteStorageInstance } from './create-instance'
import type {
  SQLiteStorageSettings,
  SQLiteInternals,
  SQLiteInstanceCreationOptions,
  SQLiteChangesCheckpoint,
} from './types'

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
