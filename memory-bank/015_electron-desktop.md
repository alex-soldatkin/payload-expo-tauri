# Electron desktop client (2026-07-13)

GitHub epic: alex-soldatkin/payload-expo-tauri#1 (sub-issues #2–#8).

## Design principle

Unlike the Tauri shell (a thin webview over the remote Next admin, see 004/010), the
Electron app follows the **Spacedrive pattern** named as future direction in 004: the
primary window is a **bundled Vite + React renderer** that runs the local-first stack
itself. The server is a sync target, not the UI host — the app works offline by
definition.

- **Multitenancy**: the server deployment URL is user-configured in the app
  (ConnectScreen; persisted in `userData/settings.json`). Self-hosted or hosted.
- **Per-server isolation**: the SQLite database name is prefixed with a slug of the
  server host (`databaseNamePrefix: '<host>_<port>__'`), so switching servers never
  mixes local data.
- The web admin remains reachable as a secondary window (Tools → Open Web Admin →
  `<serverURL>/admin`) with the Tauri-parity chrome (vibrancy, drag region, the
  `payload-tauri` class injected so `custom.scss` transparency activates).

## Architecture

```
test_app/apps/desktop-electron/
  scripts/dev.mjs        vite dev server + electron orchestration (strips
                         ELECTRON_RUN_AS_NODE — VS Code terminals export it and it
                         makes the electron binary run main as plain Node)
  src/main/              index/windows/menu/settings/sqliteHost (plain ESM .mjs)
  src/preload/index.cjs  contextBridge: payloadSqlite + payloadDesktop
  src/renderer/          Vite + React client (connect → login → workspace)
```

### SQLite over IPC (the platform driver)

The only platform seam in `@payload-universal/local-db` is RxDB's `SQLiteBasics`
driver injected via `getRxStorageSQLite({ sqliteBasics })` (011). Electron mirrors
RxDB's own `getSQLiteBasicsTauri` (SQL over IPC to Rust):

- renderer: `getSQLiteBasicsElectronIPC(window.payloadSqlite)` (new, in local-db —
  no electron dependency; the bridge is injected)
- preload: `payloadSqlite.{open,all,run,setPragma,close}` → `ipcRenderer.invoke`
- main: `sqliteHost.mjs` on **`node:sqlite` (`DatabaseSync`)** — zero native deps,
  no rebuilds; Electron 38 bundles Node 22.16+ where node:sqlite is available.
  Files: `userData/payload-local/<prefix>payload_local.sqlite`.

**Gotcha (fixed)**: the driver's DB handle must be an *object* (`{ id }`), not the
raw dbId string — rxdb's `sqliteTransaction` serialises writes through
`TX_QUEUE_BY_DATABASE`, a WeakMap keyed by the handle; primitives throw
`Invalid value used as weak map key`.

### Native menu

Same tree as TauriMenuBridge (Collections grouped → Open/New, Globals, Workflow →
Drafts, Tools, View), but built in the renderer (`lib/menuTree.ts` from the admin
schema it already fetches) and installed over IPC (`menu:set` →
`Menu.setApplicationMenu`). Actions round-trip back via `menu:action`.

## local-db decoupling for platform neutrality (#5)

- Hermes crypto polyfill moved out of `database.ts` into
  `polyfills/hermesCrypto.ts`; the Expo app imports it explicitly at the top of
  `_layout.tsx` (must precede any rxdb code). `generateId()` now uses standard
  WebCrypto (`globalThis.crypto.getRandomValues`).
- Expo peer deps are `peerDependenciesMeta: optional`.
- `expo-file-system/legacy` stays a static-literal dynamic import (Metro needs
  that); the Electron renderer aliases it to a no-op stub in `vite.config.mjs`
  (`@vite-ignore` does NOT stop Rollup from resolving literal dynamic imports).

## Sync bugs found & fixed while verifying (affect mobile too)

1. `replication.ts` push: on 400/409 create, the "does it already exist" fetch
   didn't check `res.ok` — a 404 JSON error body was pushed back into RxDB as a
   garbage conflict doc, permanently corrupting that doc's replication state.
2. `replication.ts` push: PATCH 404 (doc never reached the server) now falls back
   to POST create instead of stranding the record locally.
3. `syncReplication.ts` WS pull: the per-change fetch was not draft-aware — for
   draft-only docs `GET /api/{slug}/{id}` returns the parent/published shell
   (missing all drafted fields) which then clobbered local state. Now
   `?draft=true` + a post-fetch re-check of `_locallyModified` (race guard).
4. **Offline data loss (root cause)**: Payload assigns its own `updatedAt`, so a
   pushed doc never matches the server echo; RxDB flags the next pull as a
   conflict, and RxDB's *default* conflict handler resolves to the server state —
   silently dropping any offline edit made between push-ack and pull. Fixed with a
   custom `RxConflictHandler` in `database.ts`: **local wins while
   `_locallyModified` is set**, otherwise server wins. Verified: offline edits now
   survive a server outage and push on reconnect.

Flag lifecycle note: after an offline round-trip, `_locallyModified` clears when a
polling pull applies the server echo — takes 1–3 pull cycles (~30–90s at the 30s
interval), so "N unsynced changes" lingers briefly after reconnect even though the
push already succeeded. Verified to converge; instant clearing (reconciling the
push-response echo into RxDB's assumed-master) belongs with the #8 protocol work.

## Ports

Another Payload instance owns :3000 locally, so the test server runs on **3050**
(`PORT` in `apps/server/.env`) with WS sync on **3051** (`SYNC_WS_PORT`). All app
references were swept 3000→3050 (tauri devUrl/capabilities, web redirect stub,
web-next fallbacks, mobile dev defaults). The Electron renderer derives
`ws://<host>:<port+1>` for http servers (3050 → 3051), `wss://<host>/ws` for https,
with an explicit override field in settings.

`createPayloadConfig` now defaults `cors: '*'` (apps can narrow) — desktop clients
fetch from non-web origins (`file://`, Vite dev) and Payload's default same-origin
CORS made every renderer fetch fail while curl worked.

## Verified end-to-end (2026-07-13)

- Initial sync: all collections → local SQLite over IPC (users/media/posts/pages/
  products/events/view-presets).
- Live WS pull: REST-created doc appears in local DB while the app runs.
- Renderer create+save (draft) → push → server has it with the client-generated ID.
- Offline: server killed, local edit queued, server restarted → edit pushed,
  nothing lost.

## Running

```
pnpm dev:server     # payload on 3050, WS on 3051 (test_app/)
pnpm dev:electron   # vite + electron (test_app/)
```

Seeded dev login: `admin@example.com` / `payload-test-1234` (008 progress log).
