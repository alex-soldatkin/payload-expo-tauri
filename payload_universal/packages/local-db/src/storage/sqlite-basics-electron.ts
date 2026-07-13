/**
 * SQLiteBasics driver for Electron renderers.
 *
 * Mirrors rxdb's getSQLiteBasicsTauri: the renderer never touches SQLite
 * directly — every call is forwarded over IPC to the Electron main process,
 * where the real database lives (node:sqlite or better-sqlite3, files under
 * app.getPath('userData')).
 *
 * The bridge object is injected by the app (exposed via contextBridge in the
 * preload script), so this module has no dependency on electron itself.
 *
 * Usage in the renderer:
 * ```ts
 * const storage = getRxStorageSQLite({
 *   sqliteBasics: getSQLiteBasicsElectronIPC(window.payloadSqlite),
 * })
 * ```
 */
import type { SQLiteBasics } from 'rxdb/plugins/storage-sqlite'

/**
 * The surface the preload script must expose. Database handles cannot cross
 * IPC, so open() returns an opaque dbId that all other calls reference.
 */
export type ElectronSqliteBridge = {
  open(name: string): Promise<string>
  all(dbId: string, sql: string, params: unknown[]): Promise<any[]>
  run(dbId: string, sql: string, params: unknown[]): Promise<void>
  setPragma(dbId: string, key: string, value: string): Promise<void>
  close(dbId: string): Promise<void>
}

/**
 * The database handle must be an OBJECT, not the raw dbId string: rxdb's
 * sqliteTransaction serialises writes through TX_QUEUE_BY_DATABASE, a WeakMap
 * keyed by this handle — primitives throw "Invalid value used as weak map key".
 */
export type ElectronDbHandle = { readonly id: string }

export function getSQLiteBasicsElectronIPC(
  bridge: ElectronSqliteBridge,
): SQLiteBasics<ElectronDbHandle> {
  return {
    debugId: 'electron-ipc',
    open: async (name) => ({ id: await bridge.open(name) }),
    all: (db, queryWithParams) => bridge.all(db.id, queryWithParams.query, queryWithParams.params),
    run: async (db, queryWithParams) => {
      await bridge.run(db.id, queryWithParams.query, queryWithParams.params)
    },
    setPragma: (db, key, value) => bridge.setPragma(db.id, key, value),
    close: (db) => bridge.close(db.id),
    // node:sqlite / better-sqlite3 support plain WAL; WAL2 is a fork-only feature.
    journalMode: 'WAL',
  }
}
