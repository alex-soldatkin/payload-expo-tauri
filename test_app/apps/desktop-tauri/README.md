# Desktop Tauri Admin Shell

This Tauri app opens the Payload admin running at `http://localhost:3000/admin`.

## Dev flow
1. Start the Payload server from `apps/server`.
2. Run `pnpm dev` in this folder.

## Build
- The frontend dist directory points at `../../web` and redirects to the admin URL.
- Ensure the Payload server is available when running the packaged app.
