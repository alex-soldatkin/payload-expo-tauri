# UI Patterns and Solutions (2026-03-29)

## Link.Preview (iOS Peek/Pop)

### The Problem
`Link.Preview` from `expo-router` requires the Expo Router navigation context (`LinkPreviewContextProvider`). Components in shared workspace packages (`admin-native`) resolve `expo-router` from a different module instance than the app, causing "useLinkPreviewContext must be used within a LinkPreviewContextProvider" errors.

### The Solution
**Never render `Link` / `Link.Preview` / `useRouter` from shared workspace packages.** Always render them from screen files inside the Expo Router tree.

**Pattern — `renderRow` callback for collection list (works):**
```tsx
// SHARED COMPONENT (admin-native/DocumentList.tsx)
// Does NOT import expo-router. Accepts a renderRow callback instead.
type Props = {
  renderRow?: (props: {
    item: Record<string, unknown>
    rowContent: React.ReactElement
    onPress: () => void
  }) => React.ReactElement
}
```

**Pattern — ScrollablePreview for collection list items (works):**
```tsx
// SCREEN FILE (inside Expo Router tree — [slug]/index.tsx)
// Uses custom native ScrollablePreview module instead of Link.Preview.
import * as ScrollablePreview from '@/modules/scrollable-preview'

<ScrollablePreview.Trigger onPrimaryAction={navigate}>
  {rowContent}
  <ScrollablePreview.Content>
    <PreviewContextProvider value={true}>
      <DocumentForm schemaMap={schemaMap} slug={slug} initialData={item} disabled />
    </PreviewContextProvider>
  </ScrollablePreview.Content>
  <ScrollablePreview.Action title="Open" icon="doc.text" onActionPress={open} />
</ScrollablePreview.Trigger>
```

### ScrollablePreviewContext (injecting native preview into shared fields)
The `ScrollablePreviewProvider` lets the app inject the native `ScrollablePreview` module into shared field components so they can offer long-press previews:
```tsx
// App root (_layout.tsx) — provides the module
import * as ScrollablePreview from '@/modules/scrollable-preview'
import { ScrollablePreviewProvider } from '@payload-universal/admin-native'
<ScrollablePreviewProvider value={ScrollablePreview}>...</ScrollablePreviewProvider>

// Shared field (pickers.tsx) — consumes it
const preview = useScrollablePreview()
if (preview) {
  return <preview.Trigger>...</preview.Trigger>
}
```

### PreviewContext (disabling Link/router in preview overlays)
`PreviewContextProvider value={true}` wraps content rendered inside overlays (ScrollablePreview, BottomSheet) where Expo Router context is absent. Fields check `useIsInsidePreview()` to skip anything requiring router context.

### Key Rules
1. **NEVER import expo-router (Link, useRouter, etc.) from shared packages** — not via static import, not via `require()`, not via try/catch. The module instance in the shared package differs from the app's, so hooks (`useRouter`) and components (`Link.Preview`) will always crash with "useLinkPreviewContext must be used within a LinkPreviewContextProvider".
2. Use the `renderRow` callback pattern so screen files handle navigation rendering
3. Use `ScrollablePreviewContext` to inject the native preview module into shared fields
4. Wrap preview overlay content with `<PreviewContextProvider value={true}>` to disable nested previews
5. `FormDataContext` was extracted to `FormDataContext.ts` to break a require cycle: `DocumentForm → FieldRenderer → fields → join → DocumentForm`

### Resolved Bug: ScrollablePreview in relationship picker BottomSheet
**Status:** Fixed (2026-04-03) — replaced native preview with pure-React inline preview
**Original symptom:** App crashed after long-press peeking a relationship picker row inside a BottomSheet, then selecting via the preview action or primary action. The native `ScrollablePreview` (UIContextMenuInteraction-based) dismissal animation conflicted with the BottomSheet Modal's removal from the view hierarchy.
**Fix:** Replaced native ScrollablePreview inside BottomSheet with a pure-React inline preview:
- Long-press on a picker row sets `previewItem` state → BottomSheet content switches from list to inline DocumentForm
- "Select" and "Back" buttons replace native context menu actions
- No native view reparenting needed → no UIKit crash
- `useScrollablePreview` import removed from `pickers.tsx`
- BottomSheet height increases to 0.75 when preview is active (from 0.6)
**Rule: Do NOT use native ScrollablePreview inside BottomSheet Modals** — the UIContextMenuInteraction view lifecycle conflicts with React Native Modal teardown. Use inline React previews instead.

### BottomSheet Implementation
Uses transparent `Modal` + `Animated` slide-up + `PanResponder` swipe-to-dismiss. Wraps children with `PreviewContextProvider value={true}`.
**Do NOT use `presentationStyle: 'pageSheet'`** — it breaks native ScrollablePreview (UIContextMenuInteraction) inside the sheet.

---

## Select / Radio Fields

### Three-tier fallback (2026-03-30)
1. **@expo/ui native** (preferred): SwiftUI Picker / JC SegmentedButton — loaded via `nativeComponents` registry
2. **@react-native-picker/picker** (fallback): Native iOS wheel / Android dropdown — loaded via try/catch dynamic import (not available in Expo Go)
3. **SimpleOptionList** (pure JS): Chip-based option selector — always works, no native deps

### Single-select (native)
```tsx
// Uses nativeComponents.Picker + nativeComponents.Text from shared registry
// CRITICAL: matchContents={{ height: true }} — SwiftUI must report height to RN
// so UIKit hit-testing works. matchContents={false} causes zero-height frame → no taps.
<NativeHost matchContents={{ height: true }}>
  <NativePicker selection={value} onSelectionChange={onChange}>
    <NativeText modifiers={[tag('')]}>Select...</NativeText>
    {options.map(opt => <NativeText key={opt.value} modifiers={[tag(opt.value)]}>{opt.label}</NativeText>)}
  </NativePicker>
</NativeHost>
```

### Radio (segmented for ≤5 options)
```tsx
<NativePicker selection={value} onSelectionChange={onChange} modifiers={[{ pickerStyle: 'segmented' }]}>
  {options.map(opt => <NativeText modifiers={[{ tag: opt.value }]}>{opt.label}</NativeText>)}
</NativePicker>
```

### Multi-select (`hasMany: true`)
Uses toggle chips on all platforms (no native multi-select equivalent).

### Relationship fields
Use searchable BottomSheet (NOT native picker) — relationships query across a collection with potentially many documents and need search + scroll.

---

## @expo/ui Native Component Registry (2026-03-30)

### Architecture
Metro platform file resolution — no runtime `Platform.OS` checks for component loading:
```
fields/shared/
├── types.ts           # NativeComponentRegistry type + emptyRegistry (no platform variants)
├── native.ios.ts      # Loads from @expo/ui/swift-ui
├── native.android.ts  # Loads from @expo/ui/jetpack-compose
├── native.ts          # Default: emptyRegistry (web/unsupported)
├── FieldShell.tsx     # Shared label/desc/error wrapper
└── index.ts           # Barrel export
```

### Usage in field components
```tsx
import { nativeComponents } from './shared'
import { NativeHost } from './NativeHost'

// Check availability, render native or fallback
export const CheckboxField = (props) =>
  nativeComponents.Toggle
    ? <CheckboxFieldNative {...props} />
    : <CheckboxFieldFallback {...props} />
```

### Key rules
1. **Never import `@expo/ui` directly in field files** — always go through `nativeComponents` registry
2. **Types go in `types.ts`** (no `.ios.ts`/`.android.ts` variants) to avoid circular imports from Metro resolution
3. **`@react-native-picker/picker` uses dynamic require** (try/catch) since it's not available in Expo Go
4. **Three-tier fallback**: @expo/ui → RN native → pure JS (always works)
5. **Metro must pin `@expo/ui` as singleton** — see Metro resolver section below

---

## Native SwiftUI Button (2026-04-04)

### Registry
`Button`, `buttonStyle`, `controlSize`, `tint` added to `NativeComponentRegistry`:
```tsx
const NativeButton = nativeComponents.Button
const btnStyle = nativeComponents.buttonStyle
const ctrlSize = nativeComponents.controlSize
const tintMod = nativeComponents.tint
```

### Usage — selection action bar
Each button gets its own `NativeHost` inside a RN `View` with `flexDirection: 'row'`:
```tsx
<View style={{ flexDirection: 'row', gap: 8 }}>
  <NativeHost matchContents>
    <NativeButton
      label="Publish Selected"
      role="default"
      systemImage="arrow.up.doc"
      onPress={handlePublish}
      modifiers={[
        btnStyle('borderedProminent'),
        ctrlSize('regular'),
        tintMod('#007AFF'),
      ]}
    />
  </NativeHost>
  <NativeHost matchContents>
    <NativeButton
      label="Archive"
      role="destructive"
      systemImage="archivebox"
      onPress={handleArchive}
      modifiers={[
        btnStyle('borderedProminent'),
        ctrlSize('regular'),
        // destructive role auto-renders in red — no tint needed
      ]}
    />
  </NativeHost>
  <NativeHost matchContents>
    <NativeButton
      label="Done"
      role="cancel"
      onPress={exitSelectionMode}
      modifiers={[
        btnStyle('bordered'),
        ctrlSize('regular'),
      ]}
    />
  </NativeHost>
</View>
```

### Available buttonStyle values
`'automatic'` | `'bordered'` | `'borderedProminent'` | `'borderless'` | `'glass'` | `'glassProminent'` | `'plain'`

### Key rules
1. **Use `matchContents={{ height: true }}`** — SwiftUI must report button height; RN controls width via flex layout
2. **`role="destructive"` for red buttons** — SwiftUI applies native red tint automatically
3. **`role="cancel"` for grey/dismiss buttons** — SwiftUI applies native secondary styling
4. **`buttonStyle('borderedProminent')` for filled buttons**, `'bordered'` for outline, `'glass'` / `'glassProminent'` for liquid glass
5. **Do NOT apply `glassEffect` modifier directly to Button** — use `buttonStyle('glass')` instead, otherwise gesture handlers conflict
6. **Fallback to Pressable on Android** — no SwiftUI Button equivalent

---

## Collection Card Summary Fields

### How it works
- Gear icon (⚙) in the list header opens a field picker BottomSheet
- User selects which fields to display on each card (multi-select checkboxes)
- Selected fields render as `Label: Value` pairs below the title on each card
- Selection persisted per collection in AsyncStorage: `card_summary_fields:{slug}`

