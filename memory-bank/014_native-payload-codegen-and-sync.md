# Native Payload Codegen & Local DB Sync Stability

This document outlines the implementation details, architectural lessons, and bug unblocking strategies used over the course of establishing Expo compatibility with custom Payload components and stabilizing the RxDB local-first database syncing engine.

## 1. Native Codegen Pipeline for Web-Only Custom Components

Payload CMS admin panels often rely heavily on custom React components leveraging `@payloadcms/ui` (DOM-only, Next.js routed components). The immediate goal was to adapt the same `payload.config.ts` setup so that components map natively inside the Expo environment.

**Key Implementations:**
- **AST Parsing with `ts-morph`:** The raw Payload config was parsed using `ts-morph`. Since Payload's `createClientField()` strips `.components` for the server schema serialization, our extraction CLI parses the exact `tsx` source tree to capture deep `admin.components` definitions for elements like `SlugField` and `NativeNav`.
- **Import Aliasing (`transform.ts`):** 
  - Rewrites `@payloadcms/ui` imports to `@payload-universal/ui`
  - Replaces DOM specific elements (`div`, `input`, `button`) into standard native mappings `View`, `RNTextInput`, `Pressable`.
  - Removes `next/navigation` hooks (like `ClientComponent`) and replaces them with `expo-router` paradigms.
  - Rewrites overly deep relative imports (`../../../`) cleanly into `@/` path mappings, keeping generated files structured and resolved.
- **Universal Shims:** 
  - Created `packages/ui/src/shared.native.ts` bridging `groupNavItems` and `EntityType` exclusively for the Expo bundler.
  - Integrated `@payloadcms/translations` using `getTranslation` stubs natively.

**Files Touched:**
- `payload_universal/tools/native-component-codegen/src/transform.ts`
- `test_app/apps/mobile-expo/src/generated/custom-components/_registry.ts`
- `payload_universal/packages/ui/src/shared.native.ts`
- `payload_universal/packages/ui/src/index.native.tsx`
- `payload_universal/packages/ui/src/hooks.native.ts`

## 2. Resolving Bundler & Compiler Limitations
Due to the structure of `pnpm` monorepo hoisting and `tsc` strictness:
- **TypeScript Recursive Depth:** While indexing the custom component registry, `tsc` continuously threw `Maximum call stack size exceeded` errors. This was resolved by reducing depth matching recursively on generic component contexts (`cli.ts` registry maps) and strictly enforcing explicit `any` overrides strictly over recursive UI objects. 
- **Metro Workspace Isolation:** The `payload/shared` package exported dependencies relying on `payload-main/packages/translations`. Native Expo Metro defaults tightly to current workspace resolution boundaries. Adding `payload-main/packages` directly to `metro.config.js` `watchFolders` allowed it to transparently trace symlinked workspace assets.

## 3. RxDB Local Replication Infinite Sync Loop
The local-sync engine (`@payload-universal/local-db`) experienced persistent HTTP starvation when syncing the `posts` collection natively. 

**Root Cause:**
- Inside `replication.ts`'s `pull` handler, there was a loop triggering an `await localDoc.incrementalPatch(...)` to arbitrarily apply database logic.
- In RxDB natively, `incrementalPatch()` simulates user modification logic locally.
- Because it simulated a modification, RxDB invoked the `push` event, dispatching a remote HTTP `PATCH` payload to the REST Server.
- Payload Server generated a new Draft version bumping the remote `updatedAt` stamp.
- The `pull` interval saw the new timestamp, grabbed the same document again, and applied `incrementalPatch()` again—creating an endless, rapid infinite HTTP ping-pong conflict loop.

**The Fix:**
- Manually invoking `incrementalPatch()` during standard pulling handles was removed. RxDB `documents: filtered` ingestion handles patching identically, tracking backend timestamps strictly.
- Overrode Payload's API endpoint `sort` parameters to `updatedAt,id` to guarantee deterministic pagination during the database checkpoint tracking.

**Files Touched:**
- `payload_universal/packages/local-db/src/replication.ts`

## 4. DB6 Schema Corruption Hard-Reset
Whenever schema configs evolved structurally on the Payload side (e.g., removing redundant or unused indexes under the hood), RxDB crashed the mobile application with an abrupt DB6 error code. Since it expects migration configurations during typical usage for mismatching data, React Native essentially soft-bricked until caching was cleared manually.

**The Fix**
- Added a `schema conflict` try-catch layer to `createLocalDB()`. 
- When an initialized schema triggers an `DB6` error, `database.ts` executes a `await removeRxDatabase()` hard reset locally wiping `payload_local` entirely out of memory/storage and cleanly requests developers to press 'r' to initialize cleanly without retaining corrupted index tables.

**Files Touched:**
- `payload_universal/packages/local-db/src/database.ts`

## Lessons Learned
1. **Never mock remote modification with `patch` on RxDB Pull handles**. This acts as a manual local change hook bypassing all diffs—immediately firing RxReplication hooks directly into recursive network storms.
2. **Deterministic Pagination for Web Sockets Protocol.** Always sort endpoints predictably utilizing secondary ID sorting for payload REST syncing since timestamps often overlap drastically at scales.
3. **Automate Failure Resetting in Local-First Development.** A "nuke all local DB" sequence natively bounds the `local-db` development workflows away from painful cache-busting configurations on iOS/Android emulators anytime config shapes alter structurally.
4. **Metro limits are absolute**. Always monitor explicit Workspace root symlinking—`watchFolders` solves invisible packages locally.
