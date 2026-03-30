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

### Single-select
Use `@react-native-picker/picker` — native iOS wheel / Android dropdown:
```tsx
<Picker selectedValue={value} onValueChange={onChange}>
  <Picker.Item label="Select..." value="" />
  {options.map(opt => <Picker.Item key={opt.value} label={opt.label} value={opt.value} />)}
</Picker>
```

### Multi-select (`hasMany: true`)
Use toggle chips — all options inline as rounded buttons:
```tsx
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
  {options.map(opt => (
    <Pressable
      key={opt.value}
      style={[styles.chip, selected.includes(opt.value) && styles.chipSelected]}
      onPress={() => toggle(opt.value)}
    >
      <Text>{opt.label}</Text>
    </Pressable>
  ))}
</View>
```

### Relationship fields
Use searchable BottomSheet (NOT native picker) — relationships query across a collection with potentially many documents and need search + scroll.

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

## Swipe-to-Delete

### Use legacy `Swipeable`, NOT `ReanimatedSwipeable`
`ReanimatedSwipeable` uses Reanimated worklets that crash with a native SIGABRT when combined with expo-router's `Link` component in the same tree. Use the legacy `Swipeable` from `react-native-gesture-handler/Swipeable` instead.

```tsx
import Swipeable from 'react-native-gesture-handler/Swipeable'

<Swipeable
  friction={1.5}
  rightThreshold={40}
  renderRightActions={() => <DeleteButton />}
  onSwipeableOpen={(dir) => { if (dir === 'right') confirmDelete() }}
  overshootRight
>
  {cardContent}
</Swipeable>
```

### Full card height
Use `alignSelf: 'stretch'` on the action container + `flex: 1` on the button inside.

### Full swipe = confirmation dialog
`onSwipeableOpen` fires when user swipes all the way. Show `Alert.alert()` — never delete without confirmation.

### `GestureHandlerRootView` required
Must wrap the entire app tree (in root `_layout.tsx`) for any gesture handler components to work.

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
