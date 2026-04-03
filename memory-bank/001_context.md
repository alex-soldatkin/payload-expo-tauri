# Context and references

This file records the key files in the two codebases that you should use as the source of truth.

Payload references
- payload-main/packages/payload/src/config/client.ts for createClientConfig and the ClientConfig shape.
- payload-main/packages/payload/src/fields/config/client.ts for createClientField, createClientFields, and server only field props.
- payload-main/packages/ui/src/utilities/buildFormState.ts and payload-main/packages/ui/src/forms/fieldSchemasToFormState for server side form state.
- payload-main/packages/ui/src/utilities/buildFieldSchemaMap and buildClientFieldSchemaMap for schema maps used by the admin UI.
- payload-main/packages/next/src/layouts/Root and payload-main/packages/next/src/withPayload for Next admin wiring.
- payload-main/packages/ui/src/providers/Root for the provider stack used by the admin app.
- payload-main/packages/ui/src/views and payload-main/packages/ui/src/fields for web admin views and field components.
- payload-main/packages/payload/src/bin/generateTypes.ts and payload-main/packages/payload/src/utilities/configToJSONSchema.ts for type and JSON schema generation.
- payload-main/packages/drizzle/src/schema/build.ts and payload-main/packages/drizzle/src/schema/traverseFields.ts for DB schema build from field config.
- payload-main/packages/next/src/layouts/Root for how the Next admin app wires providers.

Spacedrive references
- spacedrive-main/apps/mobile for Expo and NativeWind setup. See tailwind.config.js, babel.config.js, and nativewind-env.d.ts.
- spacedrive-main/apps/tauri for the Tauri desktop app with Vite and React.
- spacedrive-main/packages/ts-client for the shared generated TypeScript client pattern.
- spacedrive-main/apps/mobile/src/client and spacedrive-main/apps/tauri/src/App.tsx for platform specific transports and client wrappers.
- spacedrive-main/packages/ui/style/colors and spacedrive-main/apps/mobile/tailwind.config.js for shared design tokens in NativeWind.
- spacedrive-main/package.json for the monorepo layout under apps/* and packages/*.

Local workspace references
- payload_universal/packages/client-validators/src/index.ts for client-safe field validators and hooks (runs on mobile without server deps).
- payload_universal/packages/client-validators/src/builtinValidators.ts for built-in validators ported from Payload.
- payload_universal/packages/client-validators/src/runValidation.ts for the schema-walking validation runner.
- payload_universal/packages/client-validators/src/runHooks.ts for beforeValidate/beforeChange/afterChange/afterRead hook runners.
- payload_universal/packages/local-db/src/hooks/validatedHooks.ts for useValidatedMutations (validates before writing to RxDB).
- payload_universal/packages/local-db/src/contexts/ClientValidatorContext.tsx for ClientValidatorProvider context.
- test_app/apps/mobile-expo/src/validators/index.ts for the test app's custom client-side validators and hooks.
- payload_universal/packages/schema/src/createPayloadConfig.ts for the shared Payload config builder.
- payload_universal/packages/admin-schema/src/index.ts for admin schema generation.
- payload_universal/packages/local-db/src/database.ts for the RxDB database factory (createLocalDB).
- payload_universal/packages/local-db/src/storage/index.ts for the custom RxDB SQLite storage (getRxStorageSQLite).
- payload_universal/packages/local-db/src/storage/mango-to-sql.ts for Mango query to SQL WHERE conversion.
- payload_universal/packages/local-db/src/sync/replication.ts for HTTP replication to Payload REST API.
- payload_universal/packages/local-db/src/sync/syncReplication.ts for WebSocket sync replication.
- payload_universal/packages/local-db/src/hooks/hooks.ts for useLocalCollection, useLocalDocument, useLocalQuery.
- payload_universal/packages/local-db/src/hooks/useUploadQueue.ts for usePendingUploads.
- payload_universal/packages/local-db/src/queue/uploadQueue.ts for UploadQueueManager.
- payload_universal/packages/local-db/src/utils/schemaFromPayload.ts for buildRxSchema, extractFieldDefs.
- payload_universal/packages/local-db/src/contexts/LocalDBProvider.tsx for LocalDBProvider context.
- payload_universal/packages/admin-native/ for React Native admin UI components.
- payload_universal/packages/admin-native/src/fields/join.tsx for the native JoinField component.
- payload_universal/packages/admin-native/src/DocumentForm.tsx for DocumentForm component.
- payload_universal/packages/admin-native/src/contexts/FormDataContext.ts for FormDataContext (provides parent doc ID to nested fields like JoinField).
- payload_universal/packages/admin-native/src/hooks/usePayloadForm.ts for React Hook Form integration.
- payload_universal/packages/admin-native/src/utils/schemaHelpers.ts for schema map helpers.
- payload_universal/packages/admin-native/src/utils/api.ts for Payload REST API client.
- payload_universal/packages/admin-native/src/utils/validation.ts for Zod validation from Payload fields.
- payload_universal/packages/admin-native/src/utils/iconRegistry.ts for lucide icon registry + SF Symbol mappings.
- payload_universal/packages/admin-native/src/contexts/CustomComponentContext.tsx for custom component overrides.
- payload_universal/packages/admin-native/src/contexts/PreviewContext.ts for preview context (Link.Preview control).
- payload_universal/packages/admin-native/src/theme/index.ts for design tokens and theming.
- payload_universal/packages/admin-native/src/types/index.ts for shared TypeScript types.
- test_app/apps/server/src/payload.config.ts for the app-owned collections and server config.
- test_app/apps/mobile-expo/app/_layout.tsx for the Expo root layout (auth, local DB, storage init).
- test_app/apps/mobile-expo/metro.config.js for Metro resolver (singleton pinning for react, react-native, @expo/ui).
- test_app/apps/mobile-expo/babel.config.js for Babel config (do NOT add @react-native/babel-plugin-codegen — crashes on RN 0.83).
- test_app/.env for PAYLOAD_SECRET and DATABASE_URL.

Server sync endpoints
- payload_universal/packages/schema/src/endpoints/syncDiff.ts — GET /api/sync/diff handler
- payload_universal/packages/schema/src/endpoints/syncPull.ts — POST /api/sync/pull handler
- payload_universal/packages/schema/src/endpoints/syncPush.ts — POST /api/sync/push + three-way merge
- payload_universal/packages/schema/src/endpoints/syncWebSocket.ts — WS server, broadcastChange(), createSyncHooks()
- payload_universal/packages/schema/src/endpoints/syncTombstones.ts — _sync_tombstones collection + afterDelete hook
- test_app/apps/server/src/instrumentation.ts — starts WS sync server on Next.js boot (port 3001)
- test_app/apps/server/next.config.mjs — Turbopack config (root: monoRoot, requires root node_modules symlink)

Repository
- Remote: https://github.com/alex-soldatkin/payload-expo-tauri.git (branch: main)

Critical: root node_modules symlink
- payload_expo_tauri/node_modules → test_app/node_modules (MUST exist for Turbopack)
- Turbopack resolves transitive deps (@floating-ui/react, clsx) from payload-main through this
- Do NOT delete during cleanup
