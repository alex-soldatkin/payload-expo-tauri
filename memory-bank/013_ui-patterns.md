# UI Patterns and Solutions (2026-03-29)

## Link.Preview (iOS Peek/Pop)

### The Problem
`Link.Preview` from `expo-router` requires the Expo Router navigation context (`LinkPreviewContextProvider`). Components in shared workspace packages (`admin-native`) resolve `expo-router` from a different module instance than the app, causing "useLinkPreviewContext must be used within a LinkPreviewContextProvider" errors.

### The Solution
**Never render `Link` / `Link.Preview` from shared workspace packages.** Always render them from screen files inside the Expo Router tree.

**Pattern — `renderRow` callback:**
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

// In renderItem:
if (renderRow) {
  return renderRow({ item, rowContent, onPress: () => onPress(item) })
}
// Fallback: plain Pressable (no preview)
return <Pressable onPress={() => onPress(item)}>{rowContent}</Pressable>
```

```tsx
// SCREEN FILE (inside Expo Router tree — [slug]/index.tsx)
// Link is imported HERE where the router context is guaranteed.
import { Link } from 'expo-router'

const renderRow = useCallback(({ item, rowContent, onPress }) => (
  <Link href={`/(admin)/collections/${slug}/${item.id}`} push>
    <Link.Trigger>{rowContent}</Link.Trigger>
    <Link.Preview />
    <Link.Menu>
      <Link.MenuAction icon="doc.text" onPress={onPress}>Open</Link.MenuAction>
    </Link.Menu>
  </Link>
), [slug])

<DocumentList renderRow={renderRow} ... />
```

**For RelationshipField** (inside admin-native):
Use dynamic `require()` with null fallback so it never crashes:
```tsx
let Link: any = null
try { Link = require('expo-router').Link } catch {}

// Guard usage:
{selectedHref && displayValue && Link?.Trigger ? (
  <Link href={...}><Link.Trigger>...</Link.Trigger><Link.Preview /></Link>
) : (
  <Text>{displayValue}</Text>
)}
```

### Key Rules
1. `Link.Preview` does NOT require a manual `LinkPreviewContextProvider` — Expo Router provides it automatically for screens inside the navigation tree
2. Shared packages outside the Expo Router tree CANNOT use `Link` via static ES import
3. Use `renderRow` callback pattern to let screen files handle `Link.Preview` rendering
4. Use `require()` with try/catch for optional `Link` usage in shared packages

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
3. **`native.ios.ts` checks native module presence** before enabling (handles case where JS package is installed but dev client hasn't been rebuilt)
4. **`@react-native-picker/picker` uses dynamic require** (try/catch) since it's not available in Expo Go
5. **Three-tier fallback**: @expo/ui → RN native → pure JS (always works)

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
On iOS 26, both legacy `Swipeable` and `ReanimatedSwipeable` cause `PanGestureHandler` crashes. Delete is now handled via the native `Link.Menu` context menu alongside "Open":

```tsx
// In screen file (inside Expo Router tree)
const renderRow = useCallback(({ item, rowContent, onPress }) => (
  <Link href={href} push>
    <Link.Trigger>{rowContent}</Link.Trigger>
    <Link.Preview />
    <Link.Menu>
      <Link.MenuAction icon="doc.text" onPress={onPress}>Open</Link.MenuAction>
      <Link.MenuAction icon="trash" destructive onPress={() => confirmDelete(item)}>Delete</Link.MenuAction>
    </Link.Menu>
  </Link>
), [slug, handleDelete])
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

## Turbopack / Monorepo

### Root node_modules symlink
`payload_expo_tauri/node_modules → test_app/node_modules` **MUST exist**. Turbopack with `root: monoRoot` resolves transitive deps (`@floating-ui/react`, `clsx`) through this symlink. Deleting it crashes `/admin`.

### Cache clearing
If Turbopack fails after config changes, delete `test_app/apps/server/.next` and restart.
