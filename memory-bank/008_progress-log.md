# Progress log

This log captures what has been implemented so far and the current state of the test apps.

## Completed milestones

### Phase 1 — Foundation (2026-02-05)
- Created `payload_universal` and `test_app` monorepos with shared packages and test clients.
- Added `@payload-universal/admin-core` with schema map helpers.
- Added `@payload-universal/admin-schema` with `buildAdminSchema` and `fetchAdminSchema` client helper.
- Added `@payload-universal/schema` config builder (`createPayloadConfig`) and admin schema endpoint helper.
- Server exposes `GET /api/admin-schema` for authenticated admins.
- Added `menuModel` to the admin schema and wired a Tauri menu bridge to render native menus.
- Test apps:
  - `apps/server` (Next + Payload) running admin at `http://127.0.0.1:3000/admin`.
  - `apps/web` static preview app.
  - `apps/web-next` schema preview page.
  - `apps/mobile-expo` schema preview (NativeWind).
- `apps/desktop-tauri` wraps the Next admin (Tauri) and now loads the real admin UI.
- Native Tauri menu now auto-generates from the admin schema.
- Replaced the admin sidebar with a client `NativeNav` component that reuses Payload’s nav SCSS, honors `admin.group` via `groupNavItems`, and persists group open state via nav preferences.

### Phase 2 — Local-first mobile DB + repo setup (2026-03-29)
- **Repo published** to `https://github.com/alex-soldatkin/payload-expo-tauri.git`.
- Comprehensive `.gitignore` configured (node_modules, .next, target, Pods, .env, etc.).
- Build artifacts cleaned (~7.9 GB freed: .next, target, Pods, node_modules).
- **Custom RxDB SQLite storage implemented** (`@payload-universal/local-db/storage`):
  - Full drop-in replacement for the RxDB trial `getRxStorageSQLiteTrial()`.
  - Removes all trial limitations (300 doc cap, 110 op cap, no indexes).
  - SQL-level WHERE filtering via Mango-to-SQL converter (supports $eq, $gt, $gte, $lt, $lte, $ne, $in, $nin, $exists, $and, $or, $nor).
  - SQL-level ORDER BY, LIMIT, OFFSET for queries.
  - Expression indexes on `json_extract(data, ‘$.field’)` auto-created from schema-declared indexes.
  - Efficient bulkWrite: loads only affected documents (not the full table).
  - Efficient findDocumentsById: `WHERE id IN (...)`.
  - Fast COUNT queries: `SELECT COUNT(*)` instead of loading all docs.
  - Optional `getChangedDocumentsSince()` for optimised replication.
  - Graceful JS fallback for unsupported operators ($regex, $elemMatch, etc.).
- `_layout.tsx` updated: imports `getRxStorageSQLite` from `@payload-universal/local-db` instead of the RxDB trial.
- **Optimistic local-first write path implemented**:
  - Added `useLocalMutations(localDB, slug)` hook with `create`, `update`, `remove` methods.
  - `create()` generates a client-side MongoDB-compatible ID (24-char hex), inserts into local RxDB, returns instantly.
  - `update()` patches local RxDB doc immediately via `incrementalPatch`.
  - `remove()` soft-deletes locally via `_deleted: true`.
  - Replication push handler syncs all local writes to the Payload server in the background.
  - Push handler now strips RxDB internal fields (`_rev`, `_meta`, `_attachments`) before sending to server.
  - `create.tsx` and `[id].tsx` screens rewired: writes go to local DB first (instant), not the REST API.
  - `[id].tsx` edit screen now loads from local RxDB via `useLocalDocument()` (reactive) instead of `payloadApi.findByID()`.
- Fixed DVM1 error: removed `RxDBDevModePlugin` (requires storage validator wrapper; unnecessary with permissive JSON schemas).
- MongoDB running locally for the Payload backend.

### Phase 3 — WebSocket sync + field-level merge (2026-03-29)
- **WebSocket sync server** running on port 3001 alongside Payload (Next.js instrumentation):
  - Real-time change notifications via `afterChange`/`afterDelete` hooks → WS broadcast
  - Client authenticates via JWT on first WS message
  - Catchup on reconnect: client sends per-collection checkpoints, server pushes missed changes
  - Heartbeat (30s) to detect stale connections
- **Sync endpoints** auto-registered on Payload:
  - `GET /api/sync/diff` — lightweight manifests `{id, updatedAt}` since checkpoint (uses `select` for minimal MongoDB transfer)
  - `POST /api/sync/pull` — selective full-doc fetch by specific IDs (batched in groups of 50)
  - `POST /api/sync/push` — push with **field-level three-way merge**
- **Field-level three-way merge** on push:
  - Uses common ancestor (base/assumedMasterState) as reference
  - Fields changed only locally → client value applied
  - Fields changed only on server → server value kept
  - Both changed same field → **client wins** (lab notebook: offline edits take precedence)
  - Non-conflicting changes from both sides merge automatically (no false conflicts)
- **Tombstone collection** (`_sync_tombstones`) for tracking deletions:
  - `afterDelete` hooks write `{docId, sourceCollection, deletedAt}` tombstones
  - Diff/pull endpoints query tombstones to detect remote deletions
  - Can be pruned after 30 days (clients not synced in 30 days need full re-sync)
- **`_locallyModified` flag** added to every RxDB document schema:
  - Set `true` on any local write (create/update/remove)
  - Incoming WS changes skip documents where `_locallyModified === true`
  - Cleared after successful push to server
- **Client-side WS replication** (`syncReplication.ts`):
  - Replaces polling-based replication when `wsURL` is provided
  - Falls back to polling if `wsURL` is not set
  - Debounced push (1s) on local writes
  - Auto-reconnect (3s) on disconnect
- Sync hooks injected automatically into all collections via `createPayloadConfig`
- `LocalDBProvider` no longer blocks on initial replication (local-first: persisted data available instantly)
- `DocumentList` skips redundant API fetch when `localData` is provided
- Expo app configured with `wsURL: ws://localhost:3001`

### Phase 4 — UX improvements + Turbopack fix (2026-03-29)
- **Crypto polyfill**: Added `globalThis.crypto` polyfill using `expo-crypto` in `database.ts` — Hermes doesn't have `crypto`, but RxDB needs it internally for hashing
- **RxDB schema version bump** (0→1): Added `_locallyModified` field required new schema version; old SQLite tables caused silent init failures. Added try/catch retry in `database.ts` that removes + recreates collections on schema conflicts
- **App no longer blocks on local DB**: `AuthGate` only waits for auth check (instant from SecureStore), not for DB initialization. Screens show their own loading states while DB spins up
- **Sync progress UI**: `SyncProgressIndicator` component shows progress bar + "Syncing posts... 2/7 collections" on splash screen; `SyncToastBridge` fires toasts on sync complete/error
- **`LocalDBProvider` sync progress tracking**: New `syncProgress` context value with `{total, completed, current}`, optional `onSyncProgress`/`onSyncComplete`/`onSyncUpdate` callbacks
- **Collection card summary fields**: Gear icon (⚙) in list header opens bottom sheet field picker; selected fields display as label:value pairs on each card; persisted per collection in AsyncStorage
- **Native Picker for Select/Radio fields**: Replaced BottomSheet with `@react-native-picker/picker` for single-select and toggle chips for multi-select (`hasMany: true`); relationship fields still use searchable BottomSheet
- **RelationshipField improvements**: `useAsTitle` from schema for display labels; local-first search (queries RxDB, falls back to API); client-side filtering in picker
- **Link.Preview on document lists and relationship fields**: Long-press peek/pop (iOS) on list rows and selected relationship values
- **Root node_modules symlink restored**: Turbopack `root: monoRoot` requires `payload_expo_tauri/node_modules → test_app/node_modules` symlink to resolve transitive deps (`@floating-ui/react`, `clsx`) from `payload-main` packages. Deleting this symlink during cleanup caused `/admin` to crash. **Must not delete this symlink.**
- **Next.js instrumentation**: `apps/server/src/instrumentation.ts` starts WS sync server on port 3001 during Next.js boot

## Architecture changes since initial plan
- `payload_universal` is now an importable module; collections belong to the consuming app.
- `apps/server/src/payload.config.ts` defines collections locally and uses `createPayloadConfig`.
- Tauri desktop app uses the live Next dev server instead of a static export.
- `admin.components.Nav` now points to `apps/server/src/components/NativeNav` for a fully client-rendered sidebar.
- Local-first mobile architecture uses a custom SQLite storage (not the RxDB premium plugin). Evaluated Zero (Rocicorp) as an alternative but rejected due to no offline writes.

## Runtime setup
- `PAYLOAD_SECRET` and `DATABASE_URL` are read from `test_app/.env`.
- `apps/server/scripts/dev.mjs` loads env from repo root and `test_app/.env`.
- MongoDB default (local): `mongodb://127.0.0.1:27017/payload_universal_test`.
- MongoDB must be running: `brew services start mongodb-community`.

## Notable fixes applied
- Patched `payload-main` build scripts to work under Node 22 (globby import fix).
- Adjusted Payload UI dnd-kit type imports to avoid deep package paths.
- Added Tauri icon, build script, and devtools; switched dev URL to `127.0.0.1`.
- Added Tauri capability file to enable menu APIs on remote dev URLs.
- Updated dev script to avoid unnecessary rebuilds; Payload build only runs when artifacts are missing.
- Switched `@payload-universal/*` deps in test apps to `workspace:*` for live edits.
- Fixed RxDB `getRxStorageSQLite is not a function` error by replacing trial import with custom storage.
- Fixed RxDB DVM1 error (dev-mode schema validator) by removing `RxDBDevModePlugin` — our permissive schemas make it unnecessary.
- Fixed RxDB DB9 error (duplicate database) by tracking singleton instance + destroy-before-recreate.
- Fixed replication push sending RxDB internals (`_rev`, `_meta`, `_attachments`) to Payload REST API — now stripped before POST/PATCH.
- Rewired mobile create/edit screens from direct API calls to optimistic local-first writes via `useLocalMutations`.
- Fixed Hermes `Property 'crypto' doesn't exist` by polyfilling `globalThis.crypto` with `expo-crypto`.
- Fixed RxDB schema version mismatch (0→1) after adding `_locallyModified` field — added retry logic for collection schema conflicts.
- Fixed `DocumentList` making redundant API calls even when `localData` was provided.
- Fixed `useLocalCollection`/`useLocalDocument` returning `loading: false` prematurely when DB wasn't ready yet.
- Restored root `node_modules` symlink after cleanup broke Turbopack's transitive dependency resolution for `/admin`.
- Added `pnpm.onlyBuiltDependencies` to test_app/package.json for native build scripts.
- **Fixed critical push duplication bug**: client-generated IDs differ from Payload's MongoDB ObjectIds. Push handler now removes local doc and re-inserts with server-assigned ID after successful POST. Strips client `id` from body.
- Used legacy `Swipeable` instead of `ReanimatedSwipeable` — Reanimated worklets crash when combined with expo-router `Link` in the component tree.
- **Fixed "Language en not supported"** in admin-schema endpoint — used `req.payload.config` (already sanitized) instead of raw config closure that failed to re-resolve translations in compiled server chunks.
- **Fixed GestureHandlerRootView** early return in `_layout.tsx` that bypassed the wrapper during loading state.
- **Replaced Swipeable with Link.Menu** — both legacy Swipeable and ReanimatedSwipeable crash on iOS 26 with PanGestureHandler errors. Delete now uses native context menu.
- **Fixed CocoaPods UTF-8 crash** with Ruby 4.0 — added `LANG=en_US.UTF-8` to `~/.zshrc`.
- **Fixed `@expo/ui` SlotView crash** — pnpm workspace resolved `@expo/ui/swift-ui` from wrong version (55.0.6 instead of canary). Custom Metro `resolveRequest` pins all `@expo/ui/*` subpaths through `package.json` exports with `fs.realpathSync` for pnpm symlinks.
- **Fixed `@expo/ui` in Expo Go** — safe try/catch around `@expo/ui` imports in native registry; `SimpleOptionList` pure-JS fallback for select/radio when no native picker available.

### Phase 5 — Sync duplication fix + swipe-to-delete (2026-03-30)
- **Fixed critical duplication bug** (65,000+ duplicate posts created):
  - Root cause: client generates local ID, Payload ignores it and assigns its own MongoDB ObjectId on POST. Pull handler sees mismatched IDs → treats server doc as "new" → infinite create loop.
  - Fix: after successful POST, push handler removes old local doc (client ID) and upserts with server-assigned ID. Also strips client `id` from POST body so Payload cleanly assigns its own.
  - Also strips `_locallyModified` from push payload.
- **Swipe-to-delete** on collection cards:
  - Uses legacy `Swipeable` from `react-native-gesture-handler` (not `ReanimatedSwipeable` — crashes when combined with `Link.Preview` in worklet runtime)
  - Full-height delete button matching card height via `alignSelf: 'stretch'`
  - Full swipe triggers confirmation dialog (not instant delete)
  - Tap on revealed button also triggers confirmation dialog
  - `GestureHandlerRootView` wrapping root layout
- **Shake-to-undo** after delete:
  - Uses `expo-sensors` `DeviceMotion` to detect shake (threshold 1.5g)
  - Stashes deleted doc data in ref; shake re-inserts via `col.upsert()`
  - Toast "Deleted — shake to undo" / "Undo successful"
  - 2-second cooldown between shake detections

## Critical infrastructure notes
- **Root `node_modules` symlink** (`payload_expo_tauri/node_modules → test_app/node_modules`) is **required** for Turbopack. The `turbopack.root` is set to the monorepo root, and Turbopack resolves `@floating-ui/react`, `clsx`, and other transitive deps of `payload-main` through this symlink. **Do not delete it during cleanup.**
- **`.next` cache**: If Turbopack fails after config changes, delete `test_app/apps/server/.next` and restart.

### Phase 6 — @expo/ui native components + modular architecture (2026-03-30 → 2026-04-01)
- **@expo/ui integration** with cross-platform native component registry:
  - Metro platform file resolution: `native.ios.ts` / `native.android.ts` / `native.ts` (no runtime `Platform.OS` checks for component loading)
  - iOS: SwiftUI components (Toggle, DatePicker, Picker, DisclosureGroup, Text, Host)
  - Android: Jetpack Compose components (Switch, DatePicker, SegmentedButton, Text, Host)
  - Registry type extracted to `types.ts` (avoids circular imports from Metro platform resolution)
- **Field component upgrades** (6 field types → native):
  - CheckboxField: SwiftUI Toggle / JC Switch / RN Switch
  - DateField: SwiftUI DatePicker / JC DatePicker / custom wheel modal
  - SelectField: SwiftUI Picker (menu) / JC SegmentedButton / RNCPicker / SimpleOptionList
  - RadioField: SwiftUI Picker (segmented ≤5, menu >5) / JC SegmentedButton / same
  - CollapsibleField: SwiftUI DisclosureGroup / LayoutAnimation accordion
  - TabsField: SwiftUI Picker (segmented ≤5 tabs) / JC SegmentedButton / custom tab bar
- **Modular architecture refactor**:
  - Extracted shared `FieldShell.tsx` (was duplicated in inputs.tsx and pickers.tsx)
  - Created `fields/shared/` directory with barrel exports: FieldShell, nativeComponents, types
  - Removed all scattered `try { require('@expo/ui/...') } catch {}` from individual field files
  - All field files now import from `./shared` — single source of truth for native components
  - `NativeHost.tsx` simplified to use centralized registry
- **Expo Go compatibility**:
  - `@react-native-picker/picker` import wrapped in try/catch (native module not in Expo Go)
  - Added `SimpleOptionList` pure-JS chip-based fallback for select/radio fields
  - Three-tier fallback chain: @expo/ui native → RN native → pure JS
