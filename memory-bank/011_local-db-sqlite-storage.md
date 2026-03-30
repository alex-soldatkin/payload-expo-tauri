# Custom RxDB SQLite storage (2026-03-29)

## Why
RxDB's SQLite storage is split into a limited trial (free) and a premium (paid) version. The trial has hard limits: max 300 documents per collection, 110 operations per instance lifetime, no indexes (full table scan for every query), and no attachments. These are non-starters for a real mobile admin app.

Zero (Rocicorp) was evaluated as an alternative sync engine but rejected because it does not support offline writes (read-only offline), requires Postgres, and is a server-authoritative system rather than local-first.

## What we built
A custom `RxStorage` implementation at `payload_universal/packages/local-db/src/storage/` that reuses RxDB's SQLite infrastructure (connection pooling, transaction queuing, Expo SQLite adapter) but replaces the storage instance with a full implementation.

### File layout
```
packages/local-db/src/storage/
  index.ts          — RxStorageSQLite class, getRxStorageSQLite() factory, instance
  mango-to-sql.ts   — Mango query selector → SQL WHERE/ORDER BY converter
```

### Exports
```ts
// Main factory (drop-in for getRxStorageSQLiteTrial)
import { getRxStorageSQLite, getSQLiteBasicsExpoSQLiteAsync } from '@payload-universal/local-db'
// or subpath:
import { getRxStorageSQLite } from '@payload-universal/local-db/storage'
```

## Key improvements over trial

| Area | Trial | Custom |
|------|-------|--------|
| Document limit | 300 | Unlimited |
| Operation limit | 110 | None |
| query() | `SELECT data FROM table` → JS filter + JS sort + JS slice | `SELECT data WHERE ... ORDER BY ... LIMIT ? OFFSET ?` |
| findDocumentsById() | Loads all rows, filters in JS | `WHERE id IN (...)` |
| bulkWrite() | Loads all rows for conflict check | Loads only affected rows: `WHERE id IN (...)` |
| count() | Runs full query().length | `SELECT COUNT(*)` |
| Indexes | None | Expression indexes on `json_extract(data, '$.field')` |
| getChangedDocumentsSince | Not implemented | `WHERE lastWriteTime > ? ORDER BY lastWriteTime, id LIMIT ?` |

## Table schema
```sql
CREATE TABLE IF NOT EXISTS "collectionName-version" (
  id            TEXT    NOT NULL PRIMARY KEY,
  revision      TEXT    NOT NULL,
  deleted       INTEGER NOT NULL DEFAULT 0,
  lastWriteTime INTEGER NOT NULL,
  data          TEXT    NOT NULL
);

-- Always created:
CREATE INDEX IF NOT EXISTS "idx_..._del_lwt" ON "..."(deleted, lastWriteTime);

-- For each entry in schema.indexes (e.g. ['updatedAt']):
CREATE INDEX IF NOT EXISTS "idx_..._updatedAt" ON "..."(json_extract(data, '$.updatedAt'));
```

## Mango-to-SQL conversion

Supported operators (converted to SQL WHERE):
- `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`
- `$in`, `$nin`
- `$exists`
- `$and`, `$or`, `$nor`
- Direct value equality (implicit `$eq`)

Unsupported operators (JS fallback via `getQueryMatcher`):
- `$regex`, `$options`
- `$elemMatch`, `$type`, `$mod`, `$size`, `$not`

When any unsupported operator is present, the SQL query still applies all convertible conditions (to reduce the row set) then the caller runs `getQueryMatcher()` as a post-filter. LIMIT/OFFSET are applied in JS after filtering to ensure correct result counts.

## Field mapping
Special fields use dedicated columns for index efficiency:
- Primary key (e.g. `id`) → `id` column
- `_deleted` → `deleted` column (INTEGER 0/1)
- `_meta.lwt` → `lastWriteTime` column
- `_rev` → `revision` column
- All other fields → `json_extract(data, '$.fieldPath')`

