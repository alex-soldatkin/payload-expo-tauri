# Admin core, web, and Tauri

You will keep the current web admin working while you carve out a platform neutral core.

Admin core extraction
- Move form state, schema map helpers, and validation logic into packages/admin-core.
- Candidates to move include payload-main/packages/ui/src/forms, payload-main/packages/ui/src/utilities/buildFormState.ts, and payload-main/packages/ui/src/forms/useField.
- Keep DOM and Next specific code in the web layer. Examples are payload-main/packages/ui/src/views and payload-main/packages/ui/src/providers/Root.
- Replace next/navigation usage with a NavigationAdapter interface so the same views can run in a Vite app and in Tauri.

Web admin
- Keep using payload-main/packages/ui for field and view components.
- Keep Next wiring in payload-main/packages/next/src/layouts/Root for the Next version of the admin.
- Keep Next as the web admin host. Do not replace it with Vite.

Tauri admin
- Follow spacedrive-main/apps/tauri as a pattern for a Vite plus Tauri setup when needed.
- Prefer a Next static export for Tauri if it is feasible. Fall back to a Vite wrapper only if Next export cannot satisfy desktop requirements.
- Add a small Tauri adapter for file dialogs and uploads so web components can call native APIs when needed.

Status (2026-02-05)
- apps/desktop-tauri wraps the live Next admin at `http://127.0.0.1:3000/admin`.
- Tauri devtools are enabled for debugging.
