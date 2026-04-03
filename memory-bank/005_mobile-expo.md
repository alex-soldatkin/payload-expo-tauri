# Mobile Expo plan

You will build an Expo admin app that uses NativeWind and a native UI layer.

Setup
- Base the setup on spacedrive-main/apps/mobile. See babel.config.js, tailwind.config.js, and nativewind-env.d.ts.
- Use Expo Router for file based routing on native. Next.js is web only and cannot run iOS or Android builds.
- Create a shared design token package and map it into NativeWind colors like spacedrive-main/apps/mobile/tailwind.config.js does with @sd/ui/style/colors.

Expo UI components
- Expo UI provides native components via Jetpack Compose (Android) and SwiftUI (iOS) under @expo/ui.
- The docs label Jetpack Compose as alpha and SwiftUI as beta.
- Use Expo UI only for targeted components where native platform UI is a must. Keep the main admin UI on React Native plus NativeWind for consistency across platforms.

Status (2026-03-30)
- apps/mobile-expo has auth gate, admin tab navigation, and local-first data layer.
- NativeWind configured; admin-native provides DocumentList, DocumentForm, FieldRenderer.
- Local-first architecture via RxDB + custom SQLite storage (no trial limits):
  - `_layout.tsx` creates `getRxStorageSQLite()` with Expo SQLite, passes to `LocalDBProvider`.
  - Schema changes auto-propagate: Payload config → admin schema → RxDB collections → SQLite tables + indexes.
  - Hooks: `useLocalCollection`, `useLocalDocument`, `useLocalQuery`, `usePendingUploads`.
  - Upload queue with retry logic via `UploadQueueManager`.
- PayloadNativeProvider handles auth (JWT), schema fetching, token persistence via SecureStore.
- Sync progress shown on splash screen (progress bar + collection counter); toasts on sync complete/error.
- Collection cards have configurable summary fields (gear icon → field picker → persisted in AsyncStorage).
- Link.Preview (iOS peek/pop) on document list rows and relationship field selected values.
- Link.Menu context menu on collection cards with "Open" and "Delete" actions.
- App no longer blocks on DB init — auth gate shows UI immediately, screens show own loading states.
- Polyfill `globalThis.crypto` with expo-crypto for RxDB compatibility on Hermes.

@expo/ui native component integration (2026-03-30)
- Installed `@expo/ui` (55.0.0-canary) and `expo-dev-client` for dev client builds.
- Created centralized native component registry using Metro platform resolution:
  - `fields/shared/native.ios.ts` — loads SwiftUI components from `@expo/ui/swift-ui`
  - `fields/shared/native.android.ts` — loads Jetpack Compose components from `@expo/ui/jetpack-compose`
  - `fields/shared/native.ts` — default empty registry (web/unsupported platforms)
  - `fields/shared/types.ts` — `NativeComponentRegistry` type (separate file to avoid circular imports)
- Field components upgraded to use native @expo/ui with three-tier fallback:
  - CheckboxField: SwiftUI Toggle (iOS) / JC Switch (Android) / RN Switch (fallback)
  - DateField: SwiftUI DatePicker / JC DatePicker / custom wheel modal (fallback)
  - SelectField: SwiftUI Picker / JC SegmentedButton / @react-native-picker or SimpleOptionList (fallback)
  - RadioField: SwiftUI Picker segmented / JC SegmentedButton / same fallback
  - CollapsibleField: SwiftUI DisclosureGroup (iOS only) / LayoutAnimation accordion (fallback)
  - TabsField: SwiftUI Picker segmented / JC SegmentedButton / custom tab bar (fallback)
