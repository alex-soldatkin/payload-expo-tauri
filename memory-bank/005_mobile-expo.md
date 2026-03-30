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
- `native.ios.ts` checks for `ExpoUI` native module presence before enabling (graceful fallback if dev client not rebuilt).
- EAS build configured: `eas.json` with development, development-simulator, preview, production profiles.
- Dev client `.app` (simulator) and `.ipa` (device) builds working via `eas build --local`.

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