- **Critical Metro resolver fix** (`@expo/ui` version mismatch):
  - **Root cause**: pnpm workspace had two versions of `@expo/ui` — v55.0.0-canary (app's version, matching native binary) and v55.0.6 (from another workspace package). Metro resolved subpath imports like `@expo/ui/swift-ui` from the wrong version (55.0.6), which used `SlotView` — a native view that doesn't exist in the canary binary.
  - **Error**: `View config getter callback for component ViewManagerAdapter_ExpoUI_SlotView must be a function (received undefined)`
  - **Fix**: Custom `resolveRequest` in `metro.config.js` that intercepts ALL `@expo/ui` and `@expo/ui/*` imports, resolves them through the app's own `node_modules/@expo/ui` (using `fs.realpathSync` to follow pnpm symlinks), and reads `package.json` exports to map subpaths correctly.
  - **Key lesson**: In pnpm monorepos with multiple versions of the same package, Metro's default resolution can pick the wrong one. Singleton pinning must handle subpath exports, not just the root package name.
- **Admin schema endpoint fix** ("Language en not supported"):
  - Root cause: endpoint called `buildConfig()` on raw config inside handler; translations module couldn't resolve `en` language in compiled server chunk context
  - Fix: use `req.payload.config` (already-sanitized config from running Payload instance) instead of `getConfig()` raw closure
  - `buildAdminSchema` now detects already-sanitized configs via `i18n.supportedLanguages` check
- **GestureHandler fix**:
  - Root layout early return (`!ready`) bypassed `GestureHandlerRootView` — moved it to always wrap entire tree
  - Replaced legacy `Swipeable` (crashes on iOS 26 with PanGestureHandler error) with `Link.Menu` context menu delete action
  - Delete action now in iOS native context menu alongside "Open" (long-press peek/pop preserved)
- **EAS Build configuration**:
  - Created `eas.json` with profiles: development (device .ipa), development-simulator (.app), preview, production
  - Installed `expo-dev-client` for dev client builds
  - Enabled `NSAllowsArbitraryLoads` in Info.plist for dev builds (allows http:// to local server from physical devices)
  - Added build artifacts to `.gitignore` (*.app, *.ipa, build-*.tar.gz, build/)
  - `requireCommit: true` in eas.json CLI config to avoid casing check failures with uncommitted files
  - Successfully built and tested simulator .app and device .ipa via `eas build --local`
- **iOS 26 compatibility**:
  - Downloaded iOS 26.2/26.3 simulator runtimes (Xcode 26.3 requires matching SDK)
  - Fixed CocoaPods UTF-8 encoding crash with Ruby 4.0 (`export LANG=en_US.UTF-8`)
  - Added locale exports to `~/.zshrc` for persistence

### Phase 7 — Custom tab bar + long-press collection menu + dynamic icons (2026-04-02)
- **Custom tab bar** replacing `NativeTabs`:
  - Switched from `expo-router/unstable-native-tabs` (NativeTabs) to standard `Tabs` from `expo-router` with a custom `tabBar` component
  - Custom tab bar has BlurView background (`systemChromeMaterial`), proper safe area padding, hairline top border — matches native iOS tab bar look
  - Tab items: Home, Collections (with long-press menu), Globals (conditionally hidden), Account
  - Lucide icons for tab items (Home, LayoutList, Globe, User)
- **Long-press collection menu (iOS)** — Telegram-style folder picker:
  - Uses `@expo/ui/swift-ui` `Menu` component with `onPrimaryAction` for dual behaviour:
    - Single tap → switch to Collections tab (overview)
    - Long press → native iOS dropdown with all collections
  - Menu items use SF Symbol icons resolved dynamically from the schema
  - Ungrouped collections rendered as top-level `Button` items
  - `Divider` separates ungrouped from grouped
  - Grouped collections rendered as nested `Menu` submenus (collapsible/expandable)
  - Menu trigger label is a custom ReactNode (icon + text) wrapped in `Host` for SwiftUI rendering
  - Tapping a collection in the menu navigates directly to its document list via `router.navigate()`
  - Falls back to a plain Pressable on Android / when `@expo/ui` is unavailable
- **Dynamic collection icons** — full-stack icon system:
  - **Schema layer** (`admin-schema/src/index.ts`):
    - Added `icon?: string` to `MenuModel` collection and global types
    - `buildMenuModel()` reads `admin.icon` safely from Payload config via `(admin as Record<string, unknown>)?.icon`
    - Icon flows through `/api/admin-schema` JSON endpoint
  - **Server config**: Collections set `icon` in `admin` (with `@ts-expect-error` for Payload type compat):
    - Users → `'users'`, Media → `'image'`, Posts → `'file-text'`
  - **Icon registry** (`admin-native/src/iconRegistry.ts`):
    - 150+ lucide name → SF Symbol mappings covering people, files, commerce, data, maps, navigation, security, etc.
    - Lazy component registry: loads lucide-react-native components on first access by iterating known names and converting kebab-case to PascalCase
    - `getSFSymbol(name)` → returns SF Symbol string (default: `'doc'`)
    - `getIconComponent(name)` → returns React Native component (default: `null`)
    - `registerIcon(name, component, sfSymbol?)` → runtime extension point for app-specific icons
    - `isRawSVG(icon)` → detects raw SVG strings (starts with `<`)
  - **CollectionIcon component** (`admin-native/src/CollectionIcon.tsx`):
    - Accepts `icon?: string`, `size`, `color`
    - Renders raw SVG via `SvgXml` (react-native-svg) if icon starts with `<`
    - Renders lucide component by name lookup if found in registry
    - Falls back to lucide `File` icon
  - **Mobile app integration**:
    - Tab layout long-press menu uses `getSFSymbol(col.icon)` for native SF Symbol icons
    - Collections index cards show `CollectionIcon` alongside label
    - Dashboard collection cards show `CollectionIcon` alongside label
  - **Dynamic behaviour**: Change `icon` in Payload config → restart server → app refreshes schema → icons update. No app rebuild needed.
  - Exported from `admin-native`: `CollectionIcon`, `getSFSymbol`, `getIconComponent`, `isRawSVG`, `registerIcon`, `IconComponent` type

### Phase 8 — Join field native component (2026-04-02)
- **JoinField component** (`admin-native/src/fields/join.tsx`):
  - Renders a scrollable table of related documents from the joined collection
  - Driven entirely by Payload config: `collection`, `on`, `admin.defaultColumns`, `defaultLimit`, `defaultSort`, `where`
  - **Column configuration**: reads `field.admin.defaultColumns` from Payload config; falls back to `['id', 'createdAt', 'updatedAt']`
  - **Horizontal scroll**: each row is a horizontally scrollable `ScrollView` for wide tables on mobile
  - **Tappable rows**: wraps each row in `Link` / `Link.Trigger` / `Link.Preview` for native navigation and iOS peek/pop
  - **Sort by column**: tap column headers to toggle sort direction (ascending/descending); active column highlighted
  - **Pagination**: "Load more (N remaining)" button; respects `field.defaultLimit` (default 10)
  - **Pull-to-refresh**: `FlatList` onRefresh support
  - **Local-first queries**: queries RxDB with `{ [onField]: { $eq: parentDocId } }` selector; falls back to REST API
  - **REST API WHERE filter**: `{ [onField]: { equals: parentDocId } }` with polymorphic relationship support
  - **Pre-populated data**: uses server-provided `{ docs, hasNextPage, totalDocs }` on first render
  - **Empty states**: "Save this document to see related X" before first save; "No related X found" when no docs
  - **Polymorphic joins**: shows collection slug badges for multi-collection joins
  - **Cell formatting**: dates → locale string, booleans → Yes/No, objects → title/name/email/id, null → em dash
- **FormDataContext** added to `DocumentForm`:
  - New `FormDataContext` provides `{ formData, slug }` to nested field components
  - `useFormData()` hook for consuming context (used by JoinField to get parent document ID)
  - Context wraps the entire form tree (ErrorMapContext → FormDataContext → FieldRendererContext)
- **Type system updates** (`types.ts`):
  - Added `ClientJoinField` type with all Payload join config properties: `collection`, `on`, `defaultLimit`, `defaultSort`, `maxDepth`, `orderable`, `where`, `admin.allowCreate`, `admin.defaultColumns`, `admin.disableRowTypes`, `targetField.relationTo`
  - Added `'join'` to `NativeFieldType` union
  - Added `ClientJoinField` to `ClientField` union
- **Field registry**: `join: JoinField` registered in `fieldRegistry` (was previously falling through to FallbackField)
- **Exports**: `JoinField`, `ClientJoinField`, `FormDataContext`, `useFormData`, `FormDataContextValue` added to package exports

### Phase 9a — iPad responsive layout + relationship picker fix (2026-04-03)
- **Responsive layout refactoring** (`useResponsive.ts`):
  - `isTablet` now uses `Platform.isPad` on iOS for reliable detection even in iPadOS Split View
  - New `showSidebar` flag (replaces `isTablet` for layout switching): requires `width >= 1024`
  - iPad portrait → bottom tabs (no sidebar); only iPad landscape full-screen → sidebar
  - `contentWidth` computed as window width minus sidebar when visible
  - Grid columns based on content area width, not raw window width; max 2 cols with sidebar
  - New `isLandscape` property exposed
- **Relationship picker preview rework** (`pickers.tsx`):
  - Replaced native ScrollablePreview with pure-React inline preview inside BottomSheet
  - Removed `useScrollablePreview` import — no longer uses native context menu in BottomSheet
  - Long-press on picker row → `setPreviewItem(item)` → BottomSheet switches to inline DocumentForm
  - "Select" and "Back" action buttons in preview mode
  - **Fixes the UIKit crash** when native ScrollablePreview dismissed inside a BottomSheet Modal
- **iPad layout fixes**:
  - `_layout.tsx`: `isTablet` → `showSidebar` for sidebar/tab-bar decisions; `alignSelf: 'stretch'` on content container
  - `DocumentList.tsx`: added `width: '100%'` + `alignSelf: 'stretch'` to fill available width in sidebar layout
  - Screen files (`index.tsx`, `collections/index.tsx`, `globals/index.tsx`, `account.tsx`): replaced NativeWind `className` with inline `StyleSheet` for reliable iPad padding/layout; `flexGrow: 1` on contentContainerStyle
  - Sidebar item padding tightened (12→10); label gets `flex: 1` + `overflow: hidden`
- **Debug logging** added for development:
  - `BottomSheet.tsx`: console.log on visibility changes
  - `ScrollablePreviewView.swift`: NSLog for tap, preview open, action press, dismiss lifecycle
  - `pickers.tsx`: console.log for canPreview state

### Phase 9b — iPad responsiveness + drag-to-reorder (2026-04-03)
- **iPad window resize fix**: Added explicit `width`/`height` from `useWindowDimensions()` on root `GestureHandlerRootView` and admin layout container. `flex: 1` alone doesn't propagate iPad window size changes (Split View, Stage Manager) — explicit dimensions force native re-layout.
- **Grid cards**: Switched from pixel-width cells to flex-percentage grid (`flexBasis: '46%'`/`'30%'` + `flexGrow`) so cards resize naturally with container width.
- **Account screen centering**: Moved from `contentContainerStyle.alignItems: 'center'` to `alignSelf: 'center'` on inner View for reliable centering.
- **Sidebar icon alignment**: Changed `SidebarNavItem` Pressable from function-style `style` prop to explicit `<View>` wrapper for reliable `flexDirection: 'row'` layout.
- **Table view on tablet**: Document list renders horizontal table rows when `showSidebar` is true. Title (140px fixed), summary fields (`flex: 1` each), status pill (80px, drafts only), date (110px), chevron. `_status` excluded from summary fields when `hasDrafts` (prevents duplicate "Status" key).
- **Drag-to-reorder in summary fields picker**: Installed `react-native-reanimated-dnd` v2.0.0 + `react-native-worklets` v0.7.1.
  - **Buffered draft state**: Picker maintains local `draft` state; parent `summaryFields` + table only update on Save (✓ button).
  - **`onDrop` not `onMove`**: `onMove` is a no-op. State update deferred to `onDrop` which provides `allPositions` map. Updating in `onMove` causes Sortable full remount (hashes all IDs as React key), destroying animation mid-drag.
  - **No `@expo/ui` inside Sortable**: SwiftUI Image/Button crash inside reanimated-dnd gesture tree. Using lucide-react-native (`GripVertical`, `CircleCheck`, `Circle`, `Check`) instead.
  - **`react-native-worklets` 0.7.x only**: v0.8.x incompatible with Reanimated 4.2.x — Reanimated podspec validation fails on `pod install`.
  - **Save button**: Pressable circle (36px, primary color) with lucide `Check` icon. `@expo/ui Button` with `systemImage` only (no `label`) renders invisible — `Host matchContents` collapses to zero.
  - **Duplicate key fix**: Summary card grid uses field **name** as React key, not label (two fields can share label "Status").
- **Graceful fallback**: `react-native-reanimated-dnd` is optional-required in DocumentList.tsx (`try/catch`); without it, the picker renders a checkbox-only list.

### Phase 9c — Native iOS liquid glass UI + form nativization (2026-04-03)

**Stack.Toolbar (native header buttons):**
- `collections/[slug]/index.tsx` — Settings (`gearshape`), Filter (`line.3.horizontal.decrease`), Create (`plus`) as `Stack.Toolbar.Button` SF Symbols. Replaces JS-animated `HeaderIconButton`.
- `collections/[slug]/[id].tsx` — `Stack.Toolbar.Menu` (`ellipsis.circle`) with native menu actions (Versions, Publish, Unpublish) + Save (`square.and.arrow.down`). Replaces `DocumentActionsMenu` + Pressable on iOS.
- Android keeps `headerRight` with Pressables + lucide icons as fallback.

**GlassView containers (iOS 26+):**
- `_layout.tsx` sidebar: `SidebarNavItem` wraps in `GlassView isInteractive`. Active = blue `tintColor`.
- `index.tsx` dashboard: `CollectionCard` uses `GlassView isInteractive glassEffectStyle="regular"`.
- `account.tsx`: All cards + action buttons use GlassView. Action buttons have `isInteractive`.
- `login.tsx`: Sign In button uses `GlassView isInteractive` with dark tint.
- `structural.tsx`: Groups, collapsibles, array rows, block rows, add buttons all use GlassView containers.
- `DocumentForm.tsx`: Sidebar "Details" section uses GlassView.

**Native form fields:**
- `inputs.tsx`: Removed bordered input boxes. Now borderless with hairline bottom separator (iOS Settings style).
- `FieldShell.tsx`: Labels are small, uppercase, muted — iOS form section style.
- `structural.tsx` tabs: Uses native `Picker` with `pickerStyle('segmented')` + `glassEffect({ glass: { variant: 'regular', interactive: true } })`. `TabDepthContext` tracks nesting depth. All tab depths use segmented style.

**@expo/ui modifier functions:**
- **Critical fix**: Modifiers MUST use factory functions (`nativeComponents.pickerStyle!('segmented')`, `nativeComponents.tag!(String(i))`), NOT object literals (`{ pickerStyle: 'segmented' }`). Object literals are missing `$type` and get silently ignored by the native bridge. This was the root cause of tabs rendering as dropdown pickers instead of segmented controls.
- Added `glassEffect` to native component registry (`native.ios.ts`, `types.ts`).

**NativeHost changes:**
- `matchContents={false}` added as option — omits the prop from Host so it stretches to fill RN parent. May help touch hit-testing for interactive controls.

### Phase 9d — Picker selection fix + admin.width layout (2026-04-03)

**Fixed: Native Picker onSelectionChange not firing (Phase 1 — glassEffect)**
- **Root cause**: `glassEffect({ glass: { variant: 'regular', interactive: true } })` modifier applied directly to native `Picker` components created a competing gesture handler that consumed touch events before they reached the Picker's built-in selection handler. The visual press feedback worked (glass effect handled it) but `onSelectionChange` never fired.
- **Fix**: Removed `glassEffect` modifier from all native Picker components (TabsField, SelectFieldNative, RadioFieldNative). On iOS 26, `UISegmentedControl` and native Picker already have system-level liquid glass rendering — the explicit modifier was redundant.
- **Key lesson**: Do NOT apply `glassEffect({ interactive: true })` to SwiftUI controls that have their own gesture handling (Picker, Toggle, etc.). It creates competing touch handlers. Use `glassEffect` on container Views (GlassView) instead.

**Fixed: Native Picker STILL not tappable after glassEffect removal (Phase 2 — matchContents)**
- **Root cause**: `NativeHost matchContents={false}` omitted the `matchContents` prop entirely from the `@expo/ui` Host. This caused the Swift `HostViewProps` to default both `matchContentsHorizontal` and `matchContentsVertical` to `false`, meaning SwiftUI never reported its content size (e.g. ~32px for a segmented control) back to React Native. The RN frame collapsed to **zero height**. SwiftUI rendered the control visually (because SwiftUI rendering is NOT clipped by the UIKit frame), but UIKit's `point(inside:with:)` returned `false` for all touch points — the zero-height frame contained no touchable area.
- **Fix**: Changed all interactive Picker Hosts from `matchContents={false}` to `matchContents={{ height: true }}`. This tells SwiftUI to measure its content height and report it to React Native via `shadowNodeProxy.setStyleSize()`, giving the UIKit view a real frame that receives touches. Width is still controlled by RN layout (`alignSelf: 'stretch'`).
- **Updated `NativeHost.tsx`**: The wrapper now translates `{ width, height }` → `{ horizontal, vertical }` for `@expo/ui`'s Host API.
- **Affected components**: TabsField (segmented tabs), SelectFieldNative, RadioFieldNative — all three now tappable.
- **Key lesson**: `matchContents={false}` means "don't report ANY SwiftUI size to RN" — use `matchContents={{ height: true }}` when you need RN to control width but SwiftUI to control height. The visual rendering of SwiftUI is decoupled from the UIKit frame, so a zero-height frame LOOKS correct but BLOCKS all touches.

**`admin.width` field layout support:**
- **`groupFieldsByWidth`** helper added to `schemaHelpers.ts`: groups consecutive fields with `admin.width` into `width-row` groups. Fields without width remain individual entries.
- **`renderSubFieldsWithWidth`** helper in `structural.tsx`: renders sub-field lists with width-aware flex rows. Used by GroupField, CollapsibleField, TabContent, ArrayField, BlocksField.
- **DocumentForm** `renderFields` updated to use `groupFieldsByWidth` for top-level field layout.
- Width applied as `flex: parseFloat(adminWidth) / 100` — same proportional approach as RowField.
- `widthRow` style: `{ flexDirection: 'row', gap: spacing.md }` — matches RowField's `rowContainer`.
- Works at all nesting levels: top-level fields, inside groups, inside collapsibles, inside tabs, inside array rows, inside block rows.
- Exported: `groupFieldsByWidth`, `FieldWidthGroup` type from admin-native package.

**Test app demonstration** (Posts collection):
- Content tab: `row` with 60/40 split (contentFormat radio + language select)
- Top-level: two standalone fields with `admin.width: '50%'` (category + subcategory) — demonstrates `groupFieldsByWidth` auto-grouping
- SEO > Meta Tags collapsible: `row` with 70/30 split (canonicalUrl + noIndex checkbox)

### Phase 10 — Client-side validators and hooks (2026-04-03)
- **New package: `@payload-universal/client-validators`** — zero-dependency client-safe validators and hooks:
  - Ported all Payload built-in field validators from `payload-main/packages/payload/src/fields/validations.ts` without `req`, `t()`, `payload`, or Node.js dependencies
  - Supports: text (required/minLength/maxLength/hasMany), textarea, email (regex), password, number (min/max/hasMany), checkbox, date, code, json, select (option matching/duplicates), radio, point (lat/lng bounds), array (minRows/maxRows), blocks, relationship, upload, richText (empty content check)
  - English default messages matching Payload's translation keys; optional `t()` override for i18n
  - **`runValidation(fields, data, slug, config, operation)`** — walks the full client field schema tree (group, row, collapsible, tabs, array, blocks) and runs built-in + custom validators against form data; returns `{ valid, errors }` map compatible with `FormErrors`
  - **`runBeforeValidateHooks` / `runBeforeChangeHooks` / `runAfterChangeHooks` / `runAfterReadHooks`** — pipeline-style hook runners matching Payload's server-side execution order (collection-level → field-level)
  - **`ClientHooksConfig`** type: per-collection map of custom validators and hooks keyed by field path
- **`useValidatedMutations` hook** (`@payload-universal/local-db`):
  - Drop-in replacement for `useLocalMutations` that adds validation + hooks BEFORE writing to RxDB
  - Execution order: beforeValidate hooks → schema validation → abort if errors → beforeChange hooks → write to RxDB → afterChange hooks
  - Returns `{ create, update, remove, errors, clearErrors, clearFieldError }`
  - `create`/`update` return `{ success: true, id }` or `{ success: false, errors }` — validation failures never reach the DB
- **`ClientValidatorProvider`** context: holds the app's `ClientHooksConfig`, mounted in the root layout alongside `LocalDBProvider`
- **DocumentForm** updated:
  - New `onFieldEdit?: (fieldPath: string) => void` prop — called when user edits a field, so parent can clear validation errors incrementally
  - `errorCount` now includes both server errors and external (client-side validation) errors
  - Validation banner and per-field error display work identically for both server-side and client-side errors
- **Screen integration** (`[id].tsx` and `create.tsx`):
  - Switched from `useLocalMutations` → `useValidatedMutations` with `extractRootFields(schemaMap, slug)` for schema-driven validation
  - Validation errors passed to `DocumentForm` via `errors` prop; `clearFieldError` wired to `onFieldEdit`
  - On validation failure: errors display inline immediately (no network round-trip), form data is NOT written to RxDB
  - On success: data is written to RxDB instantly (local-first), sync pushes to server in background
- **Test app validators** (`src/validators/index.ts`):
  - Posts: auto-generate slug from title (beforeChange hook), slug URL-safe validator, friendly priority range message
  - Media: alt text minimum 3 characters for accessibility
  - All built-in constraints (required, min, max, minLength, maxLength, email regex) run automatically from schema metadata
- **Architecture**: validators/hooks are JavaScript functions bundled at build time via Metro (not serialized through the JSON admin-schema endpoint). Custom validators defined per-app in a client-safe module imported by the mobile app.

### Phase 11a — SwiftUI Form / Section / LabeledContent integration (2026-04-05)

**Native Form primitives from @expo/ui:**
- Added `Form`, `Section`, `LabeledContent` to the native component registry (`types.ts`, `native.ios.ts`)
- Also added `formStyle` and `listSectionSpacing` modifier factories
- `NativeFormContext` (boolean context) — set by DocumentForm when wrapping in a native SwiftUI Form. FieldShell checks this to decide between `LabeledContent` (native) and custom `View` layout (fallback).

**DocumentForm wraps in native SwiftUI Form (when compatible):**
- `canUseNativeFormForFields(fields)` recursively checks whether all field types (including nested sub-fields in groups, tabs, arrays, blocks) are Form-compatible
- Incompatible types: `richText` (EnrichedTextInput — native UITextView conflicts with Form layout), `join` (FlatList + nested ScrollView conflicts with Form's List-based scroll)
- When compatible AND `nativeComponents.Form`/`Section` available → renders inside `<NativeHost><Form formStyle="grouped">...</Form></NativeHost>`
- Main fields wrapped in `<Section>`, sidebar fields in `<Section title="Details">`
- The Form provides its own scroll, separators, grouped table appearance, keyboard avoidance — no need for `Animated.ScrollView`
- Falls back to the existing RN ScrollView path when: Android, @expo/ui unavailable, OR field list contains incompatible types

**FieldShell uses native LabeledContent:**
- Inside a native Form (`useIsInsideNativeForm() === true`), inline-layout fields wrap their children in `<LabeledContent label="...">` — gives the exact iOS Mail/Settings "Label: [value]" row appearance for free
- Stacked-layout fields (textarea, code, JSON) skip LabeledContent (multiline content doesn't fit the inline pattern)
- Fallback path retains custom inline/stacked layout with hairline separators

**GroupField uses native Section:**
- Inside a native Form, named groups render as `<Section title="Group Name">` with proper iOS grouped-table section headers/footers
- Unnamed groups remain transparent passthrough containers

**CollapsibleField uses native Section with expand/collapse:**
- Inside a native Form, collapsibles render as `<Section title="..." isExpanded={expanded} onIsExpandedChange={setExpanded}>` — native iOS collapsible section with smooth animation
- Footer prop used for description text
- Outside a Form, falls back to DisclosureGroup (native) or chevron-animated Pressable (fallback)

**Always-native Form with per-field carve-outs:**
- `useNativeForm` is now purely a platform check: `!!(NativeForm && NativeSection)` — no per-collection opt-out
- `segmentFieldsForForm(fields)` splits the field list into compatible runs (one Section each) and carve-out singletons (own Section, NativeFormContext=false)
- `FieldRenderer` also applies carve-out wrapping for deeply nested incompatible fields (e.g. richText inside group inside tab)
- Incompatible types: `richText` (EnrichedTextInput — UITextView with own scroll), `join` (FlatList with nested ScrollView)

**Sidebar fields as iOS formSheet:**
- Sidebar fields no longer render inline below main fields
- A `Details ›` row opens a `<Modal presentationStyle="formSheet">` — native drag-to-dismiss sheet
- Sheet contains its own `<NativeForm><NativeSection title="Details">` for full native styling
- RHF state shared via React context — sidebar edits flow through the same Control instance

**Key lesson:** `zod ^3.25.76` caret range resolves to Zod v4 which is incompatible with Hermes (non-writable module properties). Pinned to `>=3.22.0 <4.0.0`.

### Phase 11 — Zod validation + React Hook Form integration (2026-04-03)

**Phase 1: Zod schema generation (`validation.ts`):**
- `payloadFieldsToZod(fields)` — converts `ClientField[]` to a `z.ZodObject` at runtime
- Supports all constraints: `required`, `min`/`max`, `minLength`/`maxLength`, `options` enum, email format, point tuples
- Structural recursion: `group` → nested `z.object`, `array` → `z.array(rowSchema)` with `minRows`/`maxRows`, `blocks` → `z.discriminatedUnion('blockType')`, `tabs` → named tab objects or flattened unnamed tabs
- `row` and `collapsible` are flattened (layout-only — children merge into parent shape)
- `validateFormData(fields, data)` — runs safeParse and returns flat `Record<string, string | undefined>` error map compatible with `FormErrors`
- Used by both the RHF resolver and the legacy fallback path

**Phase 2: React Hook Form at DocumentForm level (`usePayloadForm.ts`):**
- `usePayloadForm({ fields, defaultValues, onSubmit })` — creates an RHF `useForm` instance with a custom Zod resolver built from the Payload field schema
- `RHFFieldBridge` component — wraps `Controller` around `FieldRenderer`, keeping the existing `{ value, onChange, error }` interface. Each field gets its own Controller for per-field re-render isolation.
- Server errors injected into RHF state via `setError(path, { type: 'server', message })` — fields see them through `fieldState.error` without a separate error context
- `FormProvider` wraps the form tree so nested components can `useFormContext()` / `usePayloadField()`
- Returns `isDirty`, `dirtyFields`, `isSubmitting` for free

**Phase 3: Field-level useController (`usePayloadField` hook):**
- `usePayloadField({ control, name, defaultValue })` — thin wrapper around RHF's `useController`
- Returns `{ value, onChange, onBlur, error, isDirty, isTouched, ref }` — identical shape to what field components already consume
- Field components can opt in incrementally: call `usePayloadField` inside the component, fall back to props if null
- Exported from `@payload-universal/admin-native/form`

**DocumentForm refactored:**
- Delegates to `DocumentFormRHF` when react-hook-form is installed, `DocumentFormLegacy` otherwise
- Legacy path now also runs `validateFormData()` before submit (Phase 1 benefit even without RHF)
- `DocumentFormHandle.isDirty` exposed for "unsaved changes" prompts
- Zero API change for consumers — same `schemaMap`, `onSubmit`, `errors` props

**Dependencies:**
- `zod ^3.23.0` — production dependency (small, tree-shakeable)
- `react-hook-form ^7.54.0` — optional dependency. If not installed, everything falls back gracefully.

### Phase 12 — Full native rich text editing (2026-04-03)

**react-native-enriched integration** — native rich text editor replacing the plain-text fallback:
- `fields/richtext.tsx` rewritten: uses `EnrichedTextInput` (try/catch import, graceful fallback to plain-text TextInput)
- Bidirectional Lexical JSON ↔ HTML converters (`utils/lexicalToHtml.ts`, `utils/htmlToLexical.ts`):
  - Lexical → HTML: text format bitfields (IS_BOLD=1, IS_ITALIC=2, IS_STRIKETHROUGH=4, IS_UNDERLINE=8, IS_CODE=16) → `<b>`, `<i>`, `<s>`, `<u>`, `<code>`
  - Heading, paragraph, quote, list (bullet/number/check), link, autolink, upload, relationship nodes all mapped
  - HTML → Lexical: zero-dependency regex-based HTML parser (no JSDOM/cheerio); produces valid Lexical JSON that Payload accepts
  - `relationship` nodes ↔ `<mention indicator="@" data-payload='{"collection":"slug","id":"docId"}'>` round-trip
- **Data flow**: mount converts Lexical JSON to HTML → `defaultValue`; on blur/save: `ref.getHTML()` → `htmlToLexical()` → `onChange()`; debounced sync (600ms) during typing
- **Local-first**: rich text stored as Lexical JSON in RxDB, converted to/from HTML only in the editor; three-way merge on sync works at the field level (whole rich text field)

**Apple Notes-style formatting toolbar** (`fields/RichTextToolbar.tsx`):
- Two-row toolbar: inline (Bold, Italic, Underline, Strikethrough, InlineCode, Link, @Mention) + block (H1, H2, H3, Blockquote, CodeBlock, BulletList, NumberedList, CheckList)
- Glass effect via `expo-glass-effect` GlassView with fallback to semi-transparent background
- Each button reflects live `onChangeState` from EnrichedTextInput: `isActive` highlights, `isBlocking` dims/disables
- `keyboardShouldPersistTaps="always"` so toolbar taps don't dismiss keyboard
- Lucide-react-native icons (Bold, Italic, Heading1-3, List, ListOrdered, ListChecks, Quote, FileCode, Code, Link, AtSign, etc.)

**Document mention system** (`fields/MentionPicker.tsx`):
- `mentionIndicators={['@']}` on EnrichedTextInput triggers mention lifecycle
- `onStartMention` → shows MentionPicker BottomSheet
- `onChangeMention` → filters search results in real-time
- Queries ALL user-facing collections from local RxDB (with REST API fallback)
- Uses `menuModel.collections` from admin schema to discover collections, `useAsTitle` for display labels
- Results grouped by collection with `CollectionIcon` section headers
- `setMention('@', title, { collection: slug, id: docId })` completes the mention
- Also accessible via native context menu item ("Mention Document")

**Link support**:
- Toolbar Link button opens `Alert.prompt` (iOS) with Insert/Update/Remove actions
- `onLinkDetected` populates existing URL for editing; `onChangeSelection` tracks selection range
- `setLink(start, end, text, url)` / `removeLink(start, end)` use correct enriched API

**HtmlStyle theming**: headings (28/22/18pt bold), blockquote (border accent), codeblock (dark background), inline code (pink on gray), links (primary color), mentions (primary with 12% tinted background)

**Dependencies**: `react-native-enriched ^0.5.2` installed in the mobile app's `package.json` + added as optional peer dependency of admin-native (New Architecture/Fabric only, requires dev client build with `expo prebuild --clean`)

**Fabric/Bridgeless integration — hard-won lessons (2026-04-04)**:

The `react-native-enriched` package uses `codegenNativeComponent('EnrichedTextInputView', { interfaceOnly: true })` — a Fabric-only component with no Paper ViewManager fallback. This required solving three interlocking problems:

1. **Codegen Babel plugin crash**: `@react-native/babel-plugin-codegen` (which should transform `codegenNativeComponent()` into an inline JS view config at bundle time) crashes with `Cannot read properties of null (reading 'loc')` on RN 0.83's internal `VirtualViewNativeComponent.js` files due to `@babel/traverse` 7.29 incompatibility. **Cannot use this plugin.**

2. **pnpm duplicate react-native instances**: pnpm hoisted 5 separate copies of `react-native` (0.83.0 and 0.83.1 with different peer dep combinations). The fallback `codegenNativeComponent` function calls `register('EnrichedTextInputView', callback)` on one copy's `ReactNativeViewConfigRegistry.viewConfigCallbacks` Map, but React's renderer calls `get()` on a different copy's Map → callback is `undefined` → invariant violation. **Fix: Metro singleton resolver extended to pin `react-native/*` deep imports** (not just bare `react-native`) via `require.resolve(moduleName, { paths: [projectRoot] })` in `metro.config.js`.

3. **Bridgeless UIManager returns null for interfaceOnly**: Even with singleton resolution, the fallback `codegenNativeComponent` path calls `UIManager.getViewManagerConfig('EnrichedTextInputView')` which returns `null` in Bridgeless mode (no Paper ViewManager for `interfaceOnly: true` components). The lazy view config callback then returns null → invariant at render time. **Fix: monkey-patch `UIManager.getViewManagerConfig` before `require('react-native-enriched')` to return a valid `{ Commands, NativeProps }` config** matching the component's NativeProps interface from the Codegen spec.

**Critical rules for Fabric-only native components in pnpm monorepos**:
- `@react-native/babel-plugin-codegen` may crash on newer @babel/traverse — don't add it globally
- Metro singleton resolver MUST pin both `'react-native'` AND `'react-native/*'` deep imports — the default only pins the bare import
- `interfaceOnly: true` components NEED a UIManager.getViewManagerConfig shim in Bridgeless mode when the Codegen plugin can't run — the fallback `requireNativeComponent` path can't work without it
- `fs.realpathSync` on pnpm symlinks resolves to `.pnpm/` store paths outside Metro's watchFolders → use `require.resolve(moduleName, { paths: [projectRoot] })` instead
- The native binary can have all Fabric C++ symbols compiled in (ComponentDescriptor, ShadowNode, Props, EventEmitter) while the JS side completely fails — always verify BOTH C++ symbols (`strings` on binary) AND JS view config registration
- `RichTextErrorBoundary` catches render-time invariant violations, but in DEV mode React shows the red screen BEFORE the boundary processes — not useful for dev builds

### Phase 13 — Local DB reset & live sync progress (2026-04-03)

**Delete local DB & re-sync without app restart:**
- `resetLocalDB(storage)` in `database.ts` — destroys running instance, calls `removeRxDatabase()` to wipe persisted SQLite, resets singleton
- `resetAndResync()` exposed via `LocalDBProvider` context — tears down DB, wipes storage, resets all state, bumps `initVersion` to re-trigger the init effect automatically
- `useLocalDBStatus()` now returns `resetAndResync` function and `isResetting` flag
- Account screen "Delete Local Data & Re-sync" button with destructive confirmation alert
- Button disabled during active sync or reset

**Live sync progress (0-100%):**
- `SyncProgress` type extended with `percent: number` (0-100)
- Percentage calculated as `Math.round((completedCollections / totalCollections) * 100)`
- `SyncProgressBar` animated component on account screen: blue animated fill bar + "Syncing {current}..." label + percentage counter
- Disappears when sync completes (percent >= 100 and not syncing)
- `fontVariant: ['tabular-nums']` for non-jittering percentage display
- DB status line shows "{completed}/{total} collections synced" when idle

### Phase 14 — Codebase modularization (2026-04-03)

**admin-native/src/ reorganization** (highest impact — 13 files moved):
- `hooks/` — `useDocumentListFilters.ts`, `usePayloadForm.ts`
- `contexts/` — `CustomComponentContext.tsx`, `FormDataContext.ts`, `PreviewContext.ts`, `ScrollablePreviewContext.tsx`
- `utils/` — `api.ts`, `schemaHelpers.ts`, `filterOperators.ts`, `validation.ts`, `iconRegistry.ts`
- `theme/index.ts` — renamed from `theme.ts` (directory index pattern, so `from './theme'` still resolves)
- `types/index.ts` — renamed from `types.ts` (same pattern)
- Root retains UI components: `BottomSheet`, `CollectionIcon`, `DocumentActionsMenu`, `DocumentForm`, `DocumentList`, `FieldRenderer`, `FilterBottomSheet`, `FilterChips`, `PayloadNativeProvider`, `SyncStatusCard`, `SyncStatusSection`, `Toast`, `VersionDiff`, `VersionsBottomSheet`, `WebViewFieldBridge`
- `fields/` subdirectory unchanged (already well-organized with `shared/`)

**local-db/src/ reorganization** (9 files moved):
- `hooks/` — `hooks.ts`, `validatedHooks.ts`, `useUploadQueue.ts`
- `contexts/` — `ClientValidatorContext.tsx`, `LocalDBProvider.tsx`
- `sync/` — `replication.ts`, `syncReplication.ts`
- `utils/` — `schemaFromPayload.ts`
- `queue/` — `uploadQueue.ts`
- Root retains: `database.ts` (core entry point), `index.ts` (barrel)
- `storage/` unchanged

**Package exports preserved** — all external consumers (`@payload-universal/admin-native`, `@payload-universal/local-db`) use barrel `index.ts` or `package.json` subpath exports. No external import changes needed. Subpath exports updated in admin-native `package.json`: `./validation` → `src/utils/validation.ts`, `./form` → `src/hooks/usePayloadForm.ts`.

**Conventions established:**
- `hooks/` — React hooks
- `contexts/` — React context providers
- `utils/` — Pure helper functions, API clients, schema helpers
- `types/` — TypeScript type definitions (directory index pattern)
- `theme/` — Design tokens and theming (directory index pattern)
- `sync/` — Replication and sync logic
- `queue/` — Background job queues

**Zero new type errors** — all pre-existing errors remain unchanged, no import resolution failures.

### Phase 15 — RxDB robustness fixes (2026-04-03 → 2026-04-04)

**DB6/DB8/DB9 auto-recovery in `database.ts`:**
- DB6 (schema conflict): non-recursive retry — wipes DB with `db.remove()`, re-opens, re-adds all collections in same scope
- DB8/DB9 (duplicate database): `closeDuplicates: true` on `createRxDatabase()` — auto-closes stale instances. **`ignoreDuplicate: true` THROWS DB9 in non-dev builds** (it only works with RxDBDevModePlugin enabled)
- `db.remove()` used instead of `db.destroy()` + `removeRxDatabase()` — atomically destroys instance + wipes data + clears RxDB internal name registry

### Phase 16 — Responsive admin.width (2026-04-04)

- `FIELD_WIDTH_BREAKPOINT = 500` — below this, `admin.width` fields stack vertically
- `useCompactFields()` hook uses `useWindowDimensions().width`
- `renderSubFieldsWithWidth()` accepts `compact` parameter — when true, width-row groups render as stacked fragments instead of flex rows
- `RowField` switches between `rowContainer` (horizontal) and `rowContainerCompact` (vertical)
- `DocumentForm` (both RHF and Legacy) checks window width
- All structural fields updated: GroupField, CollapsibleFieldNative, CollapsibleFieldFallback, TabContent, ArrayField, BlocksField
- Matches Payload web admin `@include mid-break { width: 100% !important }`

### Phase 17 — Posts `summary` richText field (2026-04-04)

- Added `summary` richText field to Posts collection at top level (after slug, before tabs)
- `content` richText already exists in the Content tab
- Two richText fields for demonstrating EnrichedTextInput, toolbar, and Lexical JSON round-trip

### Phase 18 — EnrichedTextInput confirmed working (2026-04-04)

- **EnrichedTextInput renders on iPad** with full formatting toolbar
- Posts `summary` richText field visible at top level, `content` in Content tab
- Lexical JSON ↔ HTML conversion working: data round-trips through local RxDB
- UIManager shim + Metro singleton resolver + `closeDuplicates: true` = stable init

### Phase 19 — Glass effect toolbar + markdown shortcuts + images (2026-04-04)

**Native glass effect toolbar** (`RichTextToolbar.tsx`):
- Per-button `GlassView isInteractive` with `tintColor` for active state — native iOS liquid glass press feedback
- Outer container `GlassView glassEffectStyle="regular"` — frosted glass background
- Editor container also uses GlassView on iOS 26+
- Falls back to plain Pressable + semi-transparent View on older iOS and Android

**Notion-style markdown shortcuts** (block-level, triggered on space/enter):
- `# ` → H1, `## ` → H2, `### ` → H3
- `- ` or `* ` → bullet list, `1. ` → numbered list
- `> ` → blockquote, `[] ` → checkbox, `[x] ` → checked checkbox
- ` ``` ` + enter → code block
- Prefix auto-removed via async `getHTML()` + `setValue()` cycle after formatting toggle
- Detection via `onChangeText`: tracks `prevTextRef`, checks if exactly one char (space/newline) was appended, matches line-start patterns

**Image insertion** (local-first):
- ActionSheet: "Take Photo" / "Choose from Library" (via `expo-image-picker`)
- `ref.setImage(localUri, width, height)` for immediate inline display
- Background upload queued via `UploadQueueManager` targeting Media collection
- `onPasteImages` handles clipboard paste with same flow
- `ImagePlus` button in toolbar + "Insert Image" in native context menu

**Keyboard dismiss**:
- Listens for `keyboardDidHide` → blurs `EnrichedTextInput` + syncs focused state

### Phase 20 — Native table editor (2026-04-04)

**TableEditor component** (`fields/TableEditor.tsx`):
- Native grid of `TextInput` cells with hairline borders
- Header row toggle: bold text + subtle tinted background (via `headerState`)
- `+` buttons to add rows (bottom) and columns (right edge)
- `−` buttons beside rows and above columns for removal
- `GlassView` container + `isInteractive` action buttons on iOS 26+
- Minimum cell width 100px, horizontal scroll for wide tables
- Focused cell gets primary color border highlight

**Helpers exported**: `createEmptyTable(rows, cols)`, `getCellText(cell)`, `setCellText(cell, text)`, `addRow/Column`, `removeRow/Column`, `toggleHeaderRow`

**Lexical JSON round-trip**:
- `lexicalToHtml.ts`: table/tablerow/tablecell → `<table><tr><td>/<th>` with colSpan, rowSpan, backgroundColor
- `htmlToLexical.ts`: parses `<table>/<tbody>/<thead>/<tr>/<td>/<th>` back to Lexical table nodes with headerState, colSpan, rowSpan, bgColor
- `tableCellNode()`, `tableRowNode()`, `tableNode()` constructors

**Integration in richtext.tsx**:
- Lexical JSON split into text `ContentBlock`s and table `ContentBlock`s at mount time
- Tables rendered as separate `TableEditor` components below the `EnrichedTextInput`
- `mergeAndSave()` interleaves text nodes and table nodes back into one Lexical state on save
- Table insertion: `Table2` toolbar button → `Alert.prompt` for rows×columns (e.g. "3x4") → `createEmptyTable(rows, cols)`
- Table changes debounced and synced via the same `debouncedSync` path

**Note**: `react-native-enriched-markdown` (separate package) has GFM table RENDERING (read-only via `EnrichedMarkdownText flavor="github"`) but NOT editing. Our native `TableEditor` is needed for the editing use case. Nightly versions (0.5.0-nightly, 0.6.0-nightly) don't add table editing.

### Phase 21 — Toolbar redesign: single-row pill toggles (2026-04-04)

- Replaced two-row toolbar with single horizontal `ScrollView` of pill-shaped toggle buttons
- Multiselect: multiple pills can be active simultaneously (e.g. bold + italic + H2)
- Groups separated by hairline dividers: `B I U S <>` | `Link Image @` | `H1 H2 H3` | `Quote Code` | `• 1. ☑` | `Table`
- Each pill: circular 34px, `GlassView isInteractive` with `tintColor` on iOS 26+, filled `Pressable` fallback
- Active state: tinted glass (iOS 26+) or solid `t.colors.primary` fill with white icon
- Blocked state: 25% opacity
- Note: `@expo/ui` Picker with `pickerStyle('segmented')` is single-select only — can't be used for multiselect formatting toggles

### Phase 22 — SwiftUI Form adaptation for all field types (2026-04-04)

**NativeHost depth guard** (`NativeHost.tsx`):
- `NativeHostDepthContext` tracks Host nesting depth
- When `depth > 0 && insideNativeForm`, skips the Host wrapper
- Prevents Host-in-Host crashes for controls, pickers, tabs

**FieldShell stacked layout** (`FieldShell.tsx`):
- Inside native Form: skips container View and separator — Form provides its own chrome
- Inline layout already adapted (uses `LabeledContent`)

**Structural fields** (`structural.tsx`):
- `CollapsibleFieldFallback`: `NativeSection` with expand/collapse
- `RowField`: stacked inside Form (one row per field)
- `ArrayField`: `NativeSection` per item instead of GlassView wrappers
- `BlocksField`: `NativeSection` per block with type label

**DocumentForm conditional path**:
- `canUseNativeFormForFields()` recursively excludes `richText` and `join` (incompatible with Form)
- Compatible collections → SwiftUI Form (native iOS Settings/Mail grouped table rows)
- Incompatible collections → standard ScrollView fallback

**ControlGroup toolbar** (`RichTextToolbar.tsx`):
- @expo/ui ControlGroup + Button with `buttonStyle('glass')` + SF Symbol icons
- 6 groups: inline formatting, insert actions, headings, block formatting, lists, table
- 17 formatting items in native text selection context menu

**Native component registry additions**:
- `ControlGroup`, `Form`, `Section`, `LabeledContent`, `formStyle`, `listSectionSpacing`

## Current known gaps
- EnrichedTextInput rendering depends on UIManager.getViewManagerConfig shim + Metro singleton resolver for deep react-native imports. May need revisiting when RN 0.84+ fixes the Codegen Babel plugin.
- Tauri uses live Next dev server; static export strategy still TBD.
- Pre-existing TS errors in admin-native (React 19 `key`/`ref` prop changes, `expo-router` resolution from workspace) and admin-schema (Payload type mismatches) — cosmetic, do not affect runtime.
- Could switch from MongoDB to Postgres in future (compatible with current architecture).
- Debug console.log / NSLog statements in BottomSheet, ScrollablePreviewView.swift, and pickers.tsx should be removed before production.

### Phase 9 — ScrollablePreview native module + progressive blur header (2026-04-03)
- **ScrollablePreview native module**:
  - iOS: `ScrollablePreviewModule.swift` / `ScrollablePreviewView.swift` — custom `UIView` that blurs content as it scrolls
  - Android: `ScrollablePreviewModule.kt` / `ScrollablePreviewView.kt` — Jetpack Compose equivalent with blur effect
  - Exported via `expo-module-config.json` and TypeScript interfaces
  - `ScrollablePreviewView.tsx` wraps native module for RN usage; web fallback is no-op
- **ProgressiveBlurHeader** component:
  - Fixed-position header that progressively blurs as user scrolls down (iOS jelly scroll effect)
  - Integrates with native ScrollablePreview module for hardware-accelerated blur
  - Falls back to React Native opacity/scale animation on Android
  - Used in document detail/edit screens for visual polish
- **HeaderScrollContext**:
  - Provides scroll offset state to nested components
  - Enables blur effect coordination across header + content
- **DocumentList improvements**:
  - Optimized for native layout (horizontal safe areas, tab navigation)
  - Improved empty states and loading indicators
  - Better handling of long document lists with FlatList virtualization
- **BottomSheet improvements**:
  - Enhanced accessibility labels and touch targets
  - Better keyboard handling on iOS/Android
  - Improved animations and dismiss behavior
- **Dist build artifacts** added to version control (removed from tracking):
  - `.gitignore` updated to exclude `test_app/apps/mobile-expo/dist/`
  - Already-committed dist files removed via `git rm -r` to keep repo clean

### Phase 19 — Custom collection action buttons (2026-04-04)

**Custom action buttons for collection list and document edit views:**

- **Admin schema extension** (`admin-schema/src/index.ts`):
  - Added `NativeActionMeta` type: `{ key, label, icon?, destructive? }`
  - Added `listActions?: NativeActionMeta[]` and `editActions?: NativeActionMeta[]` to `MenuModel` collection entries
  - `buildMenuModel()` reads `admin.listActions` and `admin.editActions` from collection config (custom extension, like `icon`)
  - Action metadata flows through `/api/admin-schema` JSON endpoint to mobile clients

- **Action handler registry** (`admin-native/src/contexts/ActionContext.tsx`):
  - `ActionRegistryProvider` context — holds per-collection action handler functions
  - `useListActionHandlers(slug)` / `useEditActionHandlers(slug)` hooks — return `Record<key, handler>` for a collection
  - Action handlers are Metro-bundled code (like client validators) — not serialized through JSON
  - `ActionHandlerRegistry` type: `{ [collectionSlug]: { list?: Record<key, handler>, edit?: Record<key, handler> } }`
  - `ListActionContext` provides: collectionSlug, selectedIds, allDocs, localDB, baseURL, token
  - `EditActionContext` provides: collectionSlug, documentId, doc, localDB, baseURL, token

- **Codegen pipeline extended** (`tools/native-component-codegen/src/cli.ts`):
  - Discovers `admin.components.listMenuItems[]` and `admin.components.edit.editMenuItems[]` at collection level
  - New component types: `listActions` and `editActions` in `DiscoveredComponent`
  - Generates `listActions` and `editActions` sections in the custom component registry
  - Transformed web components available for complex action UIs (rendered in bottom sheet if needed)

- **Collection list view** (`[slug]/index.tsx`):
  - **Multi-select mode**: toggle via `Stack.Toolbar.Menu` "Select Items..." action
  - Circular checkboxes on each row in selection mode (blue when selected, gray outline when not)
  - Selection count displayed in the cancel action and action labels
  - **Selection action bar** at bottom: shows all list actions as tappable buttons + "Done" to exit
  - **Native menu** (iOS): `Stack.Toolbar.Menu` with `ellipsis.circle` shows custom actions as `Stack.Toolbar.MenuAction` items
  - **Android fallback**: `CheckSquare` icon toggles selection mode; actions shown in bottom bar
  - Action handlers receive `{ selectedIds, allDocs, localDB, ... }` context

- **Document edit view** (`[slug]/[id].tsx`):
  - Custom edit actions rendered as `Stack.Toolbar.MenuAction` items inside the existing `...` menu
  - Merged with built-in actions (Versions, Publish, Unpublish) — custom actions appear after built-in ones
  - `DocumentActionsMenu` extended with `extraActions` prop for Android/fallback rendering
  - Action handlers receive `{ documentId, doc, localDB, ... }` context

- **DocumentActionsMenu** updated (`admin-native/src/DocumentActionsMenu.tsx`):
  - New `extraActions?: ExtraAction[]` prop: `{ label, icon?, destructive?, onPress }`
  - Extra actions appended to the built-in action list
  - Works with both native SwiftUI Picker (iOS) and BottomSheet fallback (Android)
  - Menu appears even when `hasVersions`/`hasDrafts` are false — if `extraActions` has items

- **Test app actions** (`mobile-expo/src/actions/index.ts`):
  - Posts list: `bulkPublish` — patches selected docs to `_status: 'published'` in local RxDB
  - Posts list: `bulkArchive` — patches selected docs to `status: 'archived'` with destructive confirmation
  - Posts edit: `sharePost` — uses native `Share.share()` API with post title + excerpt + URL
  - Posts edit: `duplicatePost` — clones doc data, generates new ID, strips internals, inserts as draft copy

- **Server-side** (`Posts.ts`):
  - `admin.listActions` metadata: `[{ key: 'bulkPublish', label: 'Publish Selected', icon: 'arrow.up.doc' }, { key: 'bulkArchive', label: 'Archive Selected', icon: 'archivebox', destructive: true }]`
  - `admin.editActions` metadata: `[{ key: 'sharePost', label: 'Share Post', icon: 'square.and.arrow.up' }, { key: 'duplicatePost', label: 'Duplicate', icon: 'doc.on.doc' }]`
  - Web components: `BulkPublishAction` (listMenuItems) and `SharePostAction` (editMenuItems) for the web admin

- **Native component registry extended** (`fields/shared/`):
  - Added `Button`, `buttonStyle`, `controlSize`, `tint` to `NativeComponentRegistry` type and all platform files
  - iOS: loads `swiftUI.Button` + `modifiers.buttonStyle/controlSize/tint` from `@expo/ui/swift-ui`
  - Android: nulled out (no SwiftUI equivalent)
  - Selection bar uses `buttonStyle('borderedProminent')` for action buttons, `buttonStyle('bordered')` for Done
  - Destructive actions use `role="destructive"` (native red styling), normal actions use `tint('#007AFF')`
  - `controlSize('regular')` for consistent sizing
  - `NativeHost matchContents={{ height: true }}` — SwiftUI reports button height, RN controls width
  - Three-tier fallback: SwiftUI Button (iOS) → Pressable (Android/unsupported)

- **Component label extraction** (codegen):
  - During codegen, `extractActionLabel()` parses the web component AST to find button text content BEFORE the transform runs
  - Labels are attached to the generated registry as `{ component, label }` entries (not bare components)
  - Screen files merge component labels with metadata labels: `listActionEntries[i]?.label ?? action.label`
  - Component label takes precedence — single source of truth is the Payload custom component text
  - No duplicate label definitions needed: define text once in the web component, it flows to native buttons

- **Architecture**: action metadata (key, icon, destructive) serialized in admin schema → rendered as native menu items. Button labels extracted from custom components during codegen → used as SwiftUI Button label text. Action handlers are JavaScript functions bundled by Metro → matched by `key`. Follows the same pattern as client validators: define once in Payload config, implement per-platform.

### Phase 23 — Full native primitive sweep + comprehensive sample app (2026-06-10)

**Registry (fields/shared/):** Full verified @expo/ui canary surface registered on both platforms — 43 iOS SwiftUI components + 38 modifier factories documented in `types.ts`. Android Compose components with divergent APIs get distinct `JC*` keys (`JCPicker` options-based, `JCBottomSheet {isOpened,onIsOpenedChange}`, `JCSwitch`, `JCTextInput` uncontrolled/no-placeholder, `JCDateTimePicker`, `JCButton` children-not-label, `JCChip`, `JCAlertDialog`). Canary has NO ControlGroup/ConfirmationDialog/ScrollView. NativeHost follows system color scheme.

**DocumentForm:** new `nativeForm` prop (default true on iOS when all fields Form-compatible) re-enables single full-screen SwiftUI Form + `FormCrashBoundary`. **Rule: `nativeForm={false}` required in unsized containers** (formSheet/details/BottomSheet) — zero-height Form swallows touches. ui-field rendering fixed in FieldRenderer (custom components now render). New `ConditionContext` (slug→fieldPath→fn registry, fail-open) evaluates `admin.condition` against live form data; admin-schema emits condition markers + localization (`{locales,defaultLocale,fallback}|false`) + re-attaches `admin.hasCondition` and object-form `filterOptions`.

**Fields:** inputs — native TextField/SecureField/JCTextInput rows via uncontrolled text bridge (`fields/inputs/textBridge.ts`), Stepper for bounded ints, hasMany chips, autogrow textarea, code gutter, JSON validity, point validation. pickers/ split into select (JCPicker on Android, isClearable, hasMany chips+reorder), radio (JC radio variant), relationship (hasMany, polymorphic switcher, filterOptions→REST+mango, server search + load more, inline create via injected `onRequestCreate`), upload (thumbnails, browse-existing grid, document picker, hasMany strip, focal point editor). structural/ split into per-type files: tabs Android crash fixed + JC segmented; array row ContextMenu actions (move/dup/insert/remove) + collapse-all + RowLabel resolution (`RowLabelContext`; `useRowLabel` added to both ui shims, web rowNumber is 0-based rowIndex); blocks searchable picker sheet + blockName editing.

**Components:** BottomSheet — `detents` (`['medium','large']` or fractions), rubber-banding, velocity snap, keyboard handling, glass/blur/solid tiers (still JS Modal). DocumentActionsMenu — real SwiftUI Menu + SF Symbols + destructive roles (iOS), JC ContextMenu (Android). Toast — swipe-dismiss, 2-stack, glass. DocumentList — controlled sort prop + persistence, per-page + defaultLimit, "1–Y of Z" meta, ContentUnavailableView empty states (3 variants), FilterBottomSheet native DatePicker + relationship value picker + editable chips + multi-filter AND. New `hooks/useListColors.ts` dark palette — reuse everywhere. RichTextToolbar iOS native tier rebuilt without ControlGroup: GlassEffectContainer + HStack groups of glass Buttons (`buttonStyle('glass')`/`'glassProminent'`, bordered fallback when no liquid glass), SF Symbols, Divider separators; JS pill toolbar kept for Android/Expo Go.

**Server sample app:** new collections Pages (5 block types, named tabs, localized fields, autosave 1500ms), Products (code/json/point/hasMany/polymorphic relationship/filterOptions/ui field PriceSummary + exportProducts/archiveProduct action metadata), Events (timezone dates, all pickerAppearance variants, RowLabel array, condition-dependent fields); globals SiteSettings + Footer; Media imageSizes/focal/crop; Users useAPIKey/lock/role; en+es localization. Codegen ran: 11 components incl. products_priceSummary_Field, events_sessions_RowLabel, footer_links_RowLabel.

**App screens (mobile-expo):** API inspector (`[slug]/api` formSheet route + curlybraces toolbar action); locale switching (globe toolbar menu, `useLocaleEditing` dual-path: default locale local-first, non-default via REST `?locale=X`, locale-keyed form remount); autosave (`useAutosave` from `clientConfig.versions.drafts.autosave`, draft docs only — published docs excluded to avoid silent unpublish, "Saving…/Saved" pills); conditions registry mounted (`src/conditions/` + ConditionRegistryProvider); action handlers verified (`src/actions/`); relationship inline-create (`RelationshipInlineCreateProvider`); native sort toolbar menu (getSortableFields-driven, shares package's `list_sort:{slug}` key); account Preferences card (Appearance System/Light/Dark + admin language en/es via direct @expo/ui Host+Picker, `src/preferences.ts`); dashboard live RxDB counts (`useCollectionCounts`); registerIcon for layout-template/panel-bottom.

**Codegen:** `detectWebOnlyPatterns()` bails out BEFORE transform — web-only components (document/window/canvas/video/iframe/svg) emit a `WebViewFieldBridge` wrapper (placeholder HTML only; real bundling TBD) instead of broken RN code. `cleanStaleOutputs()` makes the output dir fully codegen-owned. Block-scoped registry keys (`pages.layout.hero.heading`) with unambiguous legacy aliases. Generator converts CSS border-side shorthand; transpiled `<button>`→Pressable still emits text-style props + raw string children (3 generated files hand-fixed, regen overwrites them).

**Glass + dark sweep:** NativeWind tokens (ink/paper/surface) converted to CSS variables with prefers-color-scheme dark block (mirrors useListColors dark palette) — every className flips in one change. All remaining static-light admin-native surfaces moved to useListColors (FieldShell, FormSection, DocumentForm pills/banners/InspectorPanel, VersionsBottomSheet/VersionDiff, SyncStatusCard now with GlassView tier, MentionPicker, join, richtext, TableEditor, controls, WebViewFieldBridge HTML). App screens: tab bar/sidebar/list/login/account/dashboard dark-aware; removed forced `colorScheme="light"` from Collections tab menu host.

**Reconcile + verify:** admin-native barrel exports all new symbols (SheetDetent, DocumentListSort, FilterApplyPayload, RowLabelContext, FieldShell, useListColors, ConditionContext exports). `@payload-universal/ui` resolution truth: pnpm symlink → `packages/ui` wins over metro extraNodeModules (`packages/payload-universal-ui` mapping is dead fallback). Non-strict tsconfig gotcha: `if (!x.success)` does NOT narrow boolean-literal unions — use `=== false`. **Final typecheck counts: admin-native 27 (was 40), mobile app 46 (was 63), server 66 (accepted), admin-schema 16 (accepted).** `npx expo export --platform ios --dev` bundles clean.

### Phase 24 — Telegram peek + bulk edit + zero TS errors (2026-06-11)

**Peek module rework (`modules/scrollable-preview`):** iOS rebuilt Telegram-style after reading Telegram-iOS sources (ContextGesture/PeekController/PeekControllerNode) — no UIContextMenuInteraction. Dedicated `.alert`-level UIWindow mirroring the host window (RN Modal teardown can't kill the overlay; `willMove(toWindow:nil)` tears down synchronously if the enclosing Modal closes mid-peek); RN Content reparented into a 16pt-continuous rounded shadowed container over blur+dim; spring morph from/to the trigger rect (UIViewPropertyAnimator 0.42s damping 0.8, medium impact haptic); interactive mode after finger-lift with native inner scrolling — the decisive fix is JS-side: Trigger resolves preview size (92%×65% default, `previewHeightFraction` new optional prop) via internal context, Content styles itself absolute at that exact size so Yoga matches the native frame. Native glass capsule action rows with pan-while-held highlight (12pt threshold) + lift-to-perform; backdrop tap / scroll-aware swipe-down (top-of-scroll gate, 140pt/900pt-s) / tap-fires-onPrimaryAction dismissal. Android brought to behavioral parity (full-screen Dialog, FLAG_DIM_BEHIND 0.55, rounded card preserving RN layout, pill action rows, content restored on dismiss/detach). JS API backward compatible.

**OR-group filters (admin-native):** `ActiveFilter.groupIndex` — AND within group, OR across, serialized `{ or: [{ and: [...] }] }`, single group degrades to flat AND (backward compatible). FilterBottomSheet gains OR-group overview step + AND/OR choice at value step (riding `onApply` with a `newGroup` flag — DocumentList untouched); chips cluster by group with 'or' divider. Operator matrix mirrors web `field-types.tsx`; comma-separated in/not_in on scalars. Local evaluator handles arbitrary or/and nesting (+`not_like`; empty `or` vacuous-true). Persisted per collection as `{ v: 2, groups }` under `list_filters:{slug}` with legacy flat reads (`hooks/useDocumentListFilters.ts`).

**Version diff upgrade:** dep-free `utils/diff.ts` (word-level LCS + perf guard, key-order-insensitive deepEqual, Lexical plain-text extractor, relationship label resolver). VersionDiff: inline word diffs for text-likes/code/json (dark-aware tints via useListColors); richText diffed on plain text with formatting-only note; array/blocks per-row diffs (Added/Removed/Changed badges, id matching, blockType-swap); relationship/upload label resolution; per-locale sub-rows; 'Changed fields only' toggle; group/tab prefixes. VersionsBottomSheet Autosave pill. Glass stays single-layer at the sheet.

**Bulk edit (app):** `src/components/BulkEditSheet.tsx` — web EditMany parity: field picker over bulk-editable root fields (skips richText/join/ui, structural containers, upload-hasMany, polymorphic rels, unique/hidden/readOnly, `admin.disableBulkEdit`) → FieldRenderer input (non-native-Form fallback in the unsized Modal) + Save/Save Draft/Publish when drafts enabled; per-doc patch merged over full stripped original via `useValidatedMutations.update`, live "Updating i of N", result toast. Selection mode now reachable for every collection (iOS Actions menu always rendered; Android CheckSquare unconditional); SelectionActionBar prepends 'Edit Selected'.

**Generic doc actions (`[id].tsx`):** `handleDuplicate` (clone, strip internals, ' (Copy)' title / '-copy' slug, draft reset, `validatedCreate`, navigate) + destructive-confirm Delete — iOS toolbar Actions menu and Android extraActions, after built-in drafts entries, before custom `editActions`. hasMany relationship selected rows peek a read-only DocumentForm (`nativeForm={false}` + PreviewContextProvider, lazy local-first + REST fallback, 'Remove' peek action) via `useScrollablePreview()` only; `useIsInsidePreview` (set by BottomSheet) prevents nested peeks; picker rows keep the pure-JS inline preview.

**Codegen generator fixed (transform.ts):** regen is now hand-patch-free — strip `type=` on button→Pressable; wrap raw-text children of converted containers in `<Text>`; MOVE text-only style props onto the Text wrapper; near-black/near-white literal text colors → `Platform.OS === 'ios' ? PlatformColor(...) : literal` (ternary, not Platform.select — generic locks to OpaqueColorValue); `background`→`backgroundColor`, `textDecoration`→`textDecorationLine`, unitless line-height baked to absolute; NavWrapper prop allowlist; native-shim compat casts. All 11 components regenerated; generated dir contributes zero TS errors; `_registry.ts` byte-identical, no stale outputs.

**Zero TS errors everywhere (was 27/46/66/16/27):** admin-native 0, mobile-expo 0, server 0, admin-schema 0, local-db 0, client-validators 0 (tsconfig created — was previously untestable). Key mechanisms: server tsconfig `paths` pins `payload`+subpaths to payload-main (kills dual-payload-instance TS2322 class); `createPayloadConfig` returns `Promise<SanitizedConfig>`; mobile tsconfig dedupes `react-native` + maps `@payload-universal/local-db` to a generated `.d.ts` snapshot at `types/local-db` (type-only, Metro bundles real source); admin-core block-reference null guards; admin-schema MenuModel label/i18n normalization, `BuildAdminSchemaArgs.config` widened to `Config | SanitizedConfig`; lexicalToHtml tablecell assertion; shared `AnyField`/`FieldOption` in client-validators consumed by local-db (dedup of 3 mirrors); rxdb v16 runtime corrections (`db.destroy()`→`db.close()`, guarded `pushNow?.()`, request-time token in UploadQueueManager, `RxReplicationState` from `rxdb/plugins/replication`); native-stack v7 `headerBackTitleVisible`→`headerBackButtonDisplayMode:'minimal'`. Zero new `@ts-expect-error`. Verified fresh 2026-06-11: all six targets exit 0; `npx expo export --platform ios --dev` bundles clean (25MB); baselines refreshed at `/tmp/baseline-admin-native.txt` and `/tmp/baseline-mobile.txt` (both empty).

### Phase 25 — On-device hotfixes (2026-06-11)

Four user-reported iPad dev-client bugs (device in dark mode), fixed at root cause by parallel agents, cross-verified:

**1. Native SwiftUI Form crash (Events, SiteSettings/Footer).** Symptom: instant native crash (no JS stack) opening exactly the collections whose whole field tree is "Form-compatible". Root cause: `useNativeForm = (nativeForm ?? true) && iOS && registry && !crashed && canUseNativeFormForFields(fields)` — collections without richText/join (Events; both globals) passed every gate and rendered one full-screen `NativeHost > SwiftUI Form`, which crashes natively on-device; `FormCrashBoundary` only catches JS render errors (`getDerivedStateFromError`), so the auto-fallback never fired. Posts/Users/Pages were "saved" by their richText carve-outs. Fix: the native Form path is now **opt-in only** (`nativeForm === true`) in both DocumentForm variants (RHF + Legacy); no screen opts in, so all collections take the JS FormSection path. Prime crash suspect for a future re-enable: raw RN views (relationship rows, array editors, upload pickers, Pressables) as direct children of SwiftUI Form/Section cells fighting UIKit self-sizing.

**2. "Maximum update depth exceeded" on the details sheet.** Root cause: `details.tsx` mounted DocumentForm with `initialData={(doc as …) ?? {}}` — `doc` starts null and every RxDB emission is a fresh `toJSON()` clone, so initialData had a NEW identity every render; RHF 7.72 re-stores live props on `control._options` each render, the per-render `{}` lived inside dirty tracking (`_getDirty()` vs empty defaults never matches), and on-device native control echoes (DatePicker fires `onDateChange` once at mount via onAppear; an empty DateField seeds `selection={new Date()}` — a different prop every render) kept re-arming the cycle. Fix: module-scope `EMPTY_DOC` constants (details.tsx, globals/[slug].tsx), a loading gate in details.tsx so the form mounts once with the real doc (also fixes a latent bug — RHF captures defaultValues at mount only, so sidebar fields previously stayed empty forever), and a deep-equal ref latch (`useStableInitialData`, reusing `utils/diff.ts` deepEqual) in the public DocumentForm wrapper so a new-but-equal object from ANY caller returns the same reference.

**3. Textarea auto-grow runaway ("collapsible goes berserk").** Root cause: padding double-count feedback — RN maps a multiline TextInput's padding to `UITextView.textContainerInset`, so `onContentSizeChange`'s height ALREADY included the 16px vertical padding, but the render added `+ 2×padding` again; while `scrollEnabled={false}` a UITextView's contentSize tracks `max(textHeight, bounds.height)`, so each applied (inflated) height echoed back bigger → +16px per cycle, with surrounding collapsible LayoutAnimation animating every step. Fix (`fields/inputs.tsx` TextareaField): padding moved to a wrapper View (input padding 0 — measured and applied heights share one coordinate space), min/max expressed in content space, clamp BEFORE storing, functional setState bailing on deltas ≤2px, render-time re-clamp for rotation. CodeField's width onLayout got a >1px jitter guard; JSONField audited clean.

**4. Missing/invisible save affordances + Users creation.** create.tsx had NO save control of any kind (DocumentForm renders no submit button — `submitLabel` is a dead prop; saving works only via the form ref from a header button, and create.tsx had no ref/headerRight). [id].tsx's iOS Save was an icon-only `Stack.Toolbar.Button` inheriting a near-invisible navbar tint, and the JS headerRight fallback was gated to non-iOS, so a toolbar failure left zero save UI. Fix: create.tsx headerRight buttons (Save Draft/Publish for drafts collections, Create otherwise) via a new DocumentForm ref; [id].tsx Save is a labeled text button (`variant="done"`) with explicit `useListColors` tints on every toolbar item; headerRight fallback renders whenever the experimental Stack.Toolbar API is unavailable. Auth collections (Users): password + confirm secure inputs (min 8, match), create POSTs directly to the Payload REST API (password hashing is server-side — local-first RxDB cannot create auth users), then `pullNow(slug)` before navigating.

**5. Dark mode incoherence (white cards/headers over dark palettes).** Root cause (verified empirically): the `@media (prefers-color-scheme)` CSS-variable path compiles fine but fails at RUNTIME — react-native-css-interop resolves `:root` vars and `dark:` variants against a private module-level `systemColorScheme` observable snapshotted once at bundle eval (`Appearance.getColorScheme() ?? 'light'`) and updated only by an Appearance listener that DROPS events while `AppState !== 'active'`; at dev-client launch the observable sticks on 'light' forever, while RN `useColorScheme()` (per-component subscription) correctly reports dark → mixed light/dark UI. Fix: `ThemeVarsProvider` in `app/_layout.tsx` supplies all `--color-*` tokens via NativeWind `vars()` derived from `useListColors` (inline vars beat rootVariables in css-interop's resolution order and re-render through ordinary React state); `preferences.ts` drives nativewind `colorScheme.set` so one switch moves RN palettes + vars + any remaining `dark:` variants; owned screens swept off `dark:` variants onto token classes (new tokens: line/danger/danger-bg/warn/warn-bg); ProgressiveBlurHeader/HeaderBackgroundFallback made scheme-aware (system blur/glass materials untouched — liquid glass stays first-class); headerTintColor palette-driven in both stack layouts.

**Verification (this phase):** all six typecheck targets fresh at ZERO (admin-native, mobile-expo, server, admin-schema, local-db, client-validators); `npx expo export --platform ios --dev` bundles clean (25MB); no screen passes `nativeForm={true}` (only explicit `false` in details.tsx, list preview, RelationshipInlineCreate); toolbar tints and dark-mode vars share the single source `useListColors`. Remaining: on-device retest (Events/globals open, details sheet, textarea growth, save buttons in both schemes, dark coherence).

### Phase 25b — Post-fleet UX round (2026-06-11)

Follow-up round after the Phase 25 hotfix fleet, same day:

- **Dirty-state checkmark Save + `onDirtyChange` contract.** `DocumentForm` gained `onDirtyChange?: (dirty: boolean) => void` (fires from RHF `isDirty`; resets to clean after successful submit via `keepValues`). `[id].tsx` Save is now a `checkmark.circle.fill` `Stack.Toolbar.Button` (`variant="done"`): blue + enabled while dirty, gray + `disabled` otherwise, explicit per-scheme `tintColor` from `useListColors` so it can never vanish (iOS convention — checkmark instead of a text label).
- **Unsaved-changes guard (`src/hooks/useUnsavedChangesGuard.ts`).** `usePreventRemove(dirty, cb)` from `@react-navigation/native` blocks back/swipe/dismiss while the form is dirty and shows a discard confirm. Intentional navigations (save, delete, duplicate) call `allowLeave()` first — a ref-based one-shot bypass consumed by the next removal attempt.
- **SwipeToDeleteRow (`admin-native/src/SwipeToDeleteRow.tsx`).** Swipe-left-to-delete for list rows / tablet table rows / array+blocks row cards. IMPLEMENTATION TIER: pure RN **PanResponder** (the BottomSheet/Toast/InspectorPanel pattern) — NOT RNGH: both legacy `Swipeable` and `ReanimatedSwipeable` crashed on iOS 26 in this app, and rows live inside the ScrollablePreview native trigger (UILongPress + UITap recognizers) whose interplay with RNGH native pans is unverified. Gesture coexistence is by construction: a horizontal pan exceeds the native recognizers' movement tolerance and fails them, vertical pans stay with the FlatList, clean taps still reach row handlers. iOS Mail behaviour (88pt snap-open action, 30%-width or flick-velocity full swipe → destructive confirm), single-open-row module registry (`closeOpenSwipeRow()` — screens gate their tap handlers with it), `canDelete={false}` + `onDeleteBlocked` for array/blocks minRows. MUST stay free of @expo/ui (lucide `Trash2` only). In `renderRow` it wraps OUTSIDE `ScrollablePreview.Trigger` so the revealed Delete never sits inside the trigger's recognizer subtree.
- **Native row quick-action Menu (`fields/structural/common.tsx` `RowActionsMenu`).** Array/blocks row actions (move up/down, duplicate, insert, remove) as a tap-to-open three-tier menu: SwiftUI `Menu` (registry, SF Symbols, destructive group below a `Divider`, disabled entries via the `disabled` modifier — omitted entirely when the factory is missing, never tappable no-ops) → JC ContextMenu → BottomSheet fallback.
- **API-sheet Stepper echo fix (`[slug]/api.tsx`).** The SwiftUI `Stepper` is UNCONTROLLED (`defaultValue` + `onValueChanged`; initial value latched once). The `depth` state must never be echoed back into native props (`defaultValue`/`label`) — the canary replays `.onAppear` echo events mid-update, which re-arms the Phase 25 item 2 render-loop class. Same applies whenever toolbar controls get recreated: their `.onAppear` echoes fire again.
- **Rich-text `<html>` envelope fix + corruption warning.** `wrapEditorHtml()` (`utils/lexicalToHtml.ts`) wraps all editor HTML in `<html>…</html>` — both react-native-enriched native implementations gate HTML parsing on exactly this wrapper (iOS `InputParser initiallyProcessHtml`, Android `startsWith("<html>") && endsWith("</html>")`). Bare fragments like `<p>…</p>` fail the check and are inserted as PLAIN TEXT — the editor displays raw HTML source and the next save corrupts the doc (HTML-as-text inside Lexical). Every `defaultValue`/`setValue` now goes through the wrapper; `normalizeRichTextValue` recovers previously-corrupted values ('<'-prefixed strings and JSON-stringified states are accepted shapes).
- **Peek dark-mode (`ScrollablePreviewView.swift`).** The overlay `UIWindow` now mirrors the host window's `overrideUserInterfaceStyle` at creation (RN's `Appearance` API sets the override only on windows that EXIST at that moment — a window created later defaults to unspecified) and re-mirrors in `traitCollectionDidChange` while a peek is open.
- **UIUserInterfaceStyle Light → Automatic.** `app.json` `ios.userInterfaceStyle: "automatic"` and `Info.plist` `UIUserInterfaceStyle = Automatic` — the previous `Light` pin forced light traits onto every native window regardless of the JS theme (root cause behind several "native surface stays light" reports). **Requires a new native binary** — the in-flight EAS build snapshot predates this change.

### Phase 26 — Kanban boards + shareable view/query presets (2026-06-11)

Four parallel agents (server / board / integration / presets), cross-verified the same day.

**Server (`test_app/apps/server`):**
- **Payload-native query presets enabled**: `enableQueryPresets: true` on Posts, Products, Events, Pages + root `queryPresets` config in `payload.config.ts` (empty access/constraints = Payload defaults: authenticated + onlyMe/specificUsers/everyone; labels 'Filter Preset(s)'). This auto-registers the hidden **`payload-query-presets`** collection (powers web-admin filter/column presets) — intentionally EXCLUDED from mobile sync by the `payload-` slug filter in local-db; mobile reaches it REST-only.
- **New `view-presets` collection** (`src/collections/ViewPresets.ts`) — slug does NOT start with `payload-`, so local-first RxDB sync includes it (sync hooks auto-injected by `createPayloadConfig`; sync endpoints run `overrideAccess:false` so access rules hold during sync). Read access mirrors query-presets semantics: owner OR `accessMode==='everyone'` OR (`'specificUsers'` AND user ∈ `sharedWith`); update/delete are OWNER-ONLY (simplified from Payload's per-operation constraints — noted in the collection JSDoc). `beforeChange` forces `owner = req.user.id` on create, keeps owner immutable on update, and always includes the owner in `sharedWith` for `specificUsers` (lockout prevention, mirrors Payload's users-array hook).
- **Kanban demo data**: `posts.status` gained `'review'` (now draft/review/published/archived — the actual pre-existing options were 3, not the rumored 4) with matching StatusDashboard pill/message entries; Products gained `lifecycleStage` select (concept/development/launched/mature/retired, default concept — `availability` stays a radio as the radio-field exercise); Events already had `eventType` (4 options). `payload-types.ts` + import map regenerated; server typechecks at ZERO.

**Board core (`admin-native/src/kanban/` — types / KanbanCard / KanbanColumn / KanbanBoard / index barrel):**
- Columns derive from a Payload select field via `buildKanbanColumns`: `columnOrder` subset first, missing options appended in option order, trailing "No <label>" null column for empty/unknown values always last; `hiddenColumns` drops columns entirely (docs in hidden columns are dropped from the board, NOT shunted to no-status; sentinel `NO_STATUS_COLUMN_VALUE = '__no_status__'` hides the trailing column). Colours from `columnColors` else `DEFAULT_KANBAN_PALETTE[optionIndex % len]` — stable by OPTION index, not display order.
- Horizontal snap-scrolling ScrollView of Droppable glass-tinted columns (312pt wide), each a vertical FlatList of `GlassView isInteractive` cards: 3pt status accent bar, bold title, DocumentList-convention label:value rows (`formatKanbanFieldValue`), dimmed `loadingDocIds`.
- Drag-drop via optional-required `react-native-reanimated-dnd` (try/catch require — DropProvider/Draggable/Droppable, `preDragDelay` long-press). Because column FlatLists clip on iOS, the board renders a **finger-following Animated drag-overlay copy** (real card hides, layout kept) sharing the lib's origin+translation space so collision detection matches the visuals. Edge-hover auto-scrolls one column per cooldown with drop-target re-measure after every scroll; user scroll locks mid-drag; taps gate during drag.
- Guaranteed fallback always present: ellipsis "Move to <column>" menu — registry SwiftUI `Menu` when NOT inside a Draggable (convention 3), lucide ellipsis + BottomSheet (Modal portals out of the gesture tree) when dnd wraps the card. `onLongPressCard` wires only when dnd is absent (drag owns long-press otherwise). Dark via `useListColors`, zero expo-router, zero data fetching — the screen injects `docs` + callbacks (renderRow pattern).

**Integration (`app/(admin)/collections/[slug]/index.tsx` + `src/hooks/useKanbanConfig.ts` + `src/components/KanbanCustomizeSheet.tsx`):**
- **Native view selector**: iOS `Stack.Toolbar.Menu` ('tablecells'/'square.grid.2x2', `isOn` checkmarks, separateBackground + Spacer) rendered as the FIRST right-toolbar group BEFORE the Actions menu — two sibling `Stack.Toolbar placement="right"` elements override each other via `unstable_headerRightItems`, so the group lives first INSIDE the single toolbar. Android: SquareKanban/Table2 lucide toggle before the header icons. Shown only when the collection has an eligible field (`isEligibleStatusField`: plain select `hasMany:false` with options, or radio with options; `admin.hidden` excluded). Persisted under `list_view_mode:{slug}` (`useListViewMode`).
- **Kanban mode** renders KanbanBoard from the same local-first RxDB docs: screen-hosted `useDocumentListFilters` (header search synced) + `applyWhereToDocs`, sorted with a comparator mirroring DocumentList's internal `sortDocs`. `onMoveCard` patches `{[statusField]: value}` via `useValidatedMutations.update` (optimistic, dimmed via `loadingDocIds`, validation/`_form` errors surfaced as toasts). `onPressCard` and the peek 'Open' action share a 600ms timestamp-guarded navigate (prevents double `router.push` from trigger + inner card Pressable). `renderCard` wraps cards in `ScrollablePreview.Trigger` with the same `DocumentForm(nativeForm=false)` peek as rows. FilterChips/FilterBottomSheet stay live above the board; selection mode + swipe-delete + bulk edit are TABLE-ONLY (switching to kanban exits selection).
- **KanbanCustomizeSheet** (BottomSheet medium/large): status-field picker (changing it resets order/visibility/colors), column visibility (Eye/EyeOff) + drag reorder (reanimated-dnd Sortable per memory-bank rules: noop `onMove`, `onDrop` allPositions, lucide-only, `useFlatList=false`, fixed heights), fixed trailing "No <status>" row, per-column colour via registry `ColorPicker` (null-checked, NativeHost matchContents, rendered OUTSIDE the Sortable trees) with 8-swatch DEFAULT_KANBAN_PALETTE fallback, card-fields multi-select + reorder; buffered draft flushed via onSave → `useKanbanConfig` (`kanban_config:{slug}`, AsyncStorage, corrupt-entry-safe).

**Presets (`src/hooks/useViewPresets.ts` + `src/components/PresetsSheet.tsx` + FilterBottomSheet):**
- **View presets** — `useViewPresets(slug)` does local-first CRUD on the synced `view-presets` collection: defensive owner/everyone/sharedWith filtering (server where-access already scopes the pull; local filter guards stale docs), json-convention sanitizing, KanbanConfig lift mapping (`hiddenColumns` has no server counterpart — DROPPED on lift, reset to `[]` on apply), owner-only mutations (UI never offers edit/delete on shared presets). `PresetsSheet` (BottomSheet medium/large): 'Save current as preset…', My/Shared sections with apply-on-tap rows (view-type icon, shared badge), registry-Menu row actions (Rename / Update from current / Share… / Delete), sharing UI (access segmented control + local-first searchable user picker).
- **Toolbar**: Presets entry in the view-selector group (iOS bookmark toolbar button with separateBackground; Android lucide Bookmark). Applying a preset sets view mode + board config + BOTH filter pipelines — the kanban screen-hosted hook directly, the table via a new epoch-bumped DocumentList prop.
- **Query presets** — FilterBottomSheet's overview step gains a Presets section listing `payload-query-presets` via REST only (admin-native `utils/api.ts` `payloadApi`, `where[relatedCollection][equals]=slug`): apply-on-tap converts Payload where → the sheet's OR-group model with inline notes for operators the local evaluator lacks; 'Save filters as preset…' POSTs `{ title, relatedCollection, where, columns }` in the canonical shape from payload-main's query-presets config.
- **Converters**: `whereToFilterGroups`, `filtersToWhere`, and `setFilterGroups` added to `useDocumentListFilters` and exported — shared by view presets and query presets.

**Verification (this phase, fresh):** all six typecheck targets at ZERO with the pinned tsc (admin-native, mobile-expo, server, admin-schema, local-db, client-validators); `npx expo export --platform ios --dev` bundles clean (26MB). Cross-checks: view-selector group renders before the Actions menu inside the single right toolbar; kanban gated on eligible select/radio presence; no expo-router imports in admin-native/admin-core (comments only — the pre-existing `packages/ui` / `payload-universal-ui` imports remain known debt); actual `@expo/ui` imports exist ONLY in `fields/shared/native.{ios,android}.ts` (registry); no @expo/ui inside Draggable/Sortable trees (KanbanCard downgrades via `insideDraggable`, CustomizeSheet's ColorPicker sits outside both Sortables); `view-presets` passes the sync filter (not in INTERNAL_SLUGS, no `payload-` prefix) while `payload-query-presets` is excluded and accessed REST-only. Remaining: on-device pass (drag-drop overlay tracking, edge auto-scroll, customize sheet reorder, preset sharing round-trip).

### Phase 27 — Native calendar views (2026-06-12)

Four parallel agents (native module / server / calendar core / integration+presets), cross-verified.

**Native module (`test_app/apps/mobile-expo/modules/calendar-view`)** — local Expo module mirroring the `scrollable-preview` reference structure (expo-module.config.json, ios/*.swift, src/ TS API). iOS-only: `"platforms": ["apple"]`; Android/web/Expo Go take the JS fallback path. **FIXED JS contract** (`src/index.ts`, module name `CalendarView`):
- `CalendarEvent = { id, title, start /*ISO*/, end? /*absent = point event: month dot / 30-min day block*/, allDay?, color? /*hex*/ }`
- `isNativeCalendarAvailable: boolean` — `requireNativeModule('CalendarView')` inside try/catch, so Expo Go AND dev clients built before this module exist resolve to `false` (components render an empty View; callers must check the flag).
- `NativeCalendarMonth({ events, selectedDate?, onSelectDate, onChangeVisibleMonth?, style? })` — HorizonCalendar month grid: horizontal paginated months, day cells with max-3 colored dots + multi-day range strips, selected-day pill + today ring, full dynamic-color dark mode with CGColor re-resolution (peek-module Swift pattern).
- `NativeCalendarDay({ events, date, onPressEvent, onChangeDate?, style? })` — CalendarKit DayView timeline: hidden header, horizontal swipe changes day → `onChangeDate`, event tap → `onPressEvent`, point events render as 30-min blocks, dark-aware event colors.
- `src/index.ts` uses `React.createElement` (no JSX — the contracted `.ts` path must compile); `src/index.web.tsx` no-ops.
- Swift parses props defensively (bad dates/ids skipped, never crashes) and prop updates are Equatable-diffed before `setContent`/`reloadData`.
- **Pods: `ExpoCalendarView.podspec` depends on `HorizonCalendar ~> 2.0.0` + `CalendarKit ~> 1.1.9` (both latest on CocoaPods trunk, iOS 15.1-compatible). REQUIRES A NEW EAS BUILD — pods install (and Swift compiles for the first time) only on the next build.** Autolinking discovery verified; no package.json change needed.

**Server (`test_app/apps/server`):** ViewPresets gained a `'calendar'` viewType option + `calendarSources` (json array of `{ id, label, startField, endField?, color }`, shown only when `viewType==='calendar'`) + `calendarDefaultMode` (select `'month'|'day'`, default `'month'`); access rules/hooks untouched. Demo data needed NO changes: Events already has the clean range pair `startsAt`/`endsAt` plus single-datetime `registrationDeadline`/`doorsOpen`/`programMonth`; Posts has `publishedDate` + the nested group pair `scheduling.scheduledPublish`/`scheduling.scheduledUnpublish` for the multi-source/dot-path heuristics. `payload-types.ts` regenerated.

**Calendar core (`admin-native/src/calendar/` — types / eventMapping / MonthGridFallback / DayListFallback / CalendarView / barrel, re-exported from the main barrel):** injection-friendly per the kanban pattern — no expo-router, no data fetching, the app's native module arrives ONLY via the `nativeModule` prop (typed locally as `CalendarNativeModule`; admin-native never imports from the app's modules/ dir), @expo/ui only through the registry (Month/Day switch reuses SegmentedIndexPicker's SwiftUI/JC/pill tiers), liquid glass via expo-glass-effect optional-require, all colors via `useListColors`, month swipe via PanResponder. **Source-mapping heuristics (`eventMapping.ts`):**
- `docsToCalendarEvents(docs, sources, useAsTitle)` → events with id `{docId}::{sourceId}` (recover via `calendarEventDocId` — split on the LAST `'::'`). Field values resolved via `getByPath` **dot-paths** (server convention allows nested fields like `'scheduling.scheduledPublish'`); ISO strings / epoch numbers / Date instances all accepted; missing/invalid start skips the (doc, source) pair; end-before-start swaps with a console.warn; date-only values (`YYYY-MM-DD`, parsed as LOCAL midnight) flag `allDay`; output sorted lexicographically on ISO start (= chronological).
- `pickDefaultSources(fields)` — two-pass so declaration order can't break pairing: pass 1 pairs `start*`/`starts*` prefixes with `end*`/`ends*` and `*From` suffixes with `*To` (case-insensitive) into range sources; pass 2 turns every remaining date field into a point-event source. Source ids are the start field's name (stable across config edits); labels derive from the name with the range marker stripped (`'startDate'`→'Date'), falling back to the field label; colors from `DEFAULT_CALENDAR_PALETTE` (= the kanban palette) by source index.
- Guards: `MAX_MONTH_CELL_DOTS = 3`, `MAX_MONTH_CELL_STRIPS = 2`, `MAX_EVENT_SPAN_DAYS = 62` (bad data can't explode date buckets); all date-key helpers are LOCAL-time `'YYYY-MM-DD'`.

**Integration (`[slug]/index.tsx` + `src/hooks/useCalendarConfig.ts` + `src/components/CalendarCustomizeSheet.tsx`):** calendar is the third list-view mode. View menu gains Calendar (SF `'calendar'`, `isOn` checkmark; Android header cycle button) shown ONLY when the collection has ≥1 date field — nested group/tab/row/collapsible date fields counted as dot-paths; persisted in `list_view_mode:{slug}`. Calendar mode renders admin-native's CalendarView from the SAME filtered/sorted local-first pipeline kanban uses (shared screen-hosted `useDocumentListFilters` + FilterChips + FilterBottomSheet); sources from `useCalendarConfig` (`calendar_config:{slug}`; `sources: null` = "not customised" → derive via `pickDefaultSources` so new date fields keep appearing); `nativeModule` injected directly from `'@/modules/calendar-view'`; `onPressDoc` through the existing `navigateToDoc` guard; `renderDocRow` wraps rows in the same `ScrollablePreview.Trigger` peek as kanban cards (`renderKanbanCard` renamed `renderDocWithPeek`). Selection mode + swipe-delete remain table-only. CalendarCustomizeSheet (gear in calendar mode, mirrors KanbanCustomizeSheet): buffered draft, Month/Day default-mode segmented row, drag-to-reorder sources (reanimated-dnd rules: no-op `onMove`, `onDrop` allPositions, lucide-only in Sortables, `useFlatList=false`), add/edit/remove sources with start/end date-field pickers + auto labels, registry SwiftUI ColorPicker with 8-swatch fallback.

**Presets extension:** `useViewPresets`/`PresetsSheet` support viewType `'calendar'` — `calendarSources`/`calendarDefaultMode` sanitized per the server json convention, lifted on every save with RESOLVED sources (never null — the local "derive defaults" sentinel has no server counterpart), CalendarDays row icon + 'Calendar' meta. Applying a calendar preset switches view mode, BOTH kanban+calendar configs, the session calendar-mode override, and both filter pipelines. **Contract-gap fix found during integration:** `docsToCalendarEvents` originally read only top-level keys while the server view-presets convention uses dot-paths — now resolved via `getByPath` (jsdoc updated).

**Verification (this phase, fresh):** all six typecheck targets at ZERO with the pinned tsc (admin-native, mobile-expo, server, admin-schema, local-db, client-validators); `npx expo export --platform ios --dev` bundles clean (26MB — the calendar module import does not break Expo Go/web bundling; web uses `index.web.tsx`). Cross-checks: calendar entry hidden for date-less collections (`calendarAvailable` gates the menu item, the mode list, AND `isCalendar`, so a stale persisted mode degrades to table); JS fallback path verified (try/catch `requireNativeModule` → `isNativeCalendarAvailable === false` → CalendarView renders MonthGridFallback/DayListFallback); no expo-router or app-module imports in payload_universal calendar code (comments only); podspec dependencies pinned; table-mode peek/swipe coexistence untouched (SwipeToDeleteRow still wraps OUTSIDE the trigger; kanban/calendar share `renderDocWithPeek` without swipe). Remaining: on-device pass after the next EAS build — HorizonCalendar/CalendarKit Swift compiles for the first time then (see UI_PARITY_AUDIT verification list).

### Phase 27b — Apple-style month bars + week mode (2026-06-12)

Refinement pass over Phase 27. Two parallel agents (swift / js) cross-verified. Fresh typechecks at ZERO across all six targets; Metro smoke export clean (26 MB, no resolution errors).

**Native module refinements (`modules/calendar-view/ios/`):**
- **Month bars (CalendarMonthView.swift):** Apple-Calendar-style titled event bars in the day cells for regular-width (≥ `CALENDAR_COMPACT_WIDTH` = 600 px) displays, replacing the dots+strips-only presentation. Global lane packer (earliest start first, longer span first — Apple's order) assigns each event a stable row (lane 0–2) for every day it covers so multi-day bars sit at the same height across all cells they span. Bars bleed ~2.25 pt past cell edges to visually join across the 4 pt horizontal day margin. Titles appear on the first visible day of each week run; continuation chevrons (‹/›) mark runs that wrap into the next row; events past lane 2 collapse into a per-cell "+N more" label. Single-day events render as compact labeled chips. `showEventBars` Bool? prop added to `CalendarViewModule.swift` (default true; compact width passes false from JS).
- **`calendarBlended(with:ratio:)` extension added** to `CalendarEventParsing.swift` — the bars renderer calls this for dynamic per-scheme title-color derivation; it was missing before this phase and would have caused a guaranteed compile error.
- **all-day handling (CalendarDayView / parsing):** date-only start ⇒ `allDay` inference added to `CalendarEventParser` (defense in depth — the JS mapping layer also sends `allDay`). All-day events normalized to whole-day DateIntervals (end date inclusive) so they appear in CalendarKit's all-day row on every covered day.

**Architecture decisions verified (source-level research):**
- `dayRangeItemProvider` overlays cannot host per-event titled bars: `Set<ClosedRange<Date>>` keying collapses duplicate ranges, range views can't coordinate lanes, and range items render BEHIND day items. Lane-packed `dayItemProvider` cells are the correct path (used here).
- CalendarKit 1.1.9: `isAllDay` routes events to the `AllDayView` header row; `findEventView(at:)` searches `allDayView.eventViews` first so taps reach the same `onPressEvent` chain.

**TS contract (`modules/calendar-view/src/index.ts` + `src/index.web.tsx`):** optional `showEventBars?: boolean` added to `NativeCalendarMonthProps` on both sides (backward-compatible; doc comments updated).

**Component layer refinements (`admin-native/src/calendar/`):**
- **Mode model extended to `'month' | 'week' | 'day'`**: week and day share the CalendarKit timeline surface; they differ only in the context header. Day is week's child mode.
- **Week mode** adds a `WeekStrip` (locale-aware Mon-start via `Intl.Locale` weekInfo, 7-day pill row with presence dots, chevron/swipe week paging) above the native day timeline whose horizontal swipe paging IS the week-mode scrollable-days surface. Two-way sync via `selectedDate` / `onChangeDate`.
- **Day mode** uses the same timeline with a single-date chevron header instead of the strip.
- **CalendarView.tsx**: toolbar segmented picker updated to Month/Week/Day; `compact` breakpoint (`CALENDAR_COMPACT_WIDTH`) drives `showEventBars` prop; JS all-day glass-chip strip renders ONLY in the fallback tier (`!nativeAvailable`); native tier passes all events unfiltered so CalendarKit's own all-day row handles them.
- **MonthGridFallback**: bars density matches the native spec — Apple-Calendar-style titled multi-day spanning bars with square continuation edges across week wraps, title on the first cell of each week run, tinted labeled single-day chips, per-cell "+N more" overflow; dots kept on compact.
- **eventMapping.ts**: stable `allDay` heuristic documented (date-only string OR midnight-ISO start AND end absent/also day-only ⇒ allDay, snapped to literal local midnight).

**App-layer fixes (`test_app/apps/mobile-expo`):**
- `sanitizeCalendarMode` now accepts `'week'` (previously day-else-month, silently downgrading any persisted 'week' entry to 'month').
- `CalendarCustomizeSheet` default-mode segmented row: Month / **Week** / Day.
- `ViewPresets.ts` `calendarDefaultMode` select: added `{ label: 'Week', value: 'week' }` option; `payload-types.ts` regenerated (`('month'|'week'|'day')|null`).
- `sanitizePreset` in `useViewPresets.ts` calls `sanitizeCalendarMode` which now passes 'week' through; `liftSnapshot` is value-agnostic.

**Verification:** admin-native 0, mobile-expo 0, server 0, admin-schema 0, local-db 0, client-validators 0 errors (pinned tsc binary); `npx expo export --platform ios --dev` 26 MB, clean. Swift remains compile-unverified until the next EAS build (no local pods). Highest-confidence previous risk (`calendarBlended(with:ratio:)` called but undefined) is now fixed.

### Phase 28 — DayView pod collision resolution + ship (2026-06-12)

- **EAS builds 3-5 failed** on an ObjC class collision: CalendarKit and HorizonCalendar both export an unprefixed `DayView` class. Xcode regenerates each Swift static-lib pod's PRODUCT modulemap at build time and appends the generated `.Swift` compatibility submodule — so suppressing header generation (build 4: dangling reference, "header not found") and stripping the Target Support Files modulemap (build 5: wrong file, Xcode regenerates) both fail. **Rule: never add two pods whose ObjC-visible class names collide; build-settings/modulemap workarounds do not stick.**
- Resolution: dropped the HorizonCalendar pod; month view is the feature-complete JS MonthGridFallback (titled spanning bars, chips, "+N more", dots on compact). CalendarKit keeps the native day/week timeline (all-day row via isAllDay). `NativeCalendarMonth` export is permanently null; CalendarView falls through automatically. **Build 6 (3283576c) FINISHED** — first good binary with the calendar module, peek dark mode, and UIUserInterfaceStyle Automatic.
- Same-night inline fixes: kanban static-hold peek disambiguation (release <8pt travel opens preview; drop path gated on the same measurement), DocumentForm sidebar edge tab on wide layouts (Notes-style glass grab-tab; toolbar sidebar button now phone-only), unsaved-changes guard restored to usePreventRemove on Metro-pinned @react-navigation singletons (expo-router resolved 7.1.28 vs app 7.2.2 — dual instance broke context AND native sheet bounce-back).
- Everything committed and pushed: `0eca960` (251 files).

### Phase 29 — Kanban PanResponder drag, calendar correctness, slide-over sidebar, seed (2026-06-12)

- **Kanban drag rewritten on PanResponder** (kanban/KanbanBoard.tsx): react-native-reanimated-dnd REMOVED from the board — its RNGH `Gesture.Pan().activateAfterLongPress()` loses native recognizer arbitration to column FlatLists nested in the horizontal ScrollView and never activates on device. New architecture: card Pressable long-press (250ms) → beginDrag (measureInWindow pick-up, overlay copy); board root carries a PERMANENT PanResponder whose onMoveShouldSetPanResponderCapture returns true only while dragging (the finger is already down — a late-mounted responder never receives it; the first move after beginDrag is claimed in capture phase, grant runs before the Pressable's terminate). Static release (<8pt) arrives via onPressOut (gated on dragHandedOffRef), moves via responder release — both funnel into idempotent finishDrag (dragActiveRef early-return) → preview vs column-frame hit-test (center point). Column frames re-measure on drag start/layout/scroll settle; per-column callback refs MUST be stable (inline arrows fire ref(null) on mid-drag re-renders and wipe the frame map). **Rule: for drag gestures inside nested scrollables, PanResponder + capture-phase handoff is the only tier proven on device.**
- **Landscape + button root cause**: iPadOS integrates an `automatic`-placement native search bar into the TRAILING nav-bar area in landscape — directly over the rightmost UIBarButtonItem (+), eating its taps. Fix: headerSearchBarOptions placement 'stacked' + the [id].tsx hasStackToolbar guard/headerRight fallback pattern on the list screen. **Rule: always pin searchBar placement 'stacked' on screens with right toolbar items.**
- **Calendar correctness**: month grid header/cells now share ONE column metric (styles.col flex:1 — the squished-grid bug also explained the apparent weekday misalignment; the Mon-start math was correct, with self-check comments added); initial selectedDate contract = todayDateKey(), never event-derived; INTERNAL_DATE_FIELDS (resetPasswordExpiration/lockUntil/createdAt/...) excluded from pickDefaultSources + new collectionHasCalendarDateFields gates eligibility (Users no longer offers Calendar). Legend chips = SwiftUI Toggle toggleStyle('button') + tint via registry (check-marked filled chips fallback); customize sheet gains a non-drag VISIBILITY section with native Toggle switches (@expo/ui never enters Sortable trees); CalendarSource.hidden persists through config + presets.
- **Calendar iPad design** (earlier same night): regular-width tier (>=768) — month split grid + 320pt glass day panel, full-width week strip band, day centered at 720pt, single glass header row (segmented + Today + legend).
- **Slide-over sidebar** (src/components/OverlaySidebar.tsx + (admin)/_layout.tsx): left-edge swipe opens a 300pt glass overlay sidebar when the docked sidebar is hidden; armed ONLY on tab roots (/, /collections, /globals, /account) so the iOS back-pop owns the edge on pushed screens; capture test on the content wrapper (a physical strip View would dead-zone row taps — RN does not pass unclaimed touches through siblings); panel claims |dx|>1.4|dy| drags for dismiss, velocity-projected release, rubber-banding; shared SidebarContent renders both docked and overlay.
- **Seed script** (apps/server/scripts/seed.mjs, `pnpm seed` / `--fresh`): users/media(sharp PNGs)/posts(12, all statuses)/pages(5, all blocks)/products(9, all lifecycleStages)/events(11, current+next month)/globals/view-presets(3 shared); env resolution identical to dev.mjs; timezone fields need sibling <name>_tz from Payload's IANA enum ('UTC' not in enum).
- All six typecheck targets remain at ZERO.

### Phase 29b — First-user lockout fix (2026-06-12)

- **Lockout class found**: wiping the DB then running `pnpm seed` created editor/viewer users into an EMPTY users collection — Payload then reports initialized and first-register (web create-first-user AND the mobile first-user screen) is locked with no known credentials. Seed now bootstraps `admin@example.com` / `payload-test-1234` (role admin) FIRST when zero users exist and prints a loud credentials box.
- **Mobile first-user detection made dynamic** (login.tsx): the screen now HYDRATES the persisted server URL on mount (previously it only wrote it — the init probe hit the hardcoded default URL and never saw the real server), re-checks `/api/users/init` on AppState foreground and after every failed login, so a reset server flips the screen to "Create Admin User" without restarting the app.
- Seeded credentials: admin@example.com (when bootstrapped) / editor@example.com / viewer@example.com — all `payload-test-1234`.

### Phase 30 — Gantt view (2026-06-12)

Three parallel work streams (shared scheduling extraction / gantt core / integration), cross-verified. Fresh typechecks at ZERO across all six targets; Metro smoke export clean (26 MB, no resolution errors).

**Shared scheduling extraction (`admin-native/src/scheduling/`):**
- Extracted the view-agnostic source/event layer out of `calendar/` into a new `scheduling/` module: `types.ts` (ScheduleEvent, ScheduleSource, ScheduleDoc, DEFAULT_SCHEDULE_PALETTE), `dateKeys.ts` (all local date-key + week math), `eventMapping.ts` (docsToScheduleEvents, pickDefaultSources, collectionHasScheduleDateFields, INTERNAL_DATE_FIELDS), `events.ts` (bucketing, formatting), `ganttScale.ts` (dayIndexFromKey, dateKeyFromDayIndex, createGanttScale, clampDateRange, DEFAULT_GANTT_PX_PER_DAY=48), `index.ts` barrel. `Calendar*` names and `docsToCalendarEvents`/`calendarEventDocId` etc. are re-exported as exact aliases; `calendar/index.ts` re-exports them so ZERO app-side imports changed. 17 passing runtime self-check assertions for the scale helpers.

**Gantt chart core (`admin-native/src/gantt/`):**
- `GanttChart.tsx`: horizontal ScrollView hosting [sticky TimeAxis (month band, day ticks, weekend shading, primary-tint today line) above a vertical FlatList of lane-packed row tracks] at full timeline width. Frozen 150pt glass title column as an absolute overlay whose `translateY` is synced to the FlatList scroll via `Animated.event` (native driver — no JS bridge on each frame). `getItemLayout` from pure row heights enables FlatList native windowing.
- **Infinite both axes**: time window = `[startKey, endKey]` (init: min(event starts, today)−14d … max(event ends, today)+30d, clamped ±366d auto, ±unlimited via edge-scroll). When scroll nears an edge (<7 day columns) the window extends by 60d; jump-free left-prepend achieved via `contentOffset` compensation in `onContentSizeChange` (adding days on the left shifts all x-coordinates — the offset is bumped by the same pixel delta before the next render).
- `TimeAxis.tsx`: month-name band + day-of-month tick row; today column accented; weekend columns subtly shaded.
- `types.ts`: GanttChartProps, GanttBarSpec, GanttRowModel, all rendering constants, `buildGanttRows` (lane packing; first-fit greedy, earlier start first), `initialGanttWindow`, `shiftIsoByDays`, `computeNextRange`.
- `GanttBar.tsx`: one bar (or 16pt point diamond) per source per doc. **Gestures are PanResponder-only** per Phase 29 conventions:
  - HANDLE RESIZE: dedicated 20pt zones at bar ends claim clearly horizontal `|dx| > 1.4|dy|` moves — no long-press required, direct capture.
  - BODY SHIFT: 200ms hold via Pressable `onLongPress` ARMS the drag (`armedRef`); the bar-root PanResponder claims the very next move in capture phase (the finger is already down — kanban hand-off proven on device); `handedOffRef` prevents double-fire from the racing Pressable `onPressOut` release path.
  - STATIC HOLD → PEEK: armed hold released with <8pt travel funnels to `onPreviewDoc` via `finishDrag` (idempotent — early-return `activeRef` guards both the responder release and the Pressable's termination-driven `onPressOut`).
  - `finishDrag` is IDEMPOTENT across all three release paths (responder release, responder terminate, Pressable onPressOut) via an `activeRef` early-return flag.
  - During any drag BOTH the outer horizontal ScrollView and the FlatList are scroll-locked via `onDragStateChange` → prevents frames drifting under the gesture.
  - Point sources (`!source.endField`) are shiftable (body drag) but NEVER resizable (edge responders guard on `bar.point`).
  - Ghost + snapped-dates tooltip during drag; day-snapped commits emit ISO datetimes preserving wall-clock time (via `shiftIsoByDays`, inversion-guarded by `computeNextRange`).
- All math comes from `../scheduling` — zero duplication. Glass via guarded `GlassView` with bordered fallbacks; all colors via `useListColors`; no new dependencies.

**Integration (app-side — `test_app/apps/mobile-expo`):**
- View selector: iOS Stack.Toolbar View menu gains 'Gantt' (`chart.bar.doc.horizontal` SF Symbol); Android/fallback header cycle includes `gantt` with lucide `ChartGantt`. Eligibility `ganttAvailable = calendarAvailable` (same `collectionHasCalendarDateFields` gate). Persisted via existing `list_view_mode:{slug}` key (ListViewMode union extended).
- `GanttChart` fed by the SAME `boardDocs` local-first filtered/sorted pipeline as kanban/calendar. Sources from `useGanttConfig` (`gantt_config:{slug}`, falls back to `pickDefaultSources`). `onPressBar` → existing `navigateToDoc` guard; `onPreviewDoc` → the shared `boardPreviewDoc` BottomSheet (kanbanPreviewDoc renamed generically). `onUpdateDates` → `handleGanttUpdateDates`: dot-path aware patch (nested paths rebuild their whole root key via `setByPath` seeded from the doc + patch-so-far so start+end under one nested group compose; RxDB `incrementalPatch` merges top-level keys only); point sources write only `startField`; uses `useValidatedMutations.update`; toasts on failure; tracks doc id in `movingDocIds → readOnlyDocIds` while in flight.
- `ganttOptions.rowSort` (dot-path, asc) overrides list sort for row order when set.
- `GanttCustomizeSheet` mirrors CalendarCustomizeSheet exactly (Sortable dnd reorder, lucide-only rows, native Toggle visibility section OUTSIDE the Sortable tree, registry ColorPicker + 8-swatch fallback). ZOOM segmented row S/M/L → 16/28/44 px-per-day replaces the calendar's mode row.
- Presets: `ViewPresetSnapshot` gains `gantt: GanttConfig` (resolved sources lifted); `liftSnapshot` writes `ganttSources` + `ganttOptions` (null fields omitted; both null → null json); `sanitizePreset` handles viewType `'gantt'` + `ganttSources` + `ganttOptions`; `presetToGanttConfig` converts a stored preset back to a `GanttConfig`; `PresetsSheet` shows `ChartGantt` row icon + 'Gantt' meta; `handleApplyPreset` targets `'gantt'` mode and applies the config.
- Server `ViewPresets.ts` extended: viewType `'gantt'` option; `ganttSources` json field (ScheduleSource-shaped, conditional on `viewType==='gantt'`); `ganttOptions` json field (`{ pxPerDay?, rowSort? }`, conditional); `payload-types.ts` regenerated.

**Verification (this phase, fresh):** all six typecheck targets at ZERO with the pinned tsc binary; `npx expo export --platform ios --dev` bundles clean (26 MB, no resolution errors); cross-checks: calendar still compiles against the moved scheduling module with unchanged app-side imports; no RNGH/reanimated-dnd or native long-press triggers in gantt/; gantt eligibility uses `collectionHasCalendarDateFields` shared helper; presets round-trip shapes match server `ganttSources`/`ganttOptions` fields.

### Phase 30b — Scrollable table, pin customization, scan-to-lookup (2026-06-12)

- **Table mode rewritten** (DocumentListTable.tsx): frozen 176pt title column BY CONSTRUCTION — each row is [pinned title | clipped window with an Animated track at -scrollX], all driven by ONE native-driver scrollX from the sticky glass header band's single real horizontal ScrollView (no overlay, no second list; swipe-delete/peek/selection contracts untouched because rows never actually scroll). Type-aware fixed column widths (no flex squeeze), tap-header-to-sort, unlimited columns ordered by the summary-fields picker. **Pin customization**: pinFirstColumn/stickyHeader props (defaults ON per design language rule 7), 'TABLE PINNING' toggles in List Settings, persisted 'table_pins:{slug}'.
- **Scan-to-lookup**: expo-camera (canary pin; POD — REQUIRES NEXT BINARY; current binary shows a guarded fallback state), ScanLookupSheet (peek-style glass overlay on phones / 360pt floating popup on tablets, front camera default + flip + torch, qr/datamatrix/ean13/code128/upc, 2s debounce), useScanLookup (override field 'scan_lookup_field:{slug}' then sku/code/barcode/serial/readableId/slug/useAsTitle/id heuristics, 4-pass local-first resolution). Toolbar: qrcode.viewfinder button FIRST in the single right toolbar (never a sibling placement="right" toolbar). found→navigate, multiple→picker sheet, none→toast + scanner stays open.
- GraphKit evaluated (static WIP SwiftUI charts) — inspiration only; design-language section added to 013 (charts/tables rules incl. @expo/ui Chart for static viz, table pin defaults).
- NEXT: SDK 56 migration (changelog read — expo-router drops react-navigation (codemod + usePreventRemove replacement!), RN 0.85, TS 6.0.3, iOS min 16.4, @expo/ui STABLE with universal components; one EAS build after).

## Commands
- Start everything: `pnpm -C test_app dev:all`
- Server only: `pnpm -C test_app dev:server`
- Tauri desktop: `pnpm -C test_app dev:desktop`
- Mobile (Expo Go): `pnpm -C test_app dev:mobile`
- Mobile (dev client): `cd test_app/apps/mobile-expo && npx expo start --dev-client`
- Install deps: `cd test_app && pnpm install`
- EAS build (simulator): `cd test_app/apps/mobile-expo && eas build --platform ios --profile development-simulator --local`
- EAS build (device .ipa): `cd test_app/apps/mobile-expo && eas build --platform ios --profile development --local`
- Install sim build: `xcrun simctl install booted PayloadUniversalMobile.app`

### Phase 31 — SDK 56 migration (2026-06-12)

Canary era is over. The app now runs on the first fully stable SDK 56 release.

**Version matrix (before → after):**

| Package | Before | After |
|---|---|---|
| expo | 55.0.0-canary-20260128-67ce8d5 | 56.0.11 |
| react-native | 0.83.1 | 0.85.3 |
| react | 19.2.0 | 19.2.3 |
| expo-router | 55.0.0-canary | 56.2.10 |
| @expo/ui | 55.0.0-canary → **56.0.17 stable** | pnpm dedupe removed 55.0.6 transitive copy too — ONE version now |
| expo-camera | 55.0.4-canary | 56.0.8 |
| expo-file-system | 55.0.4-canary | 56.0.8 |
| react-native-reanimated | 4.2.1 | 4.3.1 |
| react-native-worklets | 0.7.1 | 0.8.3 (pairing rule changed: reanimated 4.3.x peers on worklets 0.8.x) |
| react-native-screens | 4.20.0 | 4.25.2 |
| typescript (app-local) | 5.9.3 | 6.0.3 |
| jest-expo | 55.x-canary | 56.0.5 |
| @react-native-community/datetimepicker | 8.6.0 | 9.1.0 |
| @expo/metro-runtime | (stale canary auto-peer) | ~56.0.15 (explicit) |
| @expo/dom-webview | 55.0.2 (stale auto-peer) | ^56.0.5 (explicit) |

**Root cause of `expo install --fix` initially reporting "up to date":** `app.json` hardcoded `"sdkVersion": "55.0.0"` which made the tool validate against the SDK 55 manifest. Removed; sdkVersion is now inferred from the expo package version. A second `--fix` pass after removal aligned all remaining peers.

**expo-router / @react-navigation decoupling:**

SDK 56's expo-router no longer depends on `@react-navigation/*` as an external package — it vendors the navigation layer internally and exposes it at `expo-router/react-navigation` (public export entry). `@react-navigation/*` packages are fully gone from the dependency tree.

Codemod applied: `expo-codemod 56.0.4`, `sdk-56-expo-router-react-navigation-replace`. Rewrote all 7 files that imported from `@react-navigation/*` (6 screens using `useHeaderHeight` + `useUnsavedChangesGuard.ts`).

**`usePreventRemove` post-decoupling — NATIVE DISMISS PREVENTION IS INTACT:**
expo-router 56 vendors react-navigation at `expo-router/build/react-navigation` (public entry `expo-router/react-navigation`). Its `usePreventRemove` has an identical signature and identical native wiring: vendored `NativeStackView.native.js` sets `preventNativeDismiss` from `usePreventRemoveContext`'s `preventedRoutes`. Dirty-sheet swipe-down still bounces back on "Keep Editing". The `allowLeave()` one-shot bypass contract is untouched. **Zero changes were needed in the three consumer screens** — the hook API is unchanged.

**Metro pin end-state (metro.config.js):**
1. `@react-navigation/native` + `@react-navigation/core` pins **REMOVED** — packages are unresolvable, keeping the pins crashes Metro config load.
2. `react`/`react-native` deep-import singleton pins **KEPT** — pnpm multi-copy reality is unchanged under RN 0.85.
3. `expo-router` **ADDED** as a singleton pin — pnpm peer-hashing materializes a second physical `expo-router@56.2.10` inside `admin-native`'s node_modules; since the navigation context is now vendored inside expo-router, two copies = two contexts → "Couldn't find a navigation object" crash class. `@payload-universal/ui`'s native `Link` imports expo-router, making this load-bearing.
4. `@expo/ui` pin **KEPT** with updated resolver — stable's `package.json` exports entry is `src/universal/index.ts` (canary's was `src/index.ts`); the pin now resolves the root import correctly and all subpaths via the exports map (covers the new `@expo/ui/jetpack-compose/modifiers` require added for JC* modifier helpers).

**`@expo/ui` stable surface — registry changes (`fields/shared/types.ts` + `native.ios.ts` + `native.android.ts`):**

Re-enabled (were absent in canary, confirmed present in stable 56.0.17):
- `ControlGroup` (back in stable)
- `ConfirmationDialog` + `Trigger`/`Actions`/`Message` statics (new compound, 4 keys)
- swift-ui `ScrollView` (new key: `axes`/`showsIndicators`)
- 3 new modifier keys: `keyboardType`, `autocorrectionDisabled`, `onSubmit`
- `emptyRegistry` updated to include the 4 `ConfirmationDialog` keys (fixes pre-existing TS2739)

iOS contract changes (affects `NativeTextRow`, `NumberField`, `fields/inputs.tsx`):
- `TextField`/`SecureField` **lost** `defaultValue`/`onChangeText`/`onChangeFocus`/`keyboardType`/`autocorrection`/`onSubmit` → replaced by `onTextChange`/`onFocusChange` + modifier-based `keyboardType()`/`autocorrectionDisabled()`/`onSubmit()`. `placeholder` survived. Initial text now set via `ref.setText`.
- `Stepper` is now **controlled** (`value`/`onValueChange`) — epoch-remount echo guard deleted.
- `BottomSheet` (swift-ui): `isPresented` shape unchanged + new `onDismiss` + lazy-mounts (nothing renders until first open, unmounts after dismissal).
- `pickerStyle` gains `'navigationLink'` option.

Android JC* unifications (key names kept, zero consumer API changes):
- JC modifier helpers moved from `@expo/ui` root to `@expo/ui/jetpack-compose/modifiers` — **CRITICAL**: without the new require all 20 `jc*` helpers (including load-bearing `jcFillMaxWidth`) would be silently null. Metro `@expo/ui` pin now covers this subpath via the exports map.
- `Divider` → `jc.HorizontalDivider` (single Divider API removed)
- `JCSwitch` → adapter over UNIVERSAL `Switch` (value/onValueChange/label kept; variant/color/elementColors dead — checkbox is a separate component)
- `JCButton` → adapter over UNIVERSAL `Button` redesign (variant default|bordered|elevated→filled, borderless→text, outlined→outlined; string children→label; leadingIcon/elementColors/color dead — `AddRowButton` stays native minus its icon)
- `JCTextInput` → adapter over `jc BasicTextField` (`jc TextFieldRef` kept `setText`/`clear`/`focus`/`blur`; `textBridge.attachRef` pushes current value on native attach matching the iOS stable pattern for initial-value seeding; `defaultValue` dead)
- `JCBottomSheet` → adapter over UNIVERSAL `BottomSheet` (`isOpened→isPresented`, `onIsOpenedChange(false)→onDismiss`, `skipPartiallyExpanded→snapPoints(['full'])`)
- `JCChip` → adapter over per-variant AssistChip/FilterChip/InputChip/SuggestionChip with Label slot (`onPress→onClick`; icons/onDismiss dead)
- `JCIconButton` → adapter over IconButton/FilledIconButton/OutlinedIconButton
- `JCCircularProgress`/`JCLinearProgress` → `*ProgressIndicator` (`trackColor` now top-level)
- `JCRow`/`JCColumn` gain `{ spacedBy }` arrangements; `JCShape` gains `RoundedCorner`; `jcClip` contract changed (BuiltinShape config, not Shape JSX)
- `JCDateTimePicker`: unchanged (prop-for-prop; stable adds optional `elementColors`/`selectableDates`)

Permanently null — no compatible replacement (documented in registry, Android fields fall back to JS):
- `JCPicker` (options/selectedIndex picker removed; `SegmentedButton`/`RadioButton` are compound-slot APIs; universal `Picker` is menu/wheel only — not suitable for all existing uses)
- `JCAlertDialog` (slot-children redesign)
- Android `ContextMenu` (removed; `DropdownMenu` is the Material 3 replacement — would require a separate registry key)

**TS 6 / RN 0.85 errors fixed (mobile-expo target — 14 errors, all fixed for real, no suppressions):**
- `StyleSheet.absoluteFillObject` removed at runtime+types in RN 0.85 — 3 sites inlined to `{ position:'absolute', left:0, right:0, top:0, bottom:0 }`
- Dual `@types/react` 19.2.9/19.2.17 — deduped via tsconfig `paths` pin mirroring the existing `react-native` pin
- `Animated.ScrollView` ref cast made version-proof via `ComponentProps<typeof Animated.ScrollView>['ref']`
- `unknown`-typed JSX guards converted to ternaries
- `CalendarNativeModule` widened to `| null` matching the module's actual exports
- TS 6 new TS2882 side-effect-import check — satisfied with `css-env.d.ts` `declare module '*.css'`
- `@payload-universal/ui` shim's `setValue` made always-callable and `useDocumentInfo` `id` typed `string|number|undefined` — fixed at the root instead of in generated custom components

**Pod / iOS floor:**
- Both local podspecs (`calendar-view` AND `scrollable-preview`) bumped iOS 15.1 → 16.4 (scrollable-preview tvOS also bumped to 16.4) — SDK 56 minimum is iOS 16.4.
- **REQUIRES A NEW EAS BUILD**: the native binary must be rebuilt for the iOS 16.4 floor, expo-camera's updated camera pod, and the reanimated 4.3.1/worklets 0.8.3 native update.
- Local builds require Xcode 16.4+. The EAS cloud builder constraint is Xcode 26.4-compatible (`image: "latest"` in eas.json points to the cloud's current stable Xcode, which is 16.x series as of this writing; if Xcode 26.4 cloud support is needed, check EAS image availability before kicking a build).

**Other fixes:**
- `expo-file-system/legacy` import: the upload queue's two dynamic `import('expo-file-system')` calls switched to `'expo-file-system/legacy'` — SDK 56's main entry replaces `deleteAsync` and other legacy functions with stubs that THROW at runtime. The previous catch-block swallowing masked the failure; local files were never cleaned up after upload.

**expo-doctor:** 21 checks, 19 pass; 2 accepted findings:
- Same-version duplicate warnings (expo/expo-router/expo-asset 56.x in multiple pnpm peer-hash dirs) — structural to multi-workspace pnpm; Metro singleton pins enforce runtime correctness; native builds unaffected since versions match.
- Non-CNG warning (checked-in ios/android folders; app.json native props don't sync on EAS) — pre-existing project structure.

**tsc binary paths (CHANGED — see tooling-gotchas memory):**
- `mobile-expo` now typechecks with its OWN TS 6.0.3: `test_app/apps/mobile-expo/node_modules/typescript/bin/tsc`
- All other five targets keep workspace TS 5.9.3: `test_app/node_modules/typescript/bin/tsc`

**All six targets verified at ZERO post-migration.** Metro smoke: `npx expo export --platform ios --dev` succeeded (21 MB bundle, zero resolution errors).

### Phase 32 — Field chrome unification (2026-06-12)

**Goal:** Eliminate the two user-reported symptoms — (a) Media collection edit screen: multiple dividers around a single alt-text field; (b) label/control misalignment across field families — by implementing a single canonical row contract throughout `admin-native`.

**Contract constants (single source: `src/theme/index.ts`, re-exported from `src/fields/shared/index.ts`):**
- `CONTENT_INSET = 16` — left/right inset inside every FormSection card; FormSection's row wrapper owns it; field components add zero horizontal inset.
- `ROW_MIN_HEIGHT = 44` — min height of an inline row.
- `INLINE_ROW_GAP = 12` — gap between inline label and control.
- `STACKED_LABEL_GAP = 4` — gap between stacked label and input.

**Separator ownership:** FormSection is the ONLY separator owner — hairline (`colors.separator`) BETWEEN children only (never after last, never for single child), `marginLeft CONTENT_INSET`. Field components render ZERO `borderBottom` / hairlines of their own.

**Row families:**
- INLINE (checkbox/toggle, date, single select, stepper-number, relationship/upload value rows): `flexDirection row`, `minHeight 44`, label 15pt regular left, control right, `columnGap 12`.
- STACKED (text, email, textarea, code, json, point, hasMany chips): 11pt uppercase muted label + 4pt gap + 16pt input; textarea/code/json use fill-bg rounded-8 without borders.

**Owners / modified files:**
- `src/FormSection.tsx` — separator logic (React.Children filter + between-only rule).
- `src/DocumentForm.tsx` — `splitVisibleFieldsBySidebar` drops `admin.hidden` fields before section assembly (fixes Media pile-up: ~10 hidden upload fields excluded, leaving alt as single-child → one clean card).
- `src/fields/shared/FieldShell.tsx` — unified label/description/error chrome for both families.
- `src/fields/inputs.tsx` + `src/fields/inputs/NativeTextRow.tsx` + `src/fields/inputs/HasManyChips.tsx` — INPUT family conformed.
- `src/fields/controls.tsx` — checkbox/date CONTROL family conformed.
- `src/fields/pickers/{select,radio,relationship,upload}.tsx` + `src/fields/pickers/shared.tsx` — PICKER family conformed.
- `src/fields/structural/{common,group,collapsible,array,blocks,tabs}.tsx` — STRUCTURAL family conformed; `SubFieldRows` added to `common.tsx` for nested separator system.
- `src/fields/join.tsx` — removed decorative `borderWidth: 1` container border (carve-out owns internal hairlines per contract).
- `src/fields/richtext.tsx` — removed `borderWidth: 1` on `editorContainer` and `fallbackInput`; both now fill-bg rounded without borders; error indication via FieldShell only.

**Verification:**
- All six typecheck targets at ZERO: admin-native (TS 5.9.3), mobile-expo app (TS 6.0.3), admin-schema, client-validators, local-db, server.
- Metro smoke: `npx expo export --platform ios --dev` → 21 MB bundle, zero resolution errors.
- Separator regression grep: all remaining `borderBottomWidth`/`hairlineWidth` occurrences are contract-sanctioned (FormSection separator, SubFieldRows separator, sub-card borders in array/blocks, modal-internal sheet chrome).

**UI parity audit items resolved:**
- Media single-field section: alt-text field renders as one clean rounded card with zero internal dividers.
- Label alignment: all field families share the CONTENT_INSET grid via FormSection row wrapper.
- Dark mode: all field chrome uses `useListColors()` / `useInputColors()` — no hardcoded light-mode colours in row-plane styles.
