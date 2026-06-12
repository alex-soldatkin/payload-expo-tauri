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
import { type RxStorage, type RxStorageInstance, type RxStorageInstanceCreationParams } from 'rxdb';
import { type SQLiteBasics } from 'rxdb/plugins/storage-sqlite';
export type SQLiteStorageSettings = {
    sqliteBasics: SQLiteBasics<any>;
    databaseNamePrefix?: string;
};
type SQLiteInternals = {
    databasePromise: Promise<any>;
};
type SQLiteInstanceCreationOptions = Record<string, never>;
type SQLiteChangesCheckpoint = {
    id: string;
    lwt: number;
};
export declare class RxStorageSQLite implements RxStorage<SQLiteInternals, SQLiteInstanceCreationOptions> {
    readonly settings: SQLiteStorageSettings;
    readonly name = "sqlite";
    readonly rxdbVersion = "16.21.1";
    constructor(settings: SQLiteStorageSettings);
    createStorageInstance<RxDocType>(params: RxStorageInstanceCreationParams<RxDocType, SQLiteInstanceCreationOptions>): Promise<RxStorageInstance<RxDocType, SQLiteInternals, SQLiteInstanceCreationOptions, SQLiteChangesCheckpoint>>;
}
/** Drop-in replacement for `getRxStorageSQLiteTrial()`. */
export declare function getRxStorageSQLite(settings: SQLiteStorageSettings): RxStorageSQLite;
export { getSQLiteBasicsExpoSQLiteAsync } from 'rxdb/plugins/storage-sqlite';
