# Payload Universal Test App

This monorepo is a thin test harness for the Payload Universal packages.

- apps/server re-exports the shared Payload config from payload_universal.
- apps/web redirects to the Payload admin at http://localhost:3000/admin.
- apps/web-next is a Next schema preview client with a proxy API route.
- apps/desktop-tauri wraps the Payload admin in a Tauri shell.
- apps/mobile-expo is a React Native preview client.

## Handy scripts
- `pnpm dev:server` runs the Payload server using the shared config (builds Payload packages for Turbopack on first run, falls back to webpack if needed).
- `pnpm dev:web` serves the redirect on http://localhost:4173.
- `pnpm dev:web-next` runs the Next preview app on http://localhost:3001 (Turbopack).
- `pnpm dev:desktop` launches the Tauri wrapper (expects the Payload server).
- `pnpm dev:mobile` launches the Expo preview app.
- `pnpm dev:all` runs all of the above concurrently.
