# Progress log

This log captures what has been implemented so far and the current state of the test apps.

## Completed milestones

### Phase 1 — Foundation (2026-02-05)
- Created `payload_universal` and `test_app` monorepos with shared packages and test clients.
- Added `@payload-universal/admin-core` with schema map helpers.
- Added `@payload-universal/admin-schema` with `buildAdminSchema` and `fetchAdminSchema` client helper.
- Added `@payload-universal/schema` config builder (`createPayloadConfig`) and admin schema endpoint helper.
- Server exposes `GET /api/admin-schema` for authenticated admins.
- Added `menuModel` to the admin schema and wired a Tauri menu bridge to render native menus.
- Test apps:
  - `apps/server` (Next + Payload) running admin at `http://127.0.0.1:3000/admin`.
  - `apps/web` static preview app.
  - `apps/web-next` schema preview page.
  - `apps/mobile-expo` schema preview (NativeWind).
- `apps/desktop-tauri` wraps the Next admin (Tauri) and now loads the real admin UI.
- Native Tauri menu now auto-generates from the admin schema.
- Replaced the admin sidebar with a client `NativeNav` component that reuses Payload’s nav SCSS, honors `admin.group` via `groupNavItems`, and persists group open state via nav preferences.

### Phase 2 — Local-first mobile DB + repo setup (2026-03-29)
- **Repo published** to `https://github.com/alex-soldatkin/payload-expo-tauri.git`.
- Comprehensive `.gitignore` configured (node_modules, .next, target, Pods, .env, etc.).
- Build artifacts cleaned (~7.9 GB freed: .next, target, Pods, node_modules).
- **Custom RxDB SQLite storage implemented** (`@payload-universal/local-db/storage`):
  - Full drop-in replacement for the RxDB trial `getRxStorageSQLiteTrial()`.
  - Removes all trial limitations (300 doc cap, 110 op cap, no indexes).
  - SQL-level WHERE filtering via Mango-to-SQL converter (supports $eq, $gt, $gte, $lt, $lte, $ne, $in, $nin, $exists, $and, $or, $nor).
  - SQL-level ORDER BY, LIMIT, OFFSET for queries.
  - Expression indexes on `json_extract(data, ‘$.field’)` auto-created from schema-declared indexes.
  - Efficient bulkWrite: loads only affected documents (not the full table).
  - Efficient findDocumentsById: `WHERE id IN (...)`.
  - Fast COUNT queries: `SELECT COUNT(*)` instead of loading all docs.
  - Optional `getChangedDocumentsSince()` for optimised replication.
  - Graceful JS fallback for unsupported operators ($regex, $elemMatch, etc.).
- `_layout.tsx` updated: imports `getRxStorageSQLite` from `@payload-universal/local-db` instead of the RxDB trial.
- **Optimistic local-first write path implemented**:
  - Added `useLocalMutations(localDB, slug)` hook with `create`, `update`, `remove` methods.
  - `create()` generates a client-side MongoDB-compatible ID (24-char hex), inserts into local RxDB, returns instantly.
  - `update()` patches local RxDB doc immediately via `incrementalPatch`.
  - `remove()` soft-deletes locally via `_deleted: true`.
  - Replication push handler syncs all local writes to the Payload server in the background.
  - Push handler now strips RxDB internal fields (`_rev`, `_meta`, `_attachments`) before sending to server.
  - `create.tsx` and `[id].tsx` screens rewired: writes go to local DB first (instant), not the REST API.
  - `[id].tsx` edit screen now loads from local RxDB via `useLocalDocument()` (reactive) instead of `payloadApi.findByID()`.
- Fixed DVM1 error: removed `RxDBDevModePlugin` (requires storage validator wrapper; unnecessary with permissive JSON schemas).
- MongoDB running locally for the Payload backend.

### Phase 3 — WebSocket sync + field-level merge (2026-03-29)
- **WebSocket sync server** running on port 3001 alongside Payload (Next.js instrumentation):
  - Real-time change notifications via `afterChange`/`afterDelete` hooks → WS broadcast
  - Client authenticates via JWT on first WS message
  - Catchup on reconnect: client sends per-collection checkpoints, server pushes missed changes
  - Heartbeat (30s) to detect stale connections
