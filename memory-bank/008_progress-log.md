# Progress log (2026-02-05)

This log captures what has been implemented so far and the current state of the test apps.

## Completed milestones
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

## Architecture changes since initial plan
- `payload_universal` is now an importable module; collections belong to the consuming app.
- `apps/server/src/payload.config.ts` defines collections locally and uses `createPayloadConfig`.
- Tauri desktop app uses the live Next dev server instead of a static export.
- `admin.components.Nav` now points to `apps/server/src/components/NativeNav` for a fully client-rendered sidebar.

## Runtime setup
- `PAYLOAD_SECRET` and `DATABASE_URL` are read from `test_app/.env`.
- `apps/server/scripts/dev.mjs` loads env from repo root and `test_app/.env`.
- MongoDB default (local): `mongodb://127.0.0.1:27017/payload_universal_test`.

## Notable fixes applied
- Patched `payload-main` build scripts to work under Node 22 (globby import fix).
- Adjusted Payload UI dnd-kit type imports to avoid deep package paths.
- Added Tauri icon, build script, and devtools; switched dev URL to `127.0.0.1`.
- Added Tauri capability file to enable menu APIs on remote dev URLs.
- Updated dev script to avoid unnecessary rebuilds; Payload build only runs when artifacts are missing.
- Switched `@payload-universal/*` deps in test apps to `workspace:*` for live edits.

## Current known gaps
- Mobile app still uses the schema preview (not the full admin UI).
- Admin-native component translation work remains (see plan in `006_component-translation.md`).
- Tauri uses live Next dev server; static export strategy still TBD.

## Commands
- Start everything: `pnpm -C test_app dev:all`
- Server only: `pnpm -C test_app dev:server`
- Tauri desktop: `pnpm -C test_app dev:desktop`
- Mobile: `pnpm -C test_app dev:mobile`
