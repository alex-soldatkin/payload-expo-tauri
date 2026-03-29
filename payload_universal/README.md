# Payload Universal

This monorepo hosts the shared schema and admin tooling for web, desktop, and mobile clients.

Packages
- @payload-universal/schema: Payload config builder + admin schema endpoint helper.
- @payload-universal/admin-core: schema map builders copied from Payload UI (platform neutral).
- @payload-universal/admin-schema: admin schema generator output for clients.

Admin schema endpoint
- Use `createPayloadConfig` to add `GET /api/admin-schema` for authenticated admin users.
- Clients can call `fetchAdminSchema` from `@payload-universal/admin-schema/client`.
