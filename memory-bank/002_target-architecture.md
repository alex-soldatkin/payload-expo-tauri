# Target architecture

You will keep the Payload config as the single source of truth and build three admin clients that use the same schema and state.

Architecture layers
- packages/schema holds the Payload config builder, admin schema endpoint helper, and shared server helpers.
- packages/admin-schema is generated output. It contains client config, field schema maps, and any extra metadata you decide to expose to clients.
- packages/admin-core contains platform neutral logic. It owns schema map helpers, form state, validation, and the component registry contract.
- packages/admin-web wraps existing web UI from payload-main/packages/ui and keeps DOM and Next specific code.
- packages/admin-native adds React Native field and view components built on admin-core.
- apps/admin-web runs the admin UI in the browser. It can be Next or a Vite SPA.
- apps/admin-tauri wraps the web admin build in Tauri.
- apps/admin-mobile is the Expo app.

Data flow
1. Payload server builds ClientConfig with createClientConfig and exposes it via a new admin schema endpoint.
2. Clients fetch the admin schema and build their field maps and form state in admin-core.
3. UI components render fields using platform adapters and a component registry.
4. Data reads and writes go through @payloadcms/sdk so all clients share the same API shape.

Custom components
- Keep the import map from Payload. Extend it with platform specific entries such as "web" and "native".
- If a native component is missing, render a clear fallback component in mobile so you can still edit other fields.

Current implementation notes (2026-03-29)
- apps/server defines collections locally and calls `createPayloadConfig` from packages/schema.
- apps/desktop-tauri loads the Next admin UI from the server dev URL. TauriMenuBridge builds native menus from the admin schema.
- apps/mobile-expo uses Expo Router with file-based routing. The admin schema drives navigation, field rendering, and data flow.
- packages/admin-native is the React Native component library. It maps Payload field types to native mobile components (TextInput, Switch, BottomSheet, etc.) and exposes PayloadNativeProvider, DocumentForm, DocumentList, and FieldRenderer.

Mobile component mapping (web → native)
- Sidebar navigation → Bottom tab bar (from menuModel groups)
- Data tables → FlatList with pull-to-refresh + infinite scroll
- Popover panels / dropdowns → BottomSheet (Modal + Animated)
- Select / radio menus → BottomSheet option list
- Relationship pickers → BottomSheet with search
- Collapsible sections → Expandable native views
- Tabs → Segmented control
- Date pickers → Modal stepper
- Checkbox → Switch
- Rich text → Plain-text fallback (Lexical JSON round-trip)
- Field groups → Bordered left-indent sections
- Array fields → Cards with add/remove
- Block fields → Typed cards with block type picker

Local-first architecture (2026-03-29)
- packages/local-db wraps RxDB for local-first data on mobile
- Auto-generates RxDB schemas from the Payload admin schema
- HTTP replication: pull from GET /api/{slug}, push to POST/PATCH /api/{slug}/{id}
- Conflict resolution: server wins (last-write-wins via updatedAt)
- React hooks: useLocalCollection (reactive list), useLocalDocument (reactive single doc)
- DocumentList accepts optional localData prop for local-first rendering
- In-memory storage by default, can swap to SQLite for persistence

Shared hooks and DB schema
- Hooks stay in packages/schema and are used by the server only.
- DB schema generation stays in payload-main/packages/drizzle and is driven by the same config.