### Smart value formatting
```tsx
const formatFieldValue = (val: unknown): string => {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    return String(obj.title ?? obj.name ?? obj.email ?? obj.id ?? JSON.stringify(val))
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(val))) return formatDate(String(val))
  return String(val)
}
```

### Field filtering
Only show displayable field types in the picker:
`text, email, number, date, select, radio, checkbox, relationship, upload, textarea, richText, point, json`

Skip internal fields: `id, createdAt, updatedAt`

---

## Relationship Field Display

### `useAsTitle` resolution
Relationship fields resolve the display label from the related collection's `useAsTitle` setting (from `schema.menuModel.collections`):
```tsx
const useAsTitle = schema?.menuModel?.collections.find(c => c.slug === relationTo)?.useAsTitle
```

### Display priority
```tsx
const docDisplayTitle = (doc, useAsTitle) => {
  if (useAsTitle && doc[useAsTitle] != null) return String(doc[useAsTitle])
  return String(doc.title ?? doc.name ?? doc.email ?? doc.id ?? '')
}
```

### Label caching
When a relationship value is just an ID (not a populated object), the field fetches the doc to resolve its title. The resolved label is cached in component state (`displayLabel`) so it persists across re-renders without re-fetching.

---

## Sync Progress UI

### Splash screen
`SyncProgressIndicator` shows during AuthGate loading:
- Progress bar (% of collections synced)
- "Syncing posts..." label with current collection name
- "2/7 collections" counter

### Background toasts
`SyncToastBridge` watches `syncStatus` transitions:
- `syncing → idle` → green toast "Sync complete"
- `→ error` → red toast "Sync error — using local data"

---

## Hermes / React Native Compatibility

### `globalThis.crypto` polyfill
Hermes doesn't have `crypto`. RxDB needs both `crypto.getRandomValues` and `crypto.subtle.digest`. Polyfill in `database.ts` BEFORE any RxDB imports:
```tsx
import { getRandomValues, digest, CryptoDigestAlgorithm } from 'expo-crypto'

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {
    getRandomValues,
    subtle: { digest: (algo, data) => expoDigest(mapAlgo(algo), data) },
  }
}
```

### ID generation
Use `expo-crypto`'s `getRandomBytes(12)` for MongoDB-compatible 24-char hex IDs. Do NOT use `globalThis.crypto.getRandomValues` directly (may not exist before polyfill runs).

### StyleSheet.flatten
`Link.Trigger` children must have flat styles (not arrays). Use `StyleSheet.flatten([...])` when composing styles for children of `Link.Trigger`.

---

## Internal Payload Collections

### Skip during local DB sync
Filter out Payload's internal collections — they return 403/501 and waste network:
```tsx
const INTERNAL_SLUGS = new Set([
  'payload-preferences', 'payload-migrations', 'payload-locked-documents',
  'payload-kv', '_sync_tombstones',
])
// Skip anything starting with 'payload-' too
if (INTERNAL_SLUGS.has(slug) || slug.startsWith('payload-')) continue
```

---

## Delete Actions (2026-03-30)

### Context menu delete (current approach)
On iOS 26, both legacy `Swipeable` and `ReanimatedSwipeable` cause `PanGestureHandler` crashes. Delete is now handled via native `ScrollablePreview.Action` in the long-press preview menu:

```tsx
// In screen file (inside Expo Router tree — [slug]/index.tsx)
<ScrollablePreview.Trigger onPrimaryAction={navigate}>
  {rowContent}
  <ScrollablePreview.Content>
    <PreviewContextProvider value={true}>
      <DocumentForm ... disabled />
    </PreviewContextProvider>
  </ScrollablePreview.Content>
  <ScrollablePreview.Action title="Open" icon="doc.text" onActionPress={open} />
  <ScrollablePreview.Action title="Delete" icon="trash" destructive onActionPress={confirmDelete} />
</ScrollablePreview.Trigger>
```

### Shake-to-undo (still works)
Uses `expo-sensors` DeviceMotion to detect shake → re-inserts deleted doc.

### `GestureHandlerRootView` required
Must wrap the **entire** app tree including loading states. The root `_layout.tsx` must never return early without `GestureHandlerRootView`:
```tsx
// WRONG — loading state bypasses GestureHandlerRootView
if (!ready) return <ActivityIndicator />
return <GestureHandlerRootView>...</GestureHandlerRootView>

// CORRECT — always wrapped
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    {!ready ? <ActivityIndicator /> : <App />}
  </GestureHandlerRootView>
)
```

---

## Push Replication: ID Mismatch Bug

### The Problem
Client generates a 24-char hex ID locally. Payload's MongoDB adapter ignores it and assigns its own ObjectId. Pull handler sees the server doc with a different ID → treats as "new" → inserts locally → push creates another copy → infinite duplication.

### The Fix
After successful POST in push handler:
1. Strip client `id` from POST body (let Payload assign its own)
2. Check if server ID differs from client ID
3. If so: `collection.findOne(clientId).remove()` + `collection.upsert(serverDoc)`
4. This prevents the pull handler from seeing a phantom "new" doc

### Also strip from push payload
`_deleted`, `_rev`, `_meta`, `_attachments`, `_locallyModified`, and `id` (for creates only)

---

## Metro Resolver: @expo/ui Version Pinning (2026-04-01)

### The Problem
pnpm workspace had two versions of `@expo/ui`:
- `55.0.0-canary-20260128` — installed in the mobile app, compiled into the native binary
- `55.0.6` — resolved as a transitive dep from another workspace package

Metro resolved `@expo/ui/swift-ui` from the **wrong version** (55.0.6), which used `SlotView` — a native view that doesn't exist in the canary binary. Error: `ViewManagerAdapter_ExpoUI_SlotView must be a function (received undefined)`.

### The Fix
Custom `resolveRequest` in `metro.config.js` that pins ALL `@expo/ui` imports:

```js
const fs = require('fs')
const expoUIReal = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/@expo/ui')
)

resolveRequest: (context, moduleName, platform) => {
  // Pin ALL @expo/ui imports including subpaths
  if (moduleName === '@expo/ui' || moduleName.startsWith('@expo/ui/')) {
    const subpath = moduleName === '@expo/ui'
      ? ''
      : moduleName.slice('@expo/ui/'.length)

    if (subpath) {
      const pkg = require(path.join(expoUIReal, 'package.json'))
      const exportEntry = pkg.exports?.['./' + subpath]
      if (exportEntry) {
        const entryFile = typeof exportEntry === 'string'
          ? exportEntry
          : exportEntry.default || Object.values(exportEntry)[0]
        return { filePath: path.resolve(expoUIReal, entryFile), type: 'sourceFile' }
      }
    }
    // ...
  }
}
```

### Key lessons
1. **`extraNodeModules` alone is insufficient** — it only maps the root package name, not subpath imports like `@expo/ui/swift-ui`
2. **Must use `fs.realpathSync`** — pnpm uses symlinks, and `require.resolve` may not follow them correctly
3. **Must read `package.json` exports** — `@expo/ui` uses conditional exports (`./swift-ui`, `./jetpack-compose`), so the resolver must map subpaths through the exports field
4. **Always clear Metro cache after changing resolver** — `npx expo start --dev-client -c`
5. **The native binary version must match the JS version** — if they diverge, native views will be missing and components will crash at render time

---

## Progressive Blur Header (2026-04-02)

