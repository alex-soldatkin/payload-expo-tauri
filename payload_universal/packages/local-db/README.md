# @payload-universal/local-db

Local-first data layer for Payload Universal clients: RxDB with a custom
full-featured SQLite storage (no trial limits), HTTP replication against the
Payload REST API, an optional WebSocket channel for real-time pulls, an offline
mutation queue (`_locallyModified`), and an upload outbox.

Architecture docs: `memory-bank/011` (storage), `012` (WebSocket sync),
`015` (Electron desktop).

## Platform drivers

The package is platform-neutral. The only per-platform piece is RxDB's
`SQLiteBasics` driver injected into the storage factory:

```ts
import { getRxStorageSQLite } from '@payload-universal/local-db'
```

**Expo / React Native**

```ts
import { getSQLiteBasicsExpoSQLiteAsync } from '@payload-universal/local-db'
import * as SQLite from 'expo-sqlite'

const storage = getRxStorageSQLite({
  sqliteBasics: getSQLiteBasicsExpoSQLiteAsync(SQLite.openDatabaseSync),
})
```

Hermes lacks WebCrypto — import the polyfill once in the app entry, before any
local-db/rxdb code loads:

```ts
import '@payload-universal/local-db/polyfills/hermesCrypto'
```

**Electron** (SQL over IPC to the main process — see
`test_app/apps/desktop-electron` for the main-process host + preload bridge)

```ts
import { getSQLiteBasicsElectronIPC } from '@payload-universal/local-db'

const storage = getRxStorageSQLite({
  sqliteBasics: getSQLiteBasicsElectronIPC(window.payloadSqlite),
  databaseNamePrefix: `${serverSlug}__`, // per-server data isolation
})
```

No polyfill needed (Electron renderers have full WebCrypto). The expo peer
dependencies are optional; non-Expo bundlers must alias
`expo-file-system/legacy` to a stub if the upload queue is unused (Vite example
in `desktop-electron/vite.config.mjs`).

## Wiring

```tsx
<LocalDBProvider
  schema={adminSchema}          // from fetchAdminSchema()
  baseURL="https://my-payload"  // REST root
  wsURL="wss://my-payload/ws"   // optional: enables real-time pulls
  token={jwt}
  storage={storage}
>
```

Hooks: `useLocalCollection`, `useLocalDocument`, `useLocalQuery`,
`useLocalMutations`, `useLocalDBStatus`, `usePendingUploads`.

## Conflict semantics

Document-level: while a doc carries an unpushed local edit
(`_locallyModified: true`), the local version wins every conflict and is pushed
on reconnect — offline edits are never silently dropped. Otherwise the server
state wins. Field-level three-way merge exists server-side (`/sync/push`) but is
not yet wired into the client push path (issue #8).
