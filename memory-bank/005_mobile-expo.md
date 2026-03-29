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

Status (2026-03-29)
- apps/mobile-expo has auth gate, admin tab navigation, and local-first data layer.
- NativeWind configured; admin-native provides DocumentList, DocumentForm, FieldRenderer.
- Local-first architecture via RxDB + custom SQLite storage (no trial limits):
  - `_layout.tsx` creates `getRxStorageSQLite()` with Expo SQLite, passes to `LocalDBProvider`.
  - Schema changes auto-propagate: Payload config → admin schema → RxDB collections → SQLite tables + indexes.
  - Hooks: `useLocalCollection`, `useLocalDocument`, `useLocalQuery`, `usePendingUploads`.
  - Upload queue with retry logic via `UploadQueueManager`.
- PayloadNativeProvider handles auth (JWT), schema fetching, token persistence via SecureStore.
- Sync progress shown on splash screen (progress bar + collection counter); toasts on sync complete/error.
- Select/Radio fields use native @react-native-picker/picker; multi-select uses toggle chips.
- Collection cards have configurable summary fields (gear icon → field picker → persisted in AsyncStorage).
- Link.Preview (iOS peek/pop) on document list rows and relationship field selected values.
- App no longer blocks on DB init — auth gate shows UI immediately, screens show own loading states.
- Polyfill `globalThis.crypto` with expo-crypto for RxDB compatibility on Hermes.

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