- **Sync endpoints** auto-registered on Payload:
  - `GET /api/sync/diff` — lightweight manifests `{id, updatedAt}` since checkpoint (uses `select` for minimal MongoDB transfer)
  - `POST /api/sync/pull` — selective full-doc fetch by specific IDs (batched in groups of 50)
  - `POST /api/sync/push` — push with **field-level three-way merge**
- **Field-level three-way merge** on push:
  - Uses common ancestor (base/assumedMasterState) as reference
  - Fields changed only locally → client value applied
  - Fields changed only on server → server value kept
  - Both changed same field → **client wins** (lab notebook: offline edits take precedence)
  - Non-conflicting changes from both sides merge automatically (no false conflicts)
- **Tombstone collection** (`_sync_tombstones`) for tracking deletions:
  - `afterDelete` hooks write `{docId, sourceCollection, deletedAt}` tombstones
  - Diff/pull endpoints query tombstones to detect remote deletions
  - Can be pruned after 30 days (clients not synced in 30 days need full re-sync)
- **`_locallyModified` flag** added to every RxDB document schema:
  - Set `true` on any local write (create/update/remove)
  - Incoming WS changes skip documents where `_locallyModified === true`
  - Cleared after successful push to server
- **Client-side WS replication** (`syncReplication.ts`):
  - Replaces polling-based replication when `wsURL` is provided
  - Falls back to polling if `wsURL` is not set
  - Debounced push (1s) on local writes
  - Auto-reconnect (3s) on disconnect
- Sync hooks injected automatically into all collections via `createPayloadConfig`
- `LocalDBProvider` no longer blocks on initial replication (local-first: persisted data available instantly)
- `DocumentList` skips redundant API fetch when `localData` is provided
- Expo app configured with `wsURL: ws://localhost:3001`

### Phase 4 — UX improvements + Turbopack fix (2026-03-29)
- **Crypto polyfill**: Added `globalThis.crypto` polyfill using `expo-crypto` in `database.ts` — Hermes doesn't have `crypto`, but RxDB needs it internally for hashing
- **RxDB schema version bump** (0→1): Added `_locallyModified` field required new schema version; old SQLite tables caused silent init failures. Added try/catch retry in `database.ts` that removes + recreates collections on schema conflicts
- **App no longer blocks on local DB**: `AuthGate` only waits for auth check (instant from SecureStore), not for DB initialization. Screens show their own loading states while DB spins up
- **Sync progress UI**: `SyncProgressIndicator` component shows progress bar + "Syncing posts... 2/7 collections" on splash screen; `SyncToastBridge` fires toasts on sync complete/error
- **`LocalDBProvider` sync progress tracking**: New `syncProgress` context value with `{total, completed, current}`, optional `onSyncProgress`/`onSyncComplete`/`onSyncUpdate` callbacks
- **Collection card summary fields**: Gear icon (⚙) in list header opens bottom sheet field picker; selected fields display as label:value pairs on each card; persisted per collection in AsyncStorage
- **Native Picker for Select/Radio fields**: Replaced BottomSheet with `@react-native-picker/picker` for single-select and toggle chips for multi-select (`hasMany: true`); relationship fields still use searchable BottomSheet
- **RelationshipField improvements**: `useAsTitle` from schema for display labels; local-first search (queries RxDB, falls back to API); client-side filtering in picker
- **Link.Preview on document lists and relationship fields**: Long-press peek/pop (iOS) on list rows and selected relationship values
- **Root node_modules symlink restored**: Turbopack `root: monoRoot` requires `payload_expo_tauri/node_modules → test_app/node_modules` symlink to resolve transitive deps (`@floating-ui/react`, `clsx`) from `payload-main` packages. Deleting this symlink during cleanup caused `/admin` to crash. **Must not delete this symlink.**
- **Next.js instrumentation**: `apps/server/src/instrumentation.ts` starts WS sync server on port 3001 during Next.js boot

