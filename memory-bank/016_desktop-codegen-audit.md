# 016 — Desktop codegen audit: config-driven vs app code (2026-07-15)

Question audited: are the desktop app's collection interactions produced by the
schema/codegen pipeline, or by ad-hoc edits to the sample app?

## Result: clean

`grep` sweep of `apps/desktop-electron/src/renderer` (excluding `form/custom/gen/`):

- **Zero hardcoded collection slugs** (`posts`, `events`, `products`, `pages`,
  `footer`, …) outside generated files.
- **Zero hardcoded SSOT field names** (`startsAt`, `metaTitle`, `eventType`, …)
  in views/lib/workspace.
- The only literal domain values are Payload-CORE semantics, valid for any
  config: `_status: 'draft' | 'published'` (the drafts system) and the
  StatusBadge's semantic hue aliases (`published→green`, `draft→amber`, …),
  which are a design-language default, not config knowledge.

## The three layers (the contract)

1. **Runtime schema-driven** — fetched from the server's admin-schema endpoint
   at login; nothing baked in. Drives: sidebar/menu grouping, list columns
   (incl. config `defaultColumns`), filters, view eligibility (board = select/
   radio options; calendar = date field; gantt = ≥2 date fields), the whole
   form engine (all field types, tabs/groups/rows/collapsibles, blocks,
   validation metadata), versions/drafts UI, action METADATA (keys, labels,
   destructive flags for list/edit actions).
2. **Codegen artifacts** (regenerate after config changes; never hand-edit):
   - `pnpm codegen:conditions` → `form/conditions.gen.ts` — admin.condition
     function sources extracted by ts-morph (a runtime config walk cannot emit
     function bodies).
   - `pnpm codegen:dom` → `form/custom/gen/*.tsx` + `register.gen.ts` —
     VERBATIM copies of the config's field-level admin.components (Field /
     beforeInput / afterInput / RowLabel), running against the `@payloadcms/ui`
     ui-dom shim (vite + tsconfig alias). Registered via `asPayloadField` /
     `asPayloadRowLabel` adapters; registry lookups normalize row indexes.
3. **App-registered by contract** — the ONE intentionally-app-side piece:
   action HANDLERS (`lib/actions.ts`) keyed to match schema-declared action
   keys (`bulkArchive`, `duplicatePost`, …). The schema says an action exists;
   the app says what it does (server calls, multi-step modals via ActionSteps).
   Unregistered keys render disabled with an explanatory tooltip. Follow-up
   candidate: passthrough-extract handler sources at codegen like components.

## Interaction features are generic engine code

Everything shipped in the interaction batch (kanban drag/multi-drag, gantt
handles/multi-drag, calendar block chips + drag-reschedule, card fields from
the gear-icon column config, Cmd+N/Cmd+click/Esc, swipe nav, palette) lives in
the view ENGINE and reads only the schema — pointing the app at a different
Payload config (e.g. assemblon's 72 collections) exercises all of it with no
app edits beyond running the two codegen commands.

## Sync-core lesson (same session)

A locally-created doc failing server validation head-of-line-blocked its whole
collection's push queue forever (batchSize 1 + throw + silent error$). Fixed:
400-validation pushes warn + skip (doc stays local/unsynced until edited
valid); push-side "server newer" pre-check removed (contradicted the
local-wins-while-flagged conflict policy and could deadlock); replication
error$ now logged with inner errors unwrapped.

## 2026-07-16 — #29 resolved: lazy collections (92dd565)

RxDB free tier caps parallel RxCollections at 16 (COL23, checked in
collection.prepare(); collection.close() frees the slot and deletes the name
from the db registry, so evict→reopen is clean). local-db now opens the first
14 collections eagerly (sidebar order; small configs unchanged) and the rest
lazily via `ensureCollection(slug)` with LRU eviction (replication cancelled +
RxCollection closed on evict; SQLite data persists; sync resumes on reopen).
Hooks go through `useEnsuredCollection` — ensure on mount, subscribe to
`onCollectionsChanged`, re-ensure while mounted. The 'docs never land' half of
#29 was the same root cause: post-cap collections never existed locally.

Assemblon testing env: dump 2026-05-15 restored to `assemblon_copy` DB;
.env points there; dev user dev@assemblon.local / assemblon-dev-1234; server
`next dev -p 3200 --webpack` needs NODE_OPTIONS max-old-space-size=8192
(4096 OOM'd under desktop sync load). Verified: 14 eager + 53 lazy, five
lazy collections sync+render ≤3s each, eviction/reopen clean.

## 2026-07-16 — action passthrough (5e62c86)

Bulk (listMenuItems) + document (edit.editMenuItems) actions transpile via
`pnpm codegen:dom` (per config: `--config --out --allow lucide-react --allow
react-loading-skeleton`). gen/ is now GITIGNORED (contains per-config copies —
assemblon's are proprietary); regenerate before building. Rendering: selection
bar chips (SelectionScope → useSelection live counts), editor ⋯ menu (form
engine context), right-click menu (DocInfoScope). Every action renders in an
ActionBoundary — throwing components vanish with a console warning (that's how
form-scoped actions "defer" from list context to the editor menu). The '@'
vite alias maps onto the gen mirror, so specifier rewriting isn't load-bearing.
Known skips on assemblon: ketcher/d3/next-dynamic components (sequence editor,
monomer tools), jszip/exceljs importers, @payloadcms/ui subpath imports.

## 2026-07-16 — T3 design language (b810abd)

Tokens came from the INSTALLED T3 Code app (no public repo): extract
`/Applications/T3 Code (Nightly).app/Contents/Resources/app.asar` with
@electron/asar; the UI stylesheet is apps/server/dist/client/assets/index-*.css.
System: DM Sans Variable, radius .625rem, primary oklch(48.8/58.8% .217 264),
solid #fff / #161616 backgrounds, 4%-alpha fills, 6-8%-alpha hairlines,
emerald/amber/red semantics. Migration was ALIAS-BASED in base.css (T3
primitives + old tokens as aliases in all three palette blocks) — future
restyles should keep that layer; vibrancy/transparency removed in windows.mjs.
