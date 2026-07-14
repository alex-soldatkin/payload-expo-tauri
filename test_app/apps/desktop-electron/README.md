# @payload-universal-test/desktop-electron

A bundled, local-first desktop client for Payload Universal, following the
Spacedrive pattern: the app ships its own renderer and holds a local SQLite
database (via RxDB) inside the Electron main process, syncing against a Payload
server over the network. The server address is configurable in-app (stored in
`settings.json` under the user-data directory), so a single build can point at
any deployment. A secondary window can open the server's own web admin with the
native transparent chrome applied.

## Running

From `test_app`, start the sync server first, then the desktop app:

```sh
pnpm dev:server    # payload on :3050, WS sync on :3051 (required for sync only)
pnpm dev:electron  # Vite dev server on :5183, then Electron
```

First run: enter the server URL (Local dev preset = `http://127.0.0.1:3050`) and
sign in (seeded dev admin: `admin@example.com` / `payload-test-1234`). The
WebSocket URL is derived automatically (`http://host:P` → `ws://host:P+1`,
`https://host` → `wss://host/ws`) with an explicit override under Advanced.

## Editing

Documents open in a schema-driven form with full SSOT coverage: all 22 Payload
field types (chips for hasMany, all five date picker appearances, polymorphic
relationships, media picker, blocks/arrays with reordering, Lexical plain-text
rich text) plus tabs/rows/collapsibles/sidebar layout, conditional fields, and
client-side validation. Unknown field types stay editable through a JSON
fallback. See `src/renderer/form/` and memory-bank/015.

## Where data lives

- SQLite: `~/Library/Application Support/Payload Universal Desktop/payload-local/`
  — one file per server (`<host>_<port>__payload_local.sqlite`), so switching
  servers keeps tenants isolated.
- Settings (server URL, WS override, token): `.../settings.json`.

## Demoing offline + sync

1. With server + app running, edit a post in the web admin (Tools → Open Web
   Admin) — the change appears live in the app (WebSocket pull).
2. Stop the server; create/edit documents in the app — the status bar counts
   queued changes, everything stays usable (local SQLite).
3. Restart the server — queued changes push automatically (offline edits win
   over concurrent server changes at document level while queued).
