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
 *
 * This module is the entry point; the implementation is split into:
 *   • rx-storage.ts     — the RxStorage factory + getRxStorageSQLite()
 *   • create-instance.ts — instance factory, table & index creation
 *   • instance.ts       — the RxStorageInstance (bulkWrite/query/count/…)
 *   • mango-to-sql.ts   — Mango selector/sort → SQL translation
 *   • types.ts          — shared storage types
 */

// --------------------------------------------------------- storage factory

export { RxStorageSQLite, getRxStorageSQLite } from './rx-storage'

// Re-export helpers the consumer will need
export { getSQLiteBasicsExpoSQLiteAsync } from 'rxdb/plugins/storage-sqlite'

// ------------------------------------------------------------------ types

export type { SQLiteStorageSettings } from './types'