### Effect
Apple-style translucent header where blur fades progressively from full intensity at the top of the screen to fully transparent below the navigation bar. Inspired by [expo-progressive-blur](https://github.com/rit3zh/expo-progressive-blur).

### Architecture
A shared `ProgressiveBlurHeader` component (`components/ProgressiveBlurHeader.tsx`) renders as an absolutely-positioned overlay at the top of the screen with `pointerEvents="none"`. It sits as a sibling to the `Stack` navigator inside a wrapper `View` — the native header elements (title, back button) render above it at the native level via `react-native-screens`.

### Rendering tiers
1. **iOS 26+ liquid glass** — `GlassView` from `expo-glass-effect` (Apple's native material)
2. **Progressive blur** — `MaskedView` + `LinearGradient` (gradient mask) + `BlurView` (blur source)
   - Gradient mask: opaque at top → transparent at bottom → blur fades out
   - Paper-colored tint gradient layered behind blur for text readability
   - `react-native-easing-gradient` generates natural ease-out stops; falls back to hand-tuned stops
3. **BlurView only** — when `MaskedView` / `LinearGradient` unavailable
4. **Gradient tint** — `LinearGradient` with paper color (no native blur)
5. **Solid translucent** — plain `View` with `rgba(246, 244, 241, 0.92)` background

### Dependencies added
- `expo-linear-gradient` — gradient rendering (mask element + tint layer)
- `@react-native-masked-view/masked-view` — applies gradient as alpha mask over `BlurView`
- `react-native-easing-gradient` — generates eased color stops for natural blur fall-off

### Layout integration
```tsx
// In _layout.tsx (collections or globals)
const insets = useSafeAreaInsets()
const headerHeight = insets.top + 44 // safe area + standard nav bar

<View style={{ flex: 1 }}>
  <Stack screenOptions={{ headerTransparent: true, headerShadowVisible: false }}>
    ...
  </Stack>
  <ProgressiveBlurHeader headerHeight={headerHeight} />
</View>
```

### Props
| Prop | Default | Purpose |
|------|---------|---------|
| `headerHeight` | required | Safe area top + 44 (standard nav bar) |
| `blurExtension` | `30` | Extra pixels below header where blur fades |
| `blurIntensity` | `50` | `expo-blur` intensity value |

### Key considerations
- The overlay has `zIndex: 1` — low enough to stay below native header elements
- `pointerEvents="none"` ensures all touches pass through to content and header buttons
- Modal screens (e.g. `[slug]/create` with `presentation: 'modal'`) get their own native view hierarchy — the overlay does not appear over them
- During push/pop transitions, the blur overlay stays fixed while screen content slides underneath — this is the desired behavior

---

## Custom Tab Bar + Long-Press Collection Menu (2026-04-02)

### Architecture
Switched from `NativeTabs` (fully native, no customization) to standard `Tabs` from `expo-router` with a custom `tabBar` component. This enables JS-level control of tab items while maintaining native iOS look.

### Long-press menu pattern
Uses `@expo/ui/swift-ui` `Menu` component directly in the tab bar:

```tsx
// Menu wraps the tab item visual content
<SHost matchContents colorScheme="light">
  <SMenu label={tabContent} onPrimaryAction={onPress}>
    {/* Ungrouped collections */}
    {ungrouped.map(col => (
      <SButton label={label} systemImage={getSFSymbol(col.icon)} onPress={...} />
    ))}
    <SDivider />
    {/* Grouped collections as collapsible submenus */}
    {grouped.map(group => (
      <SMenu label={group.name} systemImage="folder">
        {group.items.map(col => (
          <SButton label={label} systemImage={getSFSymbol(col.icon)} onPress={...} />
        ))}
      </SMenu>
    ))}
  </SMenu>
</SHost>
```

### Key details
- `onPrimaryAction` → fires on single tap (switch to tab)
- No `onPrimaryAction` set → long press shows the menu
- When `onPrimaryAction` IS set → single tap fires it, long press shows menu
- Nested `Menu` creates collapsible submenus (iOS native submenu behaviour)
- `Host` with `matchContents` sizes to the SwiftUI content (tab icon + label)
- `Divider` separates ungrouped from grouped collections
- Menu items use `systemImage` (SF Symbol) resolved from the schema via `getSFSymbol(col.icon)`
- Menu `label` accepts a ReactNode (our icon + text View) which renders as the trigger visual

### Fallback (Android / no @expo/ui)
Falls back to a plain `Pressable` with `onPress` only — no long-press menu.

---

## Dynamic Collection Icons (2026-04-02)

### Config
Define icons in Payload collection config:
```typescript
export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    icon: 'file-text',  // lucide icon name
    // Can also be raw SVG: icon: '<svg viewBox="0 0 24 24">...</svg>'
  },
}
```

### Data flow
```
Payload config (admin.icon) → buildMenuModel() → MenuModel JSON → /api/admin-schema
  → mobile app schema refresh → iconRegistry lookup → CollectionIcon render
```

### Icon registry (`iconRegistry.ts`)
- 150+ lucide name → SF Symbol mappings in `sfSymbolMap`
- Lazy component registry: converts kebab-case names to PascalCase and looks up in `lucide-react-native`
- `getSFSymbol(name)` → SF Symbol string for SwiftUI menus (default: `'doc'`)
- `getIconComponent(name)` → React Native component (default: `null`)
- `isRawSVG(icon)` → checks if icon string is raw SVG (starts with `<`)
- `registerIcon(name, component, sfSymbol?)` → extend at runtime

### CollectionIcon component
```tsx
<CollectionIcon icon={col.icon} size={22} color="#555" />
```
Render priority: raw SVG (SvgXml) → lucide component by name → fallback File icon.

### Key rules
1. Icon names use lucide kebab-case convention: `'file-text'`, `'shopping-cart'`, `'users'`
2. Access `admin.icon` safely: `(collection.admin as Record<string, unknown>)?.icon`
3. Use `@ts-expect-error` in collection configs since Payload's types don't include `icon`
4. Icons update dynamically on schema refresh — no app rebuild needed
5. Bundle size impact: ~1MB from imported lucide icons (acceptable for admin app)

---

## Join Field (Native Table View) (2026-04-02)

### Architecture
The `JoinField` component renders Payload's join field as a native scrollable table on mobile. It's read-only — join fields show related documents from another collection where a relationship field points back to the current document.

### Data flow
```
Payload config (join field: collection, on, admin.defaultColumns)
  → admin schema → client field config
  → JoinField component reads config
  → Queries: pre-populated value → local RxDB → REST API fallback
  → Renders scrollable table with tappable rows
```

### Parent document ID resolution
JoinField needs the parent doc's ID to build the WHERE filter (`{ [on]: { equals: parentDocId } }`). Resolution order:
1. `FormDataContext` (provided by DocumentForm) → `formCtx.formData.id`
2. Pre-populated value → extract from first doc's `on` field
3. If neither available → shows "Save this document to see related X"

### FormDataContext
```tsx
// Extracted to standalone FormDataContext.ts to break require cycle.
// DocumentForm re-exports for backwards compatibility.
import { useFormData } from '../FormDataContext'
const formCtx = useFormData()
const parentDocId = formCtx?.formData?.id
```

### Column configuration
```typescript
// In Payload config:
{
  name: 'comments',
  type: 'join',
  collection: 'comments',
  on: 'post',
  admin: {
    defaultColumns: ['title', 'author', 'createdAt'],  // Controls which columns render
  },
  defaultLimit: 10,
  defaultSort: '-createdAt',
}
```

### Local-first query
```typescript
// RxDB Mango query with reverse-relationship filter:
const selector = {
  _deleted: { $eq: false },
  [onField]: { $eq: parentDocId },
}
const results = await localCollection.find({
  selector,
  sort: [{ [sortField]: sortDir }],
  limit,
  skip: (pageNum - 1) * limit,
}).exec()
```

### REST API fallback
```typescript
const where = { [onField]: { equals: parentDocId } }
// For polymorphic targets:
const where = { [onField]: { equals: { relationTo: parentSlug, value: parentDocId } } }
// Merged with field.where if present:
const mergedWhere = field.where ? { and: [where, field.where] } : where
```

### Row rendering
Rows are plain `View` wrappers — **no expo-router imports** (Link, useRouter). Navigation from join field rows is not currently supported from the shared package. If needed, it must be injected via callback prop from the screen file.

### Key rules
1. Join fields are **read-only** — `onChange` is not used
2. **No expo-router imports** — no Link, no useRouter, no require('expo-router')
3. Always show "Save this document" placeholder for unsaved docs (no parent ID)
4. Pre-populated value from the API is preferred on first render (avoids extra query)
5. Column headers are tappable for sort — active column shows ▲/▼ indicator
6. Cell values are auto-formatted: dates → locale string, booleans → Yes/No, objects → title/name/email/id
7. Horizontal scroll on each row handles wide tables on narrow mobile screens

---

## iPad Responsive Layout (2026-04-03)

### useResponsive hook (`hooks/useResponsive.ts`)
Returns `{ isTablet, isLandscape, showSidebar, columns, contentWidth, width, height }`.
- `isTablet`: `Platform.isPad` on iOS (reliable even in iPadOS Split View); `min(width, height) >= 600` on Android
- `showSidebar`: `isTablet && width >= 1024` — only in landscape full-screen; portrait + split-view use bottom tabs
- `columns`: computed from **content area** width (after subtracting sidebar), not raw window width; max 2 when sidebar showing, up to 3 otherwise
- `contentWidth`: `showSidebar ? width - 280 : width`

### Window resize on iPad
React Native's `flex: 1` does NOT reliably propagate iPad window size changes. The root `GestureHandlerRootView` and the admin layout container **must** have explicit `width`/`height` from `useWindowDimensions()` to force native re-layout:
```tsx
const { width, height } = useWindowDimensions()
<GestureHandlerRootView style={{ flex: 1, width, height }}>
```
Without this, resizing the iPad window (Split View, Stage Manager) freezes the layout at the old dimensions.

### Sidebar navigation (tablet)
- 280px wide, frosted-glass blur background (same BlurView as tab bar)
- Shows all collections (with CollectionIcon + group headers) and globals inline
- Active route highlighted via `usePathname()` from expo-router
- Account pinned at bottom with separator
- Tab bar returns `null` when sidebar is showing (`showSidebar ? null : <CustomTabBar />`)

### Grid layout for cards
Cards on dashboard, collections index, globals index use flex-based responsive grid:
```tsx
const gridRow = columns > 1
  ? { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
  : undefined
const gridCell = columns > 1
  ? columns >= 3
    ? { flexGrow: 1, flexShrink: 0, flexBasis: '30%', maxWidth: '33.33%' }
    : { flexGrow: 1, flexShrink: 0, flexBasis: '46%' }
  : undefined
```
Uses percentage-based `flexBasis` + `flexGrow` so cells naturally resize with the container.

### Table view for document list (tablet)
When `showSidebar` is true, document rows render as horizontal table rows:
- Fixed columns: Title (140px), Status pill (if drafts, 80px), Updated date (110px), chevron (20px)
- Dynamic columns: summary fields with `flex: 1` — header and data cells use matching flex
- Column order is controlled through the Card Display Fields picker (⚙), not by dragging header columns directly
- `_status` is excluded from `tableFields` when `hasDrafts` is true (it's already a dedicated status pill column) — prevents duplicate "Status" key errors
- Column reorder is persisted via the `summaryFields` array + AsyncStorage

### Account / Login centering
On tablet, content is constrained with `{ maxWidth: 600, alignSelf: 'center', width: '100%' }` on the inner View (not the ScrollView content container, which is unreliable).

---

## Drag-to-Reorder: Summary Fields Picker (2026-04-03)

### Library
`react-native-reanimated-dnd` v2.0.0 — performant drag-and-drop built on Reanimated worklets.

### Peer dependencies
- `react-native-reanimated` >= 4.2.0 (already installed: 4.2.1)
- `react-native-gesture-handler` >= 2.28.0 (already installed: ~2.30.0)
- `react-native-worklets` 0.7.x (added: 0.7.1 — **NOT 0.8.x**, which is incompatible with Reanimated 4.2.x)

### Architecture
The summary fields picker (`SummaryFieldsPicker` in `DocumentList.tsx`) uses **buffered draft state**:
1. Opening the sheet copies `summaryFields` → local `draft` state
2. All toggles and reorders mutate `draft` only (no parent re-renders)
3. Tapping **Save** (✓ button top-right) flushes `draft` → `onSummaryFieldsChange` → parent persists to AsyncStorage
4. Dismissing without Save discards changes

The picker is split into two sections:
1. **ACTIVE fields** — `Sortable` vertical list with `SortableItem.Handle` drag handles (lucide `GripVertical` icon)
2. **AVAILABLE fields** — plain list of `Pressable` rows with lucide `Circle` icon (tap to add)

### Critical patterns

```tsx
// 1. Items MUST have id: string
const selectedItems = useMemo(() =>
  draft.filter(name => fieldMap.has(name))
    .map(name => ({ id: name, field: fieldMap.get(name)! })),
  [draft, fieldMap],
)

// 2. renderItem MUST spread ...props from parent Sortable
const renderSortableItem = useCallback(({ item, ...props }) => (
  <SortableItem key={item.id} id={item.id} data={item}
    onMove={noopMove}   // ← no-op during drag!
    onDrop={handleDrop}  // ← update state only on release
    {...props}
  >
    <View>
      <SortableItem.Handle>
        <View><GripVertical size={18} /></View>
      </SortableItem.Handle>
      {/* Pressable content for toggling */}
    </View>
  </SortableItem>
), [noopMove, handleDrop, handleToggle])

// 3. onDrop reads allPositions to get final order (single state update)
const handleDrop = useCallback(
  (_id, _position, allPositions) => {
    if (!allPositions) return
    setDraft(prev => {
      const items = prev.filter(name => allPositions[name] != null)
      return items.sort((a, b) => allPositions[a] - allPositions[b])
    })
  }, [],
)
```

### Critical gotchas (hard-won lessons)

1. **NEVER update state in `onMove` — use `onDrop` instead.**
   Sortable remounts the entire list when the data array changes (it hashes all item IDs as a React key). Updating state in `onMove` → new data → full remount → animation state destroyed → jank + can only move one position. Make `onMove` a no-op and defer state update to `onDrop` which provides `allPositions` (a map of `id → final index`).

2. **Do NOT use `@expo/ui` SwiftUI components inside Sortable items.**
   `SFImage`, `SFButton` etc. render in a separate SwiftUI view hierarchy via `Host`. Inside `react-native-reanimated-dnd`'s gesture handler tree, SwiftUI views cause crashes. Use lucide-react-native icons instead (pure React Native SVGs, fully compatible with gesture handlers).

3. **`@expo/ui` `Button` with `systemImage` only (no `label`) renders invisible.**
   The `Host matchContents` sizes to the SwiftUI content, but a Button with only `systemImage` and no `label` prop may collapse to zero size. Always provide `label` if using `systemImage`, or use a regular `Pressable` + lucide icon for icon-only buttons.

4. **`react-native-worklets` version matters.** v0.8.x is NOT compatible with `react-native-reanimated` 4.2.x. The Reanimated podspec validates the worklets version and fails `pod install` if incompatible. Use `react-native-worklets@0.7.1`.

5. **Do NOT wrap `Sortable` in `DropProvider` or `GestureHandlerRootView`** — it creates its own internally. Nesting causes gesture conflicts.

6. **`Sortable` has a hardcoded `backgroundColor: 'white'`** — override via `style={{ backgroundColor: 'transparent' }}`.

7. **`SortableItem.Handle` MUST be a direct child of `SortableItem`.** Use handles when items contain interactive elements (Pressable, buttons) to prevent drag conflicts.

8. **Items MUST have `id: string`** (not number). Missing or duplicate IDs cause silent broken reordering.

9. **`useFlatList={false}`** renders items in a plain ScrollView instead of FlatList. Use this when the Sortable is inside a fixed-height container to avoid nested scroll conflicts.

10. **`onSummaryFieldsChange` expects a plain array, not a setter function.** Passing `(prev) => newArray` instead of `newArray` was an early bug — the callback is not React's `setState`.

11. **Duplicate React keys from field labels.** Payload's `_status` field (draft/published) has label "Status", and users can create their own `status` field with the same label. Use field **names** (unique in schema) as React keys, never labels.

### Icons used (lucide-react-native)
- `GripVertical` — drag handle (reorder grip)
- `CircleCheck` — selected/active field checkbox
- `Circle` — unselected/available field checkbox
- `Check` — save button icon (white on primary circle)

---

## Native iOS Liquid Glass UI (2026-04-03)

### Stack.Toolbar — Native header buttons
Collection list and document edit headers use `Stack.Toolbar` (expo-router) instead of JS `Pressable` + lucide icons on iOS. Renders as native UIKit toolbar items with SF Symbols and system liquid glass animations.

```tsx
// Page component (not layout) — place as sibling of Stack.Screen
<Stack.Toolbar placement="right">
  <Stack.Toolbar.Button icon="gearshape" onPress={...} />
  <Stack.Toolbar.Menu icon="ellipsis.circle" title="Actions">
    <Stack.Toolbar.MenuAction icon="clock.arrow.circlepath" onPress={...}>Versions</Stack.Toolbar.MenuAction>
    <Stack.Toolbar.MenuAction icon="arrow.down.doc" onPress={...}>Unpublish</Stack.Toolbar.MenuAction>
  </Stack.Toolbar.Menu>
</Stack.Toolbar>
```

- `Stack.Toolbar` is iOS-only (`@platform ios`). Android uses `headerRight` with Pressables.
- Button `icon` accepts SF Symbol names as strings.
- Must be a direct child of `Stack.Screen` (in layout) or top-level in page component.

### GlassView — Liquid glass containers (iOS 26+)
Used for sidebar nav items, dashboard cards, account cards, login button, form structural fields (groups, collapsibles, array rows, blocks).

```tsx
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
const liquidGlass = isLiquidGlassAvailable()  // synchronous, cached

// Interactive (press/hover feedback):
<GlassView style={{ borderRadius: 16, padding: 16 }} isInteractive glassEffectStyle="regular">
  {children}
</GlassView>

// Static (decorative glass only):
<GlassView style={{ borderRadius: 16, padding: 16 }} glassEffectStyle="regular">
  {children}
</GlassView>
```

- `isLiquidGlassAvailable()` returns false on iOS < 26 and all non-iOS. Always guard with fallback.
- `isInteractive` enables native press/hover states — use on buttons, nav items, tappable cards.
- `glassEffectStyle="regular"` is the standard frosted glass. No `tintColor` needed for most uses.
- Active nav items can use `tintColor="rgba(0,122,255,0.15)"` for blue tint.

### @expo/ui SwiftUI modifiers — `glassEffect` for interactive controls

The `glassEffect` modifier is available in the native component registry (`nativeComponents.glassEffect`) and MUST be applied to all native SwiftUI controls (Picker, Toggle, etc.) for proper interaction on iOS 26:

```tsx
modifiers={[
  nativeComponents.pickerStyle!('segmented'),
  nativeComponents.glassEffect!({ glass: { variant: 'regular', interactive: true } }),
]}
```

### @expo/ui Modifier functions — MUST use function calls, not object literals

**CRITICAL**: SwiftUI modifiers MUST be created via factory functions, not plain objects. The functions set an internal `$type` discriminator that the native bridge requires. Without it, the modifier is silently ignored.

```tsx
// ✅ CORRECT — function calls from nativeComponents registry
modifiers={[nativeComponents.pickerStyle!('segmented')]}
modifiers={[nativeComponents.tag!(String(i))]}

// ❌ WRONG — object literals (missing $type, silently ignored)
modifiers={[{ pickerStyle: 'segmented' }]}
modifiers={[{ tag: i }]}
```

This was the root cause of tabs rendering as dropdown/wheel pickers instead of segmented controls.

### NativeHost — `matchContents` affects touch hit-testing

`NativeHost` wraps `@expo/ui` `Host` for SwiftUI components. The `matchContents` prop controls how the SwiftUI view is sized relative to its React Native parent:

- `matchContents={true}` (default) — size to content. Good for inline Toggle, small controls.
- `matchContents={{ width: false, height: true }}` — stretch width, match height. For pickers.
- `matchContents={false}` — stretch to fill RN parent entirely. **Use this for interactive controls** where touch area must match the visual frame exactly.

When `matchContents` is true, the Host creates an intermediate layout measurement pass that can cause touch targets to misalign with the visible SwiftUI frame.

### Native segmented picker for Payload Tabs

Payload `tabs` fields render as native `UISegmentedControl` via `@expo/ui` `Picker` with `pickerStyle('segmented')`:

- Uses `TabDepthContext` for nesting awareness (depth 0, 1, 2...)
- All depths use the native segmented picker when available (threshold: ≤6 tabs)
- Falls back to a pill-style bar (React Native) that mimics the segmented look
- `TabContent` wraps children in `TabDepthContext.Provider` with `depth + 1`
- Only the active tab's content renders (inactive tabs unmount entirely)
- Keys include parent tab name to avoid collisions: `${activeTab.name}-${sub.name}`
- Tags and selection use `String()` types for consistent JS↔native bridge matching

### RESOLVED: Native Picker selection not working (2026-04-03)

**Status: FIXED.** Root cause was `glassEffect({ glass: { variant: 'regular', interactive: true } })` modifier applied directly to Picker components.

**Root cause:** The `glassEffect` modifier with `interactive: true` creates its own gesture recognizer for press/hover states. When applied to a native `Picker` (which has its own built-in tap gesture handling), the glass effect's gesture handler consumed touch events before they reached the Picker's selection handler. Visual press feedback worked (handled by glass effect), but `onSelectionChange` never fired.

**Fix:** Removed `glassEffect` modifier from all native Picker modifiers:
- `structural.tsx` TabsField: modifiers now `[pickerStyle('segmented')]` only
- `pickers.tsx` SelectFieldNative: no modifiers (default menu picker)
- `pickers.tsx` RadioFieldNative: `[pickerStyle('segmented')]` only (when ≤5 options)

On iOS 26, `UISegmentedControl` and native Picker already have system-level liquid glass rendering — the explicit modifier was redundant and harmful.

### ALSO RESOLVED: Native Picker STILL not tappable after glassEffect removal (2026-04-03)

**Status: FIXED.** Second root cause was `matchContents={false}` on the `@expo/ui` Host wrapper.

**Root cause:** `NativeHost matchContents={false}` omitted the `matchContents` prop from the `@expo/ui` Host entirely. The Swift `HostViewProps` defaulted both `matchContentsHorizontal` and `matchContentsVertical` to `false`, so SwiftUI never reported its content height (~32px for segmented controls) back to React Native via `shadowNodeProxy.setStyleSize()`. The RN UIKit frame collapsed to **zero height**. SwiftUI rendered the control visually (SwiftUI rendering is NOT clipped by the UIKit frame), but UIKit's `point(inside:with:)` returned `false` for every touch — the zero-height frame contained no hittable area.

**Fix:** Changed all interactive Picker Hosts from `matchContents={false}` to `matchContents={{ height: true }}`:
- `structural.tsx` TabsField: `<NativeHost matchContents={{ height: true }}>`
- `pickers.tsx` SelectFieldNative: `<NativeHost matchContents={{ height: true }}>`
- `pickers.tsx` RadioFieldNative: `<NativeHost matchContents={{ height: true }}>`

Width is still controlled by RN layout (`alignSelf: 'stretch'`). Height is measured by SwiftUI and reported to RN.

**NativeHost.tsx updated:** Translates `{ width, height }` shape → `{ horizontal, vertical }` for `@expo/ui`'s Host API.

### Key rules for `@expo/ui` Host `matchContents`
1. **`matchContents={true}`** — SwiftUI controls both width and height. Good for inline components like Toggle.
2. **`matchContents={{ height: true }}`** — RN controls width, SwiftUI controls height. **Use for Pickers, segmented controls, and any control that needs to fill available width but has intrinsic height.**
3. **`matchContents={false}`** — RN controls both axes. Host WILL NOT report size. **Only use when the RN parent has an explicit fixed size.** Interactive SwiftUI controls inside will be INVISIBLE TO TOUCH.
4. Do NOT apply `glassEffect({ interactive: true })` to SwiftUI controls — they have their own gesture handling. Use `glassEffect` on container Views (`GlassView` from `expo-glass-effect`) instead.

---

## admin.width Field Layout (2026-04-03)

### How it works
Consecutive fields with `admin.width` are automatically grouped into flex rows. A `groupFieldsByWidth` helper splits field arrays into groups:
- `{ type: 'single', field }` — fields without width (full width)
- `{ type: 'width-row', fields: [...] }` — consecutive width fields (side-by-side)

### Width applied as flex proportion
```tsx
// Same approach as RowField:
<View style={{ flex: parseFloat(field.admin.width) / 100 }}>
  {renderField(field, path)}
</View>

// Two 50% fields → flex: 0.5 each → split evenly (minus gap)
// One 60% + one 40% → flex: 0.6 and 0.4 → proportional split
```

### Where it applies
- **DocumentForm** `renderFields`: top-level fields
- **GroupField** body: sub-fields within named/unnamed groups
- **CollapsibleField** body: sub-fields within collapsibles
- **TabContent**: sub-fields within tab panels
- **ArrayField** rows: sub-fields within each array item
- **BlocksField** rows: sub-fields within each block item
- **RowField**: keeps its own existing flex-proportion logic (unchanged)

### Key rules
1. `admin.width` values are CSS percentage strings (e.g. `'50%'`).
2. `parseFloat('50%')` gives `50`, then `/100` gives flex `0.5`.
3. Fields without `admin.width` that are NOT part of a consecutive group render full-width.
4. RowField still uses its own width logic (not `groupFieldsByWidth`) — it wraps ALL children in a flex row regardless of whether they have `admin.width`.
5. The `widthRow` style is `{ flexDirection: 'row', gap: spacing.md }` — identical to RowField's `rowContainer` minus the `marginBottom`.

### iOS form field styling

Input fields (`inputs.tsx`) use iOS-native form style:
- No bordered boxes — only `borderBottomWidth: StyleSheet.hairlineWidth` separator
- Transparent background, flush with form container
- Textarea and code fields keep a light border (multi-line editing needs visible bounds)

Field labels (`FieldShell.tsx`) use iOS Settings style:
- Small, uppercase, muted color, tight `letterSpacing: 0.3`
- `marginBottom: 2` between label and input (tight coupling)
- `marginBottom: md` (12px) between fields

---

## Design Language — Charts & Data-Visualization Surfaces (2026-06-12, standing directive)

All current and FUTURE chart/data-viz views (kanban, calendar, gantt, and any
charts to come) follow the established design language — liquid glass and
native components throughout:

1. **Liquid glass first.** Containers, headers, cards, bars, chips: GlassView /
   GlassEffectContainer guarded by `isLiquidGlassAvailable()`, with
   BlurView → bordered-solid fallback tiers. Never double-apply glass on
   system surfaces that already render it (sheets, segmented controls).
2. **Native components via the registry.** Controls come from `nativeComponents`
   (SwiftUI on iOS, JC* on Android): segmented Pickers for mode switches,
   Toggle (`toggleStyle('button')`) for selection chips, Toggle switches for
   visibility, Menu/ContextMenu for item actions, ColorPicker for color
   choices. Selection state is never just font-weight/opacity — use real
   toggle affordances (filled + checkmark fallback).
3. **Static charts: use `@expo/ui` Chart** (already registered: bar/line/pie/
   area/point) before reaching for any third-party charting library. New
   native chart pods require the ObjC class-collision check (DayView lesson)
   and a binary build — strongly disfavored. (Evaluated GraphKit 2026-06-12:
   WIP, static-only — inspiration not adoption.)
4. **Interactive/editable viz is JS-composed** on the proven gesture tier:
   PanResponder with capture-phase handoff, static-hold peek disambiguation,
   scroll locking, idempotent completion (see the Kanban/Gantt patterns).
   Injection-friendly package contracts: no expo-router, no data fetching;
   screens supply docs + callbacks through the local-first pipeline.
5. **One palette source**: `useListColors` (JS) / dynamic UIColor providers
   (Swift). Source/series colors from the shared palette by index, tinted
   accents at low alpha over glass. SF Symbols in native menus/toolbars;
   lucide in JS and gesture trees.
6. **Shared scheduling layer** (`admin-native/src/scheduling/`) is the single
   home for source→event mapping, date math, and eligibility for every
   time-based view — extend it rather than duplicating per view.
7. **Tables**: sticky header row and a frozen (pinned) first column are the
   DEFAULTS for every tabular surface (document list table mode, join tables,
   future data grids), horizontally scrollable beyond the viewport with
   type-aware fixed column widths. Both pins are user-customizable per
   collection (settings sheet toggles, persisted with the other list config).

---

## Turbopack / Monorepo

### Root node_modules symlink
`payload_expo_tauri/node_modules → test_app/node_modules` **MUST exist**. Turbopack with `root: monoRoot` resolves transitive deps (`@floating-ui/react`, `clsx`) through this symlink. Deleting it crashes `/admin`.

### Cache clearing
If Turbopack fails after config changes, delete `test_app/apps/server/.next` and restart.

---

## JC* Registry Key Convention (2026-06-10)

Android Jetpack Compose components whose APIs diverge from their SwiftUI counterparts get **distinct `JC*` keys** in the native component registry — never overload the iOS key with a different prop shape.

| Key | API shape |
|---|---|
| `JCPicker` | `{ options, selectedIndex, onOptionSelected, variant: 'segmented' \| 'radio' }` — options-based, not children-based |
| `JCBottomSheet` | `{ isOpened, onIsOpenedChange }` |
| `JCSwitch` | `{ value, onValueChange }` |
| `JCTextInput` | Uncontrolled (`defaultValue` + `onChangeText`), **no placeholder support** |
| `JCDateTimePicker` | Compose date/time picker |
| `JCButton` | Children, not `label` prop |
| `JCChip`, `JCAlertDialog` | Compose-specific |

Components with matching shapes share keys (`Host`, `Text`, …). Field components branch: `nativeComponents.Picker` (iOS) → `nativeComponents.JCPicker` (Android) → JS fallback. `fields/shared/types.ts` documents the full verified surface (43 iOS components + 38 modifier factories) — **read it for exact shapes; do not trust online docs** (registry reflects the canary binary, see version-pinning gotcha below).

---

## Uncontrolled Native Text Bridge (2026-06-10)

SwiftUI `TextField`/`SecureField` and `JCTextInput` are **UNCONTROLLED**: mount with `defaultValue`, listen via `onChangeText`, set programmatically only via `ref.setText`. Echoing keystrokes back as a controlled `value` causes cursor jumps / dropped input.

`fields/inputs/textBridge.ts` (`useNativeTextBridge`) bridges this to react-hook-form's controlled values via `lastFormValueRef`:
1. `lastFormValueRef` records the last string the bridge knows the form holds.
2. Keystrokes flow native → `handleChangeText` → form; the returned canonical string updates `lastFormValueRef` (keystrokes are never pushed back into the native field).
3. An external-sync effect pushes text INTO the native field via `ref.setText` **only** when the form value changes from outside (RHF `reset` / programmatic `setValue`) — detected as `externalText !== lastFormValueRef.current`.

Same epoch-remount idea applies to the SwiftUI `Stepper` (also uncontrolled, `defaultValue` + `onValueChanged`): remount with a bumped `key` when the external value diverges. The controlled `value`/`onValueChange` props it appears to accept **never fire**.

---

## BottomSheet Detents API (2026-06-10)

`BottomSheet` (still a JS Modal — RNHostView not in registry) accepts `detents?: SheetDetent[]` where a detent is `'medium' | 'large'` (system semantics: 0.5 / ~0.95) or a fraction:

```tsx
<BottomSheet visible={v} onClose={close} detents={['medium', 'large']}>
```

- Multiple detents → drag snaps between them with velocity-based snap + rubber-banding at the extremes.
- Legacy `height` prop still works (treated as a single detent; defaults to 0.5).
- Keyboard handling and glass/blur/solid background tiers built in.
- Reminder: any `DocumentForm` rendered inside must pass `nativeForm={false}` (see rule below).

---

## ConditionContext Registration (2026-06-10)

`admin.condition` functions can't serialize through the JSON admin-schema, so they follow the same Metro-bundled pattern as client validators and action handlers:

1. **Server**: admin-schema emits condition markers (which slug→field paths have conditions) and re-attaches `admin.hasCondition`.
2. **App**: registers the actual functions in `test_app/apps/mobile-expo/src/conditions/index.ts` — a `ConditionRegistry` keyed `{ [slug]: { [fieldPath]: (data, siblingData) => boolean } }`.
3. **Mount**: `ConditionRegistryProvider` in `app/_layout.tsx` (next to ActionRegistryProvider).
4. **Evaluate**: `FieldRenderer` resolves via `resolveFieldCondition` / `evaluateFieldVisibility` (`admin-native/src/contexts/ConditionContext.tsx`) against **live form data**. **Fail-open**: a field whose condition is marked but unregistered (or throws) stays visible — never hide data on a registry miss.

---

## nativeForm={false} in Sheets (2026-06-10) — superseded 2026-06-11

> **Phase 25 update:** the default flipped. `nativeForm` is now **opt-in** (`nativeForm === true`); see "Native SwiftUI Form Is Opt-In" below. The unsized-container rule below still applies to anyone who opts in.

`DocumentForm` used to default `nativeForm` to true on iOS when all fields are Form-compatible, rendering one full-screen SwiftUI `Form`. A SwiftUI Form needs a sized container to lay out; in an **unsized container the Form's UIKit frame is zero-height and swallows every touch** (same root cause as the `matchContents={false}` hit-testing bug).

**Rule:** every `DocumentForm` mounted inside a formSheet route, the details sheet, a `BottomSheet`, or any other unsized/modal container MUST pass `nativeForm={false}`. Applied in: `[slug]/details.tsx`, list-screen long-press preview, `RelationshipInlineCreate`.

---

## @expo/ui Canary Version Pinning Gotcha (2026-06-10)

Two `@expo/ui` versions coexist in the pnpm workspace:
- `test_app/apps/mobile-expo/node_modules/@expo/ui` → **`55.0.0-canary-20260128-67ce8d5`** — compiled into the native binary. The only truth.
- `test_app/node_modules/@expo/ui` (root hoist) → `55.0.6` — wrong; Metro's custom `resolveRequest` pins all `@expo/ui/*` imports to the app copy (see Metro resolver section above), but **tooling, editors, and root-level `require.resolve` will happily find 55.0.6**.

The canary **lacks** `ControlGroup`, `ConfirmationDialog`, and swift-ui `ScrollView` — components that exist in 55.0.6 and in online docs. Writing code against the wrong surface produces undefined-component runtime crashes that typecheck fine.

**Rule:** before using any @expo/ui component or prop, verify it exists in `test_app/apps/mobile-expo/node_modules/@expo/ui/build/` (or check the registry in `fields/shared/types.ts`, which mirrors the verified canary surface). Never trust the hoisted copy or documentation.

---

## Telegram-Style Peek Module (2026-06-11)

`modules/scrollable-preview` rebuilt Telegram-style (sources studied: Telegram-iOS ContextGesture/PeekController/PeekControllerNode). No `UIContextMenuInteraction`.

### Architecture (iOS)
- **Dedicated `.alert`-level UIWindow** mirroring the host window's frame — source-rect/handoff coordinates map 1:1 even when the trigger is inside an RN Modal, and Modal teardown can never reparent or kill the overlay.
- **Modal-safety:** a `willMove(toWindow:nil)` hook on the trigger tears the peek down synchronously if the enclosing Modal/BottomSheet closes mid-peek.
- RN Content reparented into a 16pt-continuous rounded shadowed container over `UIVisualEffectView` blur + dim; spring morph from/to the trigger's on-screen rect (`UIViewPropertyAnimator` 0.42s, damping 0.8); medium impact haptic on open.
- **Scrolling fix is JS-side:** Trigger resolves the preview size (default 92% w × 65% h; `previewWidth`/`previewHeight`/`previewHeightFraction`) and provides it via internal context; Content styles itself `position:absolute` at exactly that size, so Yoga layout matches the native frame and inner ScrollViews/FlatLists get correct content sizes and scroll natively after finger-lift (interactive mode).
- Actions: native glass capsule rows; pan-while-held highlight (12pt threshold, selection haptic), lift performs. Dismissal: backdrop tap, scroll-aware swipe-down (engages only when the touched scroll view is at top; spring-back below 140pt / 900pt-per-s), tap-on-preview fires `onPrimaryAction`.
- Android: full-screen Dialog (`FLAG_DIM_BEHIND` 0.55), rounded clipped card preserving RN-computed layout, pill action rows, tap-outside/back/fling-down dismissal, content restored to original parent on dismiss/detach.

### Consumer rules
1. Consume ONLY via `useScrollablePreview()` context — fallback-safe (plain rows when the module is absent).
2. `useIsInsidePreview` (set by BottomSheet) MUST gate peek triggers — never nest native peeks inside sheets/previews.
3. Interactive Pressables (row up/down/X buttons) stay OUTSIDE the Trigger to avoid recognizer fights.
4. Peeked `DocumentForm` gets `nativeForm={false}` + `PreviewContextProvider value={true}`.
5. JS API is backward compatible; `previewHeightFraction` is the only Phase-24 addition. The module exposes NO Modal-safety capability flag — code that must work against an old binary keeps the pure-JS inline preview.

---

## OR-Group Filter Shape (2026-06-11)

`ActiveFilter` carries optional `groupIndex` (default 0). Conditions **AND within a group, groups OR across**:
- Single group → flat `{ and: [...] }`-equivalent shape (exactly the pre-Phase-24 serialization — backward compatible).
- Multiple groups → `{ or: [{ and: [...] }, { and: [...] }] }` (web WhereBuilder parity).

UI: FilterBottomSheet OR-group overview step + AND/OR group choice at the value step; the choice rides the existing `onApply` payload (`newGroup` flag) so `DocumentList` integration is unchanged. Chips cluster by group with an 'or' micro-label divider.

**Persistence** (`hooks/useDocumentListFilters.ts`): per collection under `list_filters:{slug}` as versioned `{ v: 2, groups: PersistedFilter[][] }`; a legacy flat `ActiveFilter[]` array is still read gracefully (ids regenerated). Local evaluator handles arbitrary `or`/`and` nesting; empty `or` is vacuous-true. Operator matrix mirrors web `field-types.tsx`; `in`/`not_in` on scalar fields take comma-separated input (accepted by both REST and the local evaluator).

---

## Bulk Edit Flow (2026-06-11)

`src/components/BulkEditSheet.tsx` (app-level, web EditMany parity):
1. **Field picker** over bulk-editable root fields — flattens row/collapsible/unnamed-tabs; skips richText/join/ui, structural containers, upload-hasMany, polymorphic relationships, unique/hidden/readOnly, `admin.disableBulkEdit`.
2. **Single-field input** via the normal `FieldRenderer` — renders in non-native-Form fallback mode (NativeFormContext defaults false in the unsized Modal; the `nativeForm={false}` rule by another name) + Save / Save Draft / Publish segmented choice when drafts are enabled (`_status` rides the save mode).
3. **Apply**: per selected doc, the single-field patch is **merged over the full stripped original** before `useValidatedMutations.update` — whole-doc validation must pass; live "Updating i of N" progress, ok/failed toast, selection-mode exit.

Selection mode is reachable for every collection (iOS Actions toolbar menu always rendered; Android CheckSquare header button unconditional); `SelectionActionBar` prepends 'Edit Selected' ahead of custom `listActions`.

---

## Native SwiftUI Form Is Opt-In (2026-06-11)

The full-screen SwiftUI `Form` path in `DocumentForm` **crashed natively on-device** (no JS stack) for every collection whose entire field tree is Form-compatible — Events and the SiteSettings/Footer globals had no richText/join field to force the carve-out, so `canUseNativeFormForFields` returned true and they rendered one `NativeHost > Form`. `FormCrashBoundary` is `getDerivedStateFromError` — it catches JS render errors only, so the auto-fallback never fired for native crashes.

**Rules:**
1. The gate is strict `nativeForm === true` in BOTH DocumentForm variants (RHF ~line 547, Legacy ~line 1104). Never restore `nativeForm ?? true`.
2. No screen currently opts in. Re-enabling requires native-side debugging first; prime suspect: raw RN views (relationship rows, array/blocks editors, upload pickers, Pressables, FlatLists) as direct children of SwiftUI Form/Section cells fighting UIKit/SwiftUI List self-sizing.
3. Do not rely on `FormCrashBoundary` for anything native — it cannot see native crashes.

---

## initialData Must Be Identity-Stable (2026-06-11)

`initialData={(doc) ?? {}}` (or any inline object/`toJSON()` clone) creates a NEW identity every render. react-hook-form 7.72 re-stores live props on `control._options` EVERY render, so an unstable initialData leaks into dirty tracking (`_getDirty()` deep-compares against `_defaultValues`; with `{}` defaults registered keys never match) and, combined with on-device native control echoes (e.g. DatePicker fires `onDateChange` once at mount; an empty DateField seeding `selection={new Date()}` is a different prop every render), produced "Maximum update depth exceeded" on the details sheet.

**Rules:**
1. Empty fallbacks are module-scope constants: `const EMPTY_DOC: Record<string, unknown> = {}` — never inline `?? {}` / `initialData={{}}` in JSX.
2. Mount `DocumentForm` only after the local doc has resolved (loading gate) — RHF captures `defaultValues` AT MOUNT ONLY; mounting with `{}` leaves fields empty forever even after data arrives.
3. Defense-in-depth: the public `DocumentForm` wrapper runs `useStableInitialData` (deep-equal ref latch via `utils/diff.ts` deepEqual), so a new-but-equal object from any caller returns the same reference. Keep it.

---

## Auto-Grow Measurement Must Exclude Padding (2026-06-11)

RN maps a multiline TextInput's padding to `UITextView.textContainerInset` on iOS, so `onContentSizeChange`'s `contentSize.height` ALREADY includes the padding. Computing `height = contentHeight + padding` double-counts it; and while `scrollEnabled={false}` a UITextView's contentSize tracks `max(textHeight, bounds.height)`, so each applied inflated height echoes back bigger — the textarea grew by 2×padding per cycle and surrounding collapsible LayoutAnimation "went berserk".

**Rules (see TextareaField in `fields/inputs.tsx`):**
1. Measured size and applied height must share ONE coordinate space: put padding on a wrapper View, zero it on the TextInput.
2. Clamp into `[minContentHeight, maxContentHeight]` BEFORE storing the measurement; re-clamp at render (rotation can shrink the max).
3. Guard the setState: functional updater that bails unless the delta exceeds a jitter threshold (>2px for heights, >1px for layout-width estimates) — bounds-derived echoes and Android density rounding must never re-render.

---

## NativeWind Dark Tokens: Runtime vars(), Not Media Queries (2026-06-11)

`@media (prefers-color-scheme: dark)` blocks in global.css compile fine for native but are DEAD at runtime: react-native-css-interop resolves `:root` variables and `dark:` variants against a private module-level `systemColorScheme` observable that is snapshotted once at bundle eval (`Appearance.getColorScheme() ?? 'light'`) and only updated by an Appearance listener that DROPS events while `AppState !== 'active'`. At dev-client launch it sticks on 'light' forever, while RN's `useColorScheme()` correctly reports dark → mixed light/dark UI.

**Rules:**
1. Native theme tokens come from `ThemeVarsProvider` in `app/_layout.tsx`: NativeWind `vars()` derived from `useListColors` (inline vars beat rootVariables in css-interop's resolution order and re-render via ordinary React state). The :root/media blocks in global.css are web-only + static fallback; keep them in lockstep with `useListColors`.
2. Avoid `dark:` Tailwind variants in app code — they ride the stuck-prone observable. Use the token classes (paper/surface/ink/ink-muted/line/danger/danger-bg/warn/warn-bg).
3. The appearance preference goes through nativewind `colorScheme.set(pref)` in `src/preferences.ts` ('system'|'light'|'dark') so RN palettes, the vars provider, and any residual `dark:` variants flip on one switch.
4. `useListColors` is the single source of truth for scheme-aware color in package JS AND app tokens AND explicit native tints (header/toolbar `tintColor`).

---

## formSheet/Modal Headers Need headerRight Fallbacks (2026-06-11)

`DocumentForm` renders NO submit button — `submitLabel` is a dead prop; saving works ONLY via the exposed form ref from a header/toolbar affordance. create.tsx shipped with zero save UI because nobody wired one. Separately, icon-only `Stack.Toolbar.Button` items inherit the navbar tint and can render invisible; the experimental Stack.Toolbar pipeline (expo-router canary → RNS rightBarButtonItems) can also be silently dropped by an older dev-client binary.

**Rules:**
1. Every screen mounting `DocumentForm` MUST provide a save affordance via the form ref (headerRight or Stack.Toolbar) — there is no in-form fallback.
2. Modal/formSheet routes use `headerRight`, not Stack.Toolbar (the experimental toolbar pipeline is unreliable there; the rendered Cancel headerLeft proves headerRight works).
3. Toolbar save buttons are LABELED text buttons (`children="Save"`, `variant="done"`) with explicit `tintColor` from `useListColors` — icons suppress labels in header items and inherit ambient tints.
4. Gate native Stack.Toolbar on API presence and render the JS headerRight fallback whenever it is unavailable — on ALL platforms, not just non-iOS. If the toolbar is empty on a device whose binary predates RNS 4.20 bar-button items, force `useNativeHeaderToolbar` to false in `[id].tsx`.

---

## Kanban Board Injection Contract (2026-06-11)

`@payload-universal/admin-native/src/kanban/` (types / KanbanCard / KanbanColumn / KanbanBoard / index barrel). The board NEVER imports expo-router and NEVER fetches — the screen supplies everything (DocumentList renderRow pattern).

**Screen → board contract (`KanbanBoardProps`):**
- `docs` — already-filtered local-first docs (screen runs `useDocumentListFilters` + `applyWhereToDocs` + sort).
- `statusField: { name, options, label? }` — the plain select (or radio) driving columns. Eligibility lives in the SCREEN (`isEligibleStatusField`: select `hasMany:false` with options, or radio with options; `admin.hidden` excluded) — the board trusts its input.
- `columnOrder?` (subset first, missing options appended in option order), `columnColors?` (else `DEFAULT_KANBAN_PALETTE[optionIndex % len]` — stable by OPTION index, not display order), `hiddenColumns?` (docs in hidden columns are DROPPED, not shunted; sentinel `NO_STATUS_COLUMN_VALUE = '__no_status__'` hides the trailing "No <label>" null column).
- `cardFields?`/`fieldLabels?`/`useAsTitle?` — card body rows, DocumentList value-formatting conventions (`formatKanbanFieldValue`).
- `onPressCard`, `onMoveCard(doc, toValue: string | null)` (screen patches `{[statusField.name]: value}` via `useValidatedMutations.update`; board swallows rejections — surface errors in the screen), `loadingDocIds` (dimmed mid-move).
- `onLongPressCard?` — wired ONLY when reanimated-dnd is absent (drag owns long-press otherwise). `renderCard?(doc, defaultCard)` — screen wrapper (e.g. `ScrollablePreview.Trigger` peek); when dnd is active it renders INSIDE a Draggable, so it must stay pure RN (no @expo/ui).

**Internal rules (hard-won):**
1. dnd is optional-required (try/catch require). The guaranteed fallback is the ellipsis "Move to <column>" menu — registry SwiftUI `Menu` when NOT inside a Draggable; lucide ellipsis + BottomSheet (Modal portals out of the gesture tree) when dnd wraps the card (`insideDraggable` prop downgrades the tier).
2. Column FlatLists clip on iOS → the board renders a finger-following Animated **drag-overlay copy** (real card hides, layout kept) in the SAME origin+translation space as the lib, so collision detection matches visuals.
3. Edge-hover auto-scrolls one column per cooldown and re-measures drop targets after EVERY scroll; user scroll locks mid-drag; card taps gate during drag.
4. Per-collection persistence is app-side: `useKanbanConfig` (`kanban_config:{slug}`) + `useListViewMode` (`list_view_mode:{slug}`), AsyncStorage, corrupt-entry-safe.
5. View-selector toolbar gotcha: two sibling `Stack.Toolbar placement="right"` elements OVERRIDE each other (both set `unstable_headerRightItems`) — the view-mode Menu group must live FIRST inside the single right toolbar, before the Actions menu.
6. Customize sheet (app-side `KanbanCustomizeSheet`): reanimated-dnd Sortable rows per the Drag-to-Reorder rules (noop `onMove`, `onDrop` allPositions, lucide-only inside Sortables, `useFlatList=false`, fixed heights); registry `ColorPicker` is null-checked and rendered OUTSIDE both Sortable trees.

---

## View Presets + Query Presets (2026-06-11)

Two preset systems, deliberately different transports:

**View presets (`view-presets` collection — SYNCED).** Slug has no `payload-` prefix, so LocalDBProvider replicates it like any content collection; boards/views work offline. Server access: read = owner OR `accessMode==='everyone'` OR (`'specificUsers'` AND user ∈ `sharedWith`); update/delete OWNER-ONLY; `beforeChange` pins `owner` and always includes the owner in `sharedWith` for specificUsers (lockout prevention). App side: `useViewPresets(slug)` (local-first CRUD, defensive access re-filtering against stale local docs, json-convention sanitizing) + `PresetsSheet` (save-as / My-Shared sections / apply-on-tap / registry-Menu row actions / sharing UI). Lift mapping: `hiddenColumns` has NO server counterpart — dropped on lift, reset to `[]` on apply. Applying a preset sets view mode + board config + BOTH filter pipelines (kanban screen-hosted hook directly; table via an epoch-bumped DocumentList prop).

**Query presets (`payload-query-presets` — REST-ONLY).** Auto-registered by `enableQueryPresets: true` + root `queryPresets` config; powers the WEB admin's filter/column presets. The `payload-` prefix excludes it from RxDB sync BY DESIGN — mobile lists/saves via `payloadApi` REST (`where[relatedCollection][equals]=slug`; create POSTs the canonical `{ title, relatedCollection, where, columns }` shape from payload-main's query-presets config). FilterBottomSheet's overview step hosts the UI: apply-on-tap converts Payload where → the sheet's OR-group model, with inline notes for operators the local evaluator lacks.

**Shared converters** (in `hooks/useDocumentListFilters.ts`, exported): `whereToFilterGroups` / `filtersToWhere` / `setFilterGroups`. Both preset systems and the OR-group sheet ride the same conversion — do not fork it.

---

## Uncontrolled Native Control Echo Rule (2026-06-11)

@expo/ui canary controls that take `defaultValue` (Stepper, DatePicker, the text bridge inputs) are UNCONTROLLED: the initial value is latched once natively, changes flow out via `onValueChanged`/`onDateChange`, and the native side REPLAYS echo events (`.onAppear` fires again whenever the host recreates the control, e.g. toolbar rebuilds; DatePicker fires once at mount; an empty DateField seeded with `selection={new Date()}` is a different prop every render).

**Rule: state must NEVER be echoed back into native props.** `defaultValue` (and labels derived from the state) must come from a mount-time constant or ref — wiring `defaultValue={stateValue}` recreates the control or replays echoes mid-update and re-arms the "Maximum update depth exceeded" class (memory-bank 008 Phase 25 item 2; api.tsx depth Stepper is the reference implementation). External resets go through an explicit remount (epoch key) or imperative `ref.setText`/`setValue` — never through the prop.

---

## usePreventRemove Unsaved-Changes Guard (2026-06-11)

`src/hooks/useUnsavedChangesGuard.ts` — pairs with DocumentForm's `onDirtyChange` contract:

1. The screen tracks dirty via `<DocumentForm onDirtyChange={setFormDirty} />` (RHF `isDirty`; resets after successful submit). The same flag drives the checkmark Save button (`checkmark.circle.fill`, `variant="done"`, enabled+blue when dirty, disabled+gray otherwise, explicit `useListColors` tints).
2. `usePreventRemove(dirty, cb)` (`@react-navigation/native`) intercepts back/swipe/dismiss and shows the discard confirm; on confirm it dispatches the stashed removal action.
3. Intentional navigations (save-then-navigate, delete, duplicate) call `allowLeave()` FIRST — a one-shot ref bypass consumed by the next removal attempt. Without it, your own `router.back()` after a successful save hits the guard.

---

## Calendar View Injection Contract (2026-06-12)

`@payload-universal/admin-native/src/calendar/` (types / eventMapping / MonthGridFallback / DayListFallback / CalendarView / index barrel). Mirrors the kanban contract: the component NEVER imports expo-router, NEVER fetches, and NEVER imports the app's native module — the screen injects everything.

**Screen → component contract (`CalendarViewProps`):**
- `docs` — already-filtered local-first docs (screen runs `useDocumentListFilters` + `applyWhereToDocs` + sort, same pipeline as kanban).
- `sources: CalendarSource[]` — `{ id, label, startField, endField?, color }`. `startField`/`endField` are **dot-paths** (`'scheduling.scheduledPublish'`) resolved via `getByPath` — the server `view-presets` json convention. Defaults come from `pickDefaultSources(dateFields)` (two-pass: `start*`/`starts*`↔`end*`/`ends*` + `*From`↔`*To` range pairing first, leftover date fields become point sources; ids = start field name, colors = `DEFAULT_CALENDAR_PALETTE[index]`, which IS the kanban palette).
- `useAsTitle?` — event titles via the `getDocumentTitle` fallback chain.
- `mode`/`onChangeMode` (`'month' | 'day'`), `selectedDate`/`onChangeSelectedDate` (LOCAL date keys `'YYYY-MM-DD'`) — fully controlled; the screen owns persistence (`useCalendarConfig`, `calendar_config:{slug}`; `sources: null` sentinel = "derive defaults so new date fields keep appearing").
- `onPressDoc(doc)` — event ids are `{docId}::{sourceId}`; recover the doc with `calendarEventDocId` (split on the LAST `'::'` — doc ids can't contain it, source ids might).
- `renderDocRow?(doc, defaultRow)` — screen wrapper injection around day-list rows (e.g. `ScrollablePreview.Trigger` peek); the default row already owns the press.
- `nativeModule?: CalendarNativeModule` — the app's `'@/modules/calendar-view'` module, injected as a prop and typed LOCALLY in the package (`{ isNativeCalendarAvailable, NativeCalendarMonth, NativeCalendarDay }`). `undefined` OR `isNativeCalendarAvailable === false` → pure-JS `MonthGridFallback`/`DayListFallback` render (Expo Go / Android / old dev clients).

**Internal rules:** Month/Day switch rides the registry SegmentedIndexPicker tiers (SwiftUI/JC/pill — @expo/ui via `fields/shared/` only); month paging via PanResponder; glass via expo-glass-effect optional-require with themed fallbacks; all colors `useListColors`. Mapping is tolerant by design: invalid/missing starts skip the (doc, source) pair, inverted ranges swap with a console.warn, `YYYY-MM-DD` values parse as LOCAL midnight and flag `allDay`, spans cap at `MAX_EVENT_SPAN_DAYS = 62`. Eligibility lives in the SCREEN: the calendar view-mode entry renders only when the collection has ≥1 date field (nested dot-paths count), and `isCalendar` re-checks it so a stale persisted mode degrades to table.

---

## Pod Dependencies in Local Expo Modules (2026-06-12)

`modules/calendar-view` is the reference: a local Expo module's podspec can pull third-party CocoaPods (`s.dependency 'HorizonCalendar', '~> 2.0.0'` + `s.dependency 'CalendarKit', '~> 1.1.9'` in `ios/ExpoCalendarView.podspec`) and autolinking picks the module up with zero package.json changes. Rules:

1. **Pin versions** (`~>` pessimistic constraint) and verify each is actually published on CocoaPods trunk AND compatible with the app's deployment target (iOS 15.1) BEFORE writing the podspec — the first compile happens remotely.
2. **Pods install only on the next EAS build / prebuild.** Locally the Swift never compiles, the native module does not exist in any installed dev client, and `pod install` is never run by Metro. Treat every new-pod module as **REQUIRES NEW EAS BUILD**.
3. Because of (2), the TS layer MUST be guarded: `requireNativeModule(name)` inside try/catch (it throws in Expo Go and in dev clients built before the module existed), exporting an availability flag (`isNativeCalendarAvailable`) plus empty-View component stubs. Callers branch on the flag and supply JS fallbacks — never assume the native side exists.
4. iOS-only modules declare `"platforms": ["apple"]` in `expo-module.config.json`; Android then resolves the same JS API with the flag `false` (no empty android/ scaffold needed).
5. Keep the contracted public API in a `.ts` file (use `React.createElement`, not JSX) when other packages are typed against the exact path; `index.web.tsx` carries web no-ops.
6. Swift side: parse props defensively (skip bad dates/ids, never crash on user data) and diff prop updates (Equatable) before reloading the native view — RN re-sends props on every render.

---

## Shared Scheduling Module Pattern (2026-06-12)

`admin-native/src/scheduling/` is the shared, view-agnostic source/event layer behind every scheduling surface (calendar AND gantt). It is **pure data and math only** — no React components, no rendering constants, no imports from calendar/ or gantt/.

### What lives in scheduling/

| File | Contents |
|---|---|
| `types.ts` | `ScheduleSource` / `ScheduleEvent` / `ScheduleDoc` canonical names; `Calendar*` aliases for backward compat; `DEFAULT_SCHEDULE_PALETTE` |
| `dateKeys.ts` | `toDateKey`, `todayDateKey`, `addDaysToKey`, `parseDateKey`, `weekStartKey`, `weekKeysForDate`, `isoToDate`, `normalizeDateKey`, `getFirstDayOfWeek` — all LOCAL-time, DST-immune |
| `eventMapping.ts` | `docsToScheduleEvents`, `pickDefaultSources`, `collectionHasScheduleDateFields`, `INTERNAL_DATE_FIELDS`, `scheduleEventDocId` — and Calendar* aliases |
| `events.ts` | `buildEventsByDateKey`, `eventOccursOnDate`, `formatEventTimeRange`, `formatLongDate`, `formatTimeOfDay`, `formatWeekRangeLabel`, `isMultiDayEvent` |
| `ganttScale.ts` | `dayIndexFromKey`, `dateKeyFromDayIndex`, `createGanttScale`, `clampDateRange`, `DEFAULT_GANTT_PX_PER_DAY` (48 — wide-screen preset default); 17 runtime self-check assertions |

### Compat aliases
Every original `Calendar*` name is re-exported from `scheduling/index.ts` as an exact alias so `calendar/index.ts` can re-export them unchanged — zero app-side import paths changed when the scheduling module was extracted.

### Key rules
1. `calendar/` and `gantt/` MUST import all date/event/scale math from `../scheduling` — never duplicate.
2. Add new view-agnostic helpers to `scheduling/`; keep view-specific rendering constants (`GANTT_BAR_HEIGHT`, `GANTT_TITLE_COLUMN_WIDTH`, etc.) in the view module.
3. The `DEFAULT_GANTT_PX_PER_DAY = 48` in `scheduling/ganttScale.ts` is the server-preset default (wide screens). The component-level default `GANTT_CHART_DEFAULT_PX_PER_DAY = 28` lives in `gantt/types.ts` (phone-friendly density when no preset exists).

---

## Gantt View Injection Contract (2026-06-12)

`@payload-universal/admin-native/src/gantt/` (types / GanttBar / GanttChart / TimeAxis / index barrel). Pure-React injection pattern: no expo-router, no data fetching, no native-module imports. The screen injects already-filtered docs, configured sources, and callbacks.

**Screen → component contract (`GanttChartProps`):**
- `docs: ScheduleDoc[]` — already-filtered, already-sorted local-first docs (same `boardDocs` pipeline as kanban/calendar). Order = row order (the screen applies `ganttOptions.rowSort` override before passing).
- `sources: ScheduleSource[]` — `{ id, label, startField, endField?, color, hidden? }`. `startField`/`endField` are **dot-paths**. Sources without `endField` produce 16pt point diamonds (shiftable, not resizable). The bar's `point` flag is true when `!source.endField` — edge responders guard on it.
- `useAsTitle?` — row/bar title via `getDocumentTitle` fallback chain.
- `onPressBar(doc)` — tap on a bar body or frozen-column title → navigate to doc.
- `onPreviewDoc?(doc)` — armed hold released with <8pt of travel → present preview sheet. MUST be a JS BottomSheet — **do NOT use ScrollablePreview.Trigger on bars** (a raw UIKit recognizer would claim the press before the JS long-press that powers drag-or-peek fires).
- `onUpdateDates(doc, source, { start, end })` — fires once per completed drag (day-snapped ISO datetimes preserving wall-clock time). Bars derive purely from `docs`, so spring-back on failure is the screen's job (re-render from docs after a failed patch).
- `readOnlyDocIds?` — docs with a patch in flight; their bars render dimmed and lose editing.
- `pxPerDay?` — day column width in px (default `GANTT_CHART_DEFAULT_PX_PER_DAY = 28`). The S/M/L zoom picker maps 16/28/44.

**Infinite-window technique:**
The time window `[startKey, endKey]` is a state-managed range. Initial value = `initialGanttWindow(rows, todayKey)` (clamped ±366d auto). When scroll nears an edge (< `GANTT_EXTEND_THRESHOLD_DAYS = 7` columns), the window extends by `GANTT_EXTEND_DAYS = 60` days. Jump-free left-extension: adding days on the left shifts all computed x-coordinates, so `onContentSizeChange` bumps `contentOffset.x` by the same pixel delta (`newWidth - prevWidth`) before the user sees the next frame. The FlatList provides `getItemLayout` from pure row heights for native windowing on the vertical axis.

**Gesture tiers (non-negotiable — bars live inside nested scrollables):**
1. HANDLE RESIZE (left/right 20pt zones): dedicated PanResponder per zone, no long-press required, claims clearly horizontal `|dx| > 1.4|dy|` moves, refuses termination.
2. BODY SHIFT: Pressable `onLongPress` (200ms) arms the drag (`armedRef`); bar-root PanResponder claims the FIRST move in capture phase (`onMoveShouldSetPanResponderCapture: () => armedRef.current`). `handedOffRef` prevents the racing Pressable `onPressOut` from triggering the static-hold peek path after the drag has started.
3. STATIC HOLD → PEEK: armed hold released with `maxTravelRef < GANTT_STATIC_PRESS_MAX_DIST (8pt)` → `onPreviewDoc` via idempotent `finishDrag`.
4. `finishDrag` is IDEMPOTENT: `activeRef` early-return guards all three release paths (responder release, responder terminate, Pressable onPressOut).
5. During any drag, BOTH the horizontal ScrollView and the FlatList are locked (no `scrollEnabled` toggle — the chart calls `onDragStateChange(true/false)` and the containing screen holds scroll refs to call `.setNativeProps({ scrollEnabled: false })` on both).

**Stable refs rule:** Per-bar callback props (`onPressBar`, `onPreviewDoc`, `onUpdateDates`) are captured into `propsRef.current` (a plain ref updated every render) so PanResponder/Pressable callbacks read current values without being recreated — PanResponder `useMemo` deps stay stable and no mid-drag re-renders wipe the responders.

**`onUpdateDates` dot-path patch pattern:**
```ts
// Nested paths rebuild the whole root key (RxDB incrementalPatch
// merges top-level keys only — not deep). Start + end under the same
// root group must compose into a single partial object so neither
// overwrites the other.
const buildPatch = (doc, source, next) => {
  const patch: Record<string, unknown> = {}
  setByPath(patch, source.startField, next.start, doc) // seeds from doc
  if (source.endField) setByPath(patch, source.endField, next.end, patch) // seeds from patch-so-far
  return patch
}
```

**Server-side shape:**
```
ViewPresets.ganttSources  — json, ScheduleSource[] shape, condition: viewType === 'gantt'
ViewPresets.ganttOptions  — json, { pxPerDay?: number, rowSort?: string }, condition: viewType === 'gantt'
```
`presetToGanttConfig(preset)` → `{ sources, pxPerDay, rowSort }`. `liftSnapshot` omits null fields; if both are null the field is set to null json.
