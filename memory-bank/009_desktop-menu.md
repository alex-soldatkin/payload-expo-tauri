# Desktop menu plan (Tauri)

Goal: generate the native desktop menu bar from the Payload admin schema so desktop affordances are always in sync with the server config.

## Menu model (server-derived)
Expose a `menuModel` section in the admin schema response. Implemented in `@payload-universal/admin-schema` and derived from the sanitized config.

- groups: array of group labels (from `collection.admin.group` + `global.admin.group`), preserving order
- collections: list of collections with:
  - slug, labels, group, admin.hidden
  - permissions: canRead/canCreate/canUpdate
  - draftsEnabled, versionsEnabled
- globals: list of globals with:
  - slug, label, group, admin.hidden
  - permissions: canRead/canUpdate
  - draftsEnabled
- capabilities: boolean flags for tools (schema export, typegen, import map reload, migrations)

## Menu builder (admin-core)
- Build a platform‑neutral menu tree from `menuModel`.
- Apply access checks to hide/disable items (TODO).
- Provide command metadata (route + optional query) so all platforms can route the same way.

## Current implementation (2026-02-05)
- `menuModel` added to `AdminSchema` in `payload_universal/packages/admin-schema/src/index.ts`.
- `apps/server` adds a client bridge (`TauriMenuBridge`) that:
  - calls `/api/admin-schema`
  - builds the native menu with `@tauri-apps/api/menu`
  - sets the app menu via `Menu.setAsAppMenu()`
- `apps/desktop-tauri` has a capabilities file that allows menu APIs for remote dev URLs.

## Desktop adapter (Tauri)
- Map the menu tree to native menu items + keyboard shortcuts.
- Menu actions trigger navigation by emitting events or invoking a `navigate` command in the webview.

## Use cases (auto‑generated)

1) Collections menu grouped by `admin.group`
- `Collections → [Group] → <Collection>`
- Sub‑commands:
  - `New <Collection>` (opens create view)
  - `Search <Collection>…` (focus list search)
  - `Export <Collection>…` (server‑side CSV export)

2) Globals menu grouped by `admin.group`
- `Globals → [Group] → <Global>`
- Sub‑commands:
  - `Edit <Global>`
  - `Open Draft` (only if drafts enabled)

3) Workflow filters derived from schema
- `Workflow → Drafts / Scheduled / Needs Review`
- Commands navigate to pre‑filtered list views using query params.

4) Tools derived from capabilities
- `Tools → Schema → Open JSON` (opens `/api/admin-schema` in modal)
- `Tools → Types → Regenerate` (server task)
- `Tools → Import Map → Reload` (server task)
- `Tools → Migrations → View status`

## UX details
- Hidden collections/globals do not appear.
- Items without permissions appear disabled rather than removed, to signal access control.
- Group headers collapse automatically if a group has <2 items.

## Next steps
- Add a `createMenuModel` helper in `@payload-universal/admin-core` and move menu construction there.
- Wire permission data into `menuModel` and disable items based on access.
- Add keyboard shortcuts for common actions (new/search).
- Add menu refresh on auth changes.
