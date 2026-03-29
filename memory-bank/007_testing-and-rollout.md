# Testing and rollout

You will ship this in small steps so web stays stable while mobile and desktop catch up.

Phased rollout
1. Admin schema endpoint and admin-core extraction.
2. Web admin on Vite and Tauri wrapper for desktop.
3. Mobile read only views for collections and documents.
4. Mobile edit and create flows.
5. Uploads, relationships, and rich text parity.

Testing focus
- Schema map tests using payload-main/packages/ui/src/forms/fieldSchemasToFormState.spec.js as a base.
- API integration tests for the admin schema endpoint.
- Web e2e tests continue as they are.
- Tauri smoke tests for login and list view.
- Mobile smoke tests for login, list, and edit.

Acceptance checks
- Same field set renders on web, desktop, and mobile for a given collection.
- Create and edit flows enforce the same validation rules.
- DB schema and hooks stay in one shared config package.
