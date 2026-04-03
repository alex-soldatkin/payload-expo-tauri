# Schema and code generation

Goal: one Payload config produces the DB schema, TypeScript types, and admin UI schema for all clients.

Plan
1. Move your Payload config into packages/schema. Export hooks and any shared helpers from this package so server and tests use the same code.
2. Keep payload generate:types as the primary type source. The generator lives in payload-main/packages/payload/src/bin/generateTypes.ts.
3. Add a new generator that outputs admin schema artifacts:
   - client-config.json from createClientConfig in payload-main/packages/payload/src/config/client.ts.
   - client-field-schema.json from buildClientFieldSchemaMap in payload-main/packages/ui/src/utilities/buildClientFieldSchemaMap.
   - server-field-schema.json from buildFieldSchemaMap in payload-main/packages/ui/src/utilities/buildFieldSchemaMap.
4. Add a server endpoint that returns the latest admin schema so mobile and desktop can fetch at runtime.
5. Keep JSON schema generation in payload-main/packages/payload/src/utilities/configToJSONSchema.ts. Use it for type safety and any client side validation you choose to support.
6. Keep DB schema generation in payload-main/packages/drizzle/src/schema. Add a script that writes the raw schema to disk so you can inspect the result and use it in migrations.

MenuModel extensions (2026-04-02)
- `icon?: string` added to both collection and global entries in `MenuModel`.
- Value is a lucide icon name (e.g. `'users'`, `'image'`, `'file-text'`) or a raw SVG string.
- Set in the collection config via `admin.icon` (Payload types don't include this — use `@ts-expect-error`).
- Extracted in `buildMenuModel()` via `(collection.admin as Record<string, unknown>)?.icon`.
- Consumed on mobile by `CollectionIcon` component and `getSFSymbol()` for native menus.

Notes on hooks and validators
- Server-side hooks and validators run via Payload as before — these remain the authoritative source.
- **Client-side hooks and validators** now also run on mobile via `@payload-universal/client-validators`:
  - Built-in validators (required, min, max, minLength, maxLength, email regex, select matching, etc.) are ported from Payload's `fields/validations.ts` without server dependencies.
  - Custom validators and hooks are defined per-app in a client-safe module (e.g. `src/validators/index.ts`), bundled by Metro at build time.
  - `useValidatedMutations` hook runs hooks + validation BEFORE writing to local RxDB — validation failures never reach the DB.
  - `ClientValidatorProvider` context holds the `ClientHooksConfig` and is mounted in the app root.
  - Functions CANNOT be serialized through the JSON admin-schema endpoint. Client validators are imported as code, not fetched as JSON.
  - Keep custom validators free of server dependencies (no `req`, `payload`, database queries, etc.).