## Architecture changes since initial plan
- `payload_universal` is now an importable module; collections belong to the consuming app.
- `apps/server/src/payload.config.ts` defines collections locally and uses `createPayloadConfig`.
- Tauri desktop app uses the live Next dev server instead of a static export.
- `admin.components.Nav` now points to `apps/server/src/components/NativeNav` for a fully client-rendered sidebar.
- Local-first mobile architecture uses a custom SQLite storage (not the RxDB premium plugin). Evaluated Zero (Rocicorp) as an alternative but rejected due to no offline writes.

## Runtime setup
- `PAYLOAD_SECRET` and `DATABASE_URL` are read from `test_app/.env`.
- `apps/server/scripts/dev.mjs` loads env from repo root and `test_app/.env`.
- MongoDB default (local): `mongodb://127.0.0.1:27017/payload_universal_test`.
- MongoDB must be running: `brew services start mongodb-community`.

## Notable fixes applied
- Patched `payload-main` build scripts to work under Node 22 (globby import fix).
- Adjusted Payload UI dnd-kit type imports to avoid deep package paths.
- Added Tauri icon, build script, and devtools; switched dev URL to `127.0.0.1`.
- Added Tauri capability file to enable menu APIs on remote dev URLs.
- Updated dev script to avoid unnecessary rebuilds; Payload build only runs when artifacts are missing.
- Switched `@payload-universal/*` deps in test apps to `workspace:*` for live edits.
- Fixed RxDB `getRxStorageSQLite is not a function` error by replacing trial import with custom storage.
- Fixed RxDB DVM1 error (dev-mode schema validator) by removing `RxDBDevModePlugin` — our permissive schemas make it unnecessary.
- Fixed RxDB DB9 error (duplicate database) by tracking singleton instance + destroy-before-recreate.
- Fixed replication push sending RxDB internals (`_rev`, `_meta`, `_attachments`) to Payload REST API — now stripped before POST/PATCH.
- Rewired mobile create/edit screens from direct API calls to optimistic local-first writes via `useLocalMutations`.
- Fixed Hermes `Property 'crypto' doesn't exist` by polyfilling `globalThis.crypto` with `expo-crypto`.
- Fixed RxDB schema version mismatch (0→1) after adding `_locallyModified` field — added retry logic for collection schema conflicts.
- Fixed `DocumentList` making redundant API calls even when `localData` was provided.
- Fixed `useLocalCollection`/`useLocalDocument` returning `loading: false` prematurely when DB wasn't ready yet.
- Restored root `node_modules` symlink after cleanup broke Turbopack's transitive dependency resolution for `/admin`.
- Added `pnpm.onlyBuiltDependencies` to test_app/package.json for native build scripts.

## Critical infrastructure notes
- **Root `node_modules` symlink** (`payload_expo_tauri/node_modules → test_app/node_modules`) is **required** for Turbopack. The `turbopack.root` is set to the monorepo root, and Turbopack resolves `@floating-ui/react`, `clsx`, and other transitive deps of `payload-main` through this symlink. **Do not delete it during cleanup.**
- **`.next` cache**: If Turbopack fails after config changes, delete `test_app/apps/server/.next` and restart.

## Current known gaps
- Admin-native component translation work remains (see plan in `006_component-translation.md`).
- Tauri uses live Next dev server; static export strategy still TBD.
- Pre-existing TS errors in admin-native (React 19 `key`/`ref` prop changes, `expo-router` resolution from workspace) and admin-schema (Payload type mismatches) — cosmetic, do not affect runtime.
- Could switch from MongoDB to Postgres in future (compatible with current architecture).

## Commands
- Start everything: `pnpm -C test_app dev:all`
- Server only: `pnpm -C test_app dev:server`
- Tauri desktop: `pnpm -C test_app dev:desktop`
- Mobile: `pnpm -C test_app dev:mobile`
- Install deps: `cd test_app && pnpm install`