- `NativeHost.tsx` wrapper bridges @expo/ui Host for both platforms.
- Extracted shared `FieldShell.tsx` (was duplicated in inputs.tsx and pickers.tsx).
- `@react-native-picker/picker` import made safe (try/catch) for Expo Go compatibility.
- Added `SimpleOptionList` pure-JS fallback for select/radio when no native picker available.
- Metro resolver pins `@expo/ui` (and all subpaths like `@expo/ui/swift-ui`) to the app's own canary version via custom `resolveRequest` in `metro.config.js`. Critical in pnpm monorepos where multiple versions may coexist.
- EAS build configured: `eas.json` with development, development-simulator, preview, production profiles.
- Dev client `.app` (simulator) and `.ipa` (device) builds working via `eas build --local`.
- `NSAllowsArbitraryLoads: true` in Info.plist for dev builds (http:// access to local server from physical devices).
- CocoaPods requires `LANG=en_US.UTF-8` (Ruby 4.0 encoding fix, added to `~/.zshrc`).

Custom tab bar + long-press collection menu (2026-04-02)
- Replaced `NativeTabs` (expo-router/unstable-native-tabs) with standard `Tabs` from expo-router + custom `tabBar` component.
- Custom tab bar renders BlurView background (systemChromeMaterial), safe area padding, lucide icons, active/inactive colors.
- Collections tab uses `@expo/ui/swift-ui` `Menu` component for Telegram-style long-press behaviour:
  - `onPrimaryAction` handles single tap → switch to collections tab
  - Long press shows native iOS dropdown with all collections (SF Symbol icons from schema)
  - Grouped collections render as nested `Menu` (collapsible submenus)
  - Ungrouped collections render as top-level buttons with divider separator
  - `Host` wrapper provides SwiftUI rendering context for the Menu trigger label (ReactNode)
  - Falls back to plain Pressable on Android / when @expo/ui unavailable

Dynamic collection icons (2026-04-02)
- `MenuModel` type extended with `icon?: string` on collections and globals.
- `buildMenuModel()` reads `admin.icon` from Payload collection configs (lucide icon name or raw SVG string).
- New `iconRegistry.ts` in admin-native: 150+ lucide → SF Symbol mappings, lazy component registry, runtime extensible via `registerIcon()`.
- New `CollectionIcon` component: renders lucide component by name, raw SVG via SvgXml, or fallback File icon.
- Tab menu, collections index, and dashboard all use dynamic icons from the schema.
- Icons change dynamically when Payload config is updated and schema is refreshed — no app rebuild needed.

Join field support (2026-04-02)
- `JoinField` component renders Payload's join field as a native scrollable table.
- Configurable columns via `admin.defaultColumns` from Payload config.
- Tappable rows navigate to the related document (Link.Preview peek/pop on iOS).
- Sort by column header tap, pagination with "Load more", pull-to-refresh.
- Local-first: queries RxDB with `{ [onField]: { $eq: parentDocId } }`; falls back to REST API.
- `FormDataContext` added to DocumentForm so JoinField can access parent document ID.
- Polymorphic joins supported (multiple collection slugs with badge display).
- Pre-populated data from the API used on first render to avoid unnecessary queries.

iPad responsive layout (2026-04-03)
- `useResponsive()` hook (`hooks/useResponsive.ts`) provides: `isTablet`, `isLandscape`, `showSidebar`, `columns`, `contentWidth`
- `isTablet` uses `Platform.isPad` on iOS (reliable even in iPadOS Split View); Android falls back to `min(width, height) >= 600`
- `showSidebar` = true when `isTablet && width >= 1024` — iPad landscape full-screen only; portrait and split-view use bottom tabs
- Grid columns based on content area width (after subtracting sidebar), not raw window width; max 2 cols when sidebar is showing
- `_layout.tsx` switches between sidebar and bottom tab bar based on `showSidebar`
- Screen files use inline styles instead of NativeWind className for reliable iPad layout (padding, flexGrow)
- Sidebar is 280px wide, shows grouped and ungrouped collections + globals + account
- iPad window resize: explicit `width`/`height` from `useWindowDimensions()` on root `GestureHandlerRootView` and admin layout container to force native re-layout
- Table view: tablet document list renders horizontal table rows (matching Payload web admin) with draggable header columns
- Cards use flex-percentage grid (`flexBasis: '46%'` / `'30%'`) that naturally resizes with container

Drag-to-reorder summary fields (2026-04-03)
- Installed `react-native-reanimated-dnd` v2.0.0 + `react-native-worklets` v0.7.1 (NOT 0.8.x — incompatible with Reanimated 4.2.x)
- Summary fields picker uses **buffered draft state**: changes are local until Save (✓ button) is tapped. Prevents jank from parent re-renders during drag.
- ACTIVE fields: `Sortable` vertical list with `SortableItem.Handle` drag handles (lucide `GripVertical` icon)
- AVAILABLE fields: plain `Pressable` rows with lucide `Circle`/`CircleCheck` icons — tap to toggle
- **Critical**: `onMove` is a no-op — state is updated only in `onDrop` (with `allPositions` map). Updating state in `onMove` triggers Sortable full remount (it hashes item IDs as React key), killing animation mid-drag.
- **Critical**: Do NOT use `@expo/ui` SwiftUI components (`Image`, `Button`) inside Sortable items — they crash. Use lucide-react-native icons instead.
- Table header columns on tablet are static (ordered by `summaryFields`); column order is controlled through the picker, not by dragging headers directly
- `_status` excluded from table summary columns when `hasDrafts` is true (already shown as dedicated status pill column)
- Graceful fallback: `react-native-reanimated-dnd` is optional-required (`try/catch`); without it, picker renders checkbox-only list

Relationship picker inline preview (2026-04-03)
- Long-press on a picker row in the BottomSheet shows an inline DocumentForm preview (pure React, no native context menu)
- "Select" picks the item, "Back" returns to the list
- Avoids the native ScrollablePreview UIKit crash inside BottomSheet Modals (see 013_ui-patterns.md)

UI and state
- Create packages/admin-native that implements field and view components in React Native.
- Reuse packages/admin-core for form state, validation, schema maps, and API calls.
- Use Expo Router or React Navigation for screens. Keep routing behind a NavigationAdapter so you can share logic.

Data and auth
- Use @payloadcms/sdk for REST calls. Keep auth and refresh logic in admin-core so web and native share it.
- Add upload helpers that use expo-document-picker and expo-file-system for files.

Scope order
- Start with login, collection list, and document read.
- Add document edit and create flows next.
- Add uploads, relationships, and rich text last.
