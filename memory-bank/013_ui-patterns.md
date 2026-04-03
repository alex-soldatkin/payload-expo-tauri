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
<NativeHost>
  <NativePicker selection={value} onSelectionChange={onChange}>
    <NativeText modifiers={[{ tag: '' }]}>Select...</NativeText>
    {options.map(opt => <NativeText key={opt.value} modifiers={[{ tag: opt.value }]}>{opt.label}</NativeText>)}
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

## Turbopack / Monorepo

### Root node_modules symlink
`payload_expo_tauri/node_modules → test_app/node_modules` **MUST exist**. Turbopack with `root: monoRoot` resolves transitive deps (`@floating-ui/react`, `clsx`) through this symlink. Deleting it crashes `/admin`.

### Cache clearing
If Turbopack fails after config changes, delete `test_app/apps/server/.next` and restart.
