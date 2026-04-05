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