## Integration
The storage plugs in at the app level in `_layout.tsx`:
```tsx
import { getRxStorageSQLite, getSQLiteBasicsExpoSQLiteAsync } from '@payload-universal/local-db'
import * as SQLite from 'expo-sqlite'

const sqliteStorage = getRxStorageSQLite({
  sqliteBasics: getSQLiteBasicsExpoSQLiteAsync(SQLite.openDatabaseSync),
})

<LocalDBProvider storage={sqliteStorage} ... />
```

The rest of the chain is transparent:
1. `LocalDBProvider` passes storage to `createLocalDB()`
2. `createLocalDB()` passes it to `createRxDatabase({ storage })`
3. RxDB calls `storage.createStorageInstance()` for each collection
4. Our instance creates the SQLite table, indexes, and handles all CRUD

Schema changes in Payload auto-propagate: Payload config → admin schema → RxDB collection schemas → SQLite tables + expression indexes.

## Optimistic write path (2026-03-29)

The mobile app now uses a fully local-first write path:

```
User taps Save
  → useLocalMutations.create() or .update()
  → RxDB insert/patch (instant, <10ms)
  → UI updates reactively via useLocalDocument/useLocalCollection
  → Replication push handler fires in background
  → POST/PATCH /api/{slug} to Payload server
  → Server response reconciled on next pull cycle
```

### useLocalMutations hook
Exported from `@payload-universal/local-db`:
```ts
const { create, update, remove } = useLocalMutations(localDB, slug)

// Create — generates 24-char hex ID (MongoDB ObjectId compatible), inserts into RxDB
const id = await create({ title: 'New Post', status: 'draft' })

// Update — patches local doc, replication pushes PATCH to server
await update(id, { title: 'Updated Title' })

// Remove — soft-deletes locally, replication pushes DELETE to server
await remove(id)
```

### Key decisions
- Client generates IDs (not the server) so local insert is fully synchronous
- IDs are 24-char random hex strings matching MongoDB ObjectId format
- `RxDBDevModePlugin` removed — it requires a storage validator wrapper (`wrappedValidateAjvStorage`) which adds overhead and blocks DB init with DVM1 error; our permissive schemas (`{}` for all fields) make validation meaningless
- Replication push handler strips RxDB internals (`_rev`, `_meta`, `_attachments`, `_deleted`) before sending to Payload REST API
- Screen files (`create.tsx`, `[id].tsx`) no longer call `payloadApi.create()`/`payloadApi.update()` — all writes go through local RxDB

## Push replication: ID mismatch fix (2026-03-30)
Client-generated IDs (24-char hex) differ from Payload's MongoDB ObjectIds. On POST, Payload assigns its own `_id`. The push handler now:
1. Strips client `id` from POST body
2. After success: removes local doc with client ID, upserts with server-assigned ID
3. Prevents infinite duplication loop (pull sees mismatch → inserts → push creates → repeat)

This caused 65,000+ duplicate documents before the fix was applied.

## Dependencies
Reuses from `rxdb/plugins/storage-sqlite` (not reimplemented):
- `getDatabaseConnection` / `closeDatabaseConnection` — connection pooling
- `sqliteTransaction` / `TX_QUEUE_BY_DATABASE` — serialised transaction queue
- `getSQLiteInsertSQL` / `getSQLiteUpdateSQL` — INSERT/UPDATE SQL builders
- `getDataFromResultRow` — extract JSON from result rows
- `getSQLiteBasicsExpoSQLiteAsync` — Expo SQLite adapter
- `addRxStorageMultiInstanceSupport` — multi-instance change propagation

Reuses from `rxdb`:
- `categorizeBulkWriteRows` — conflict detection + change event generation
- `getQueryMatcher` — JS fallback filter for unsupported Mango operators
- `RXDB_VERSION` — version compatibility check
