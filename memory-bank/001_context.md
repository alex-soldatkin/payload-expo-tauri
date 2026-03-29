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
- payload_universal/packages/schema/src/createPayloadConfig.ts for the shared Payload config builder.
- payload_universal/packages/admin-schema/src/index.ts for admin schema generation.
- test_app/apps/server/src/payload.config.ts for the app-owned collections and server config.
