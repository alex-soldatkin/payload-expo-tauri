/**
 * Shared types for the custom RxDB SQLite storage.
 */

import { type SQLiteBasics, type SQLiteQueryWithParams } from 'rxdb/plugins/storage-sqlite'

import { type SQLParam } from './mango-to-sql'

/**
 * rxdb's `SQLiteQueryWithParams` types params as `(string | number | boolean)[]`,
 * but SQLite (and expo-sqlite) also accept NULL bindings — which our
 * mango-to-sql translation produces for `IS NULL`-adjacent operators.
 * Widen at our boundary and narrow back when handing to rxdb's helpers.
 */
export type SQLiteQueryWithNullableParams = Omit<SQLiteQueryWithParams, 'params'> & {
  params: (SQLParam | boolean)[]
}

export type SQLiteStorageSettings = {
  sqliteBasics: SQLiteBasics<any>
  databaseNamePrefix?: string
}

export type SQLiteInternals = {
  databasePromise: Promise<any>
}

export type SQLiteInstanceCreationOptions = Record<string, never>

export type SQLiteChangesCheckpoint = {
  id: string
  lwt: number
}
