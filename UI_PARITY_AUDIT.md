# Payload UI → Native Mobile Admin Parity Audit

**Last updated:** 2026-06-12 (Phase 27b — Apple-style month bars + week mode: month grid upgrades to titled event-bar lanes on regular-width displays (iPad/landscape); mode model extended to month/week/day where week+day share the CalendarKit timeline; `sanitizeCalendarMode` + CalendarCustomizeSheet + ViewPresets server select all accept 'week'. Phase 27 — native calendar views: third list-view mode; local `calendar-view` Expo module with HorizonCalendar month grid + CalendarKit day timeline — **new pods, REQUIRES A NEW EAS BUILD**; `admin-native/src/calendar/` injection package with JS fallbacks; ViewPresets extended with calendarSources/calendarDefaultMode. Previous: Phase 26 kanban boards + shareable view/query presets; Phase 25/25b on-device hotfixes + post-fleet UX round)

This document is the current-truth status of the React Native admin (`@payload-universal/admin-native` + `test_app/apps/mobile-expo`) versus the Payload web admin. Field components are listed per platform tier; list/edit features are compared against the web admin feature-by-feature.

---

## @expo/ui version truth (read this first)

Two versions of `@expo/ui` exist in the workspace:

| Location | Version | Role |
|---|---|---|
| `test_app/apps/mobile-expo/node_modules/@expo/ui` | `55.0.0-canary-20260128-67ce8d5` | **The version compiled into the native binary. The only truth.** |
| `test_app/node_modules/@expo/ui` (root pnpm hoist) | `55.0.6` | Wrong version — transitive resolution. Metro pins all `@expo/ui/*` imports to the app copy via custom `resolveRequest`. |

**The canary does NOT have:** `ControlGroup`, `ConfirmationDialog`, `ScrollView` (in swift-ui). Docs/types found online or in 55.0.6 will lie about this — always verify a component exists in `test_app/apps/mobile-expo/node_modules/@expo/ui/build/` before using it.

**Verified canary surface** (documented in `payload_universal/packages/admin-native/src/fields/shared/types.ts`): 43 iOS SwiftUI components + 38 modifier factories registered. Android Jetpack Compose components with APIs that diverge from SwiftUI get distinct `JC*` registry keys:
- `JCPicker` — `{options, selectedIndex, onOptionSelected, variant: 'segmented' | 'radio'}` (options-based, not children-based)
- `JCBottomSheet` — `{isOpened, onIsOpenedChange}`
- `JCSwitch` — `{value, onValueChange}`
- `JCTextInput` — uncontrolled, **no placeholder support**
- `JCDateTimePicker`, `JCButton` (children-not-label), `JCChip`, `JCAlertDialog`, …

`fields/shared/types.ts` is the authoritative registry shape — read it before assuming any component or prop exists.

---

## Field-by-field native status

Tier legend: **iOS** = SwiftUI primitive via registry; **Android** = Jetpack Compose primitive via registry (`JC*` keys for divergent APIs); **JS** = React Native fallback (always present, used in Expo Go / when registry entry is null).

| Field type | iOS primitive | Android primitive | JS fallback | Notes |
|---|---|---|---|---|
| `text` | `TextField` (uncontrolled) | `JCTextInput` (uncontrolled, no placeholder) | RN TextInput | Via `NativeTextRow` + `useNativeTextBridge` (`defaultValue`+`onChangeText`, `ref.setText` only on external resets); `admin.autoComplete` |
| `email` | `TextField` (email keyboard) | `JCTextInput` | RN TextInput | Same bridge as text |
| password (auth) | `SecureField` | `JCTextInput` (secure) | RN TextInput | |
| `number` | `TextField` + `Stepper`/`HStack` when fully bounded integer | `JCTextInput` (numeric) | RN TextInput | Stepper is uncontrolled — remounted via epoch key on external value change; `admin.step` |
| `textarea` | — (JS) | — (JS) | Autogrow multiline TextInput | `admin.rows`; carve-out in native Form; Phase 25: auto-grow measures in content space (padding on wrapper View), clamped + ≤2px-delta guarded — runaway grow loop fixed |
| `code` | — (JS) | — (JS) | Monospace TextInput + line-number gutter | |
| `json` | — (JS) | — (JS) | Monospace TextInput + live validity indicator | |
| `point` | — (JS) | — (JS) | Lat/lng inputs + bounds validation | |
| `checkbox` | `Toggle` | `JCSwitch` | RN Switch (scheme-aware) | |
| `date` | `DatePicker` (all `pickerAppearance` variants) | `JCDateTimePicker` | Wheel-picker modal sheet | Events collection exercises timezone + all appearances |
| `select` | `Picker` (menu), `isClearable` | `JCPicker` (options-based) | `SimpleOptionList` chips | `hasMany`: chips + reorder on all platforms |
| `radio` | `Picker` (segmented) | `JCPicker` `variant:'radio'` | Chips | |
| `relationship` | JS sheet UI (+ SwiftUI accents) | JS sheet UI | Searchable BottomSheet | `hasMany`, polymorphic collection switcher, `filterOptions` → REST where + local mango, server search + load-more, inline create via injected `onRequestCreate` (`RelationshipInlineCreateProvider`); `hasMany` selected rows long-press peek a read-only `DocumentForm` of the related doc (via `useScrollablePreview()` context only — fallback-safe, suppressed inside sheets via `useIsInsidePreview`) |
| `upload` | JS (+ expo-document-picker) | JS | Same | Thumbnails, browse-existing grid, `hasMany` strip, focal point editor |
| `array` | `Section` rows in native Form; SwiftUI `ContextMenu` row actions (move/dup/insert/remove) | JC ContextMenu equivalents | GlassView rows + JS menus | Collapse-all; `RowLabel` custom components resolved via `RowLabelContext` |
| `blocks` | Searchable block-picker sheet; stacked default ≤5 rows | Same (JS sheet) | Same | `blockName` editing; per-block `admin.group` |
| `group` | `Section` (named) | JS card | JS card | Unnamed groups transparent |
| `collapsible` | `Section isExpanded` / `DisclosureGroup` | JS accordion | LayoutAnimation accordion | |
| `row` | Flex row (JS layout) | Same | Same | Stacked inside native Form and under 500px |
| `tabs` | `Picker` segmented | `JCPicker` `variant:'segmented'` (Android crash fixed) | Pill tab bar | Named tabs supported (Pages collection) |
| `richText` | `EnrichedTextInput` (Fabric native) + GlassEffectContainer toolbar | EnrichedTextInput + JS pill toolbar | Plain-text TextInput | Lexical JSON ↔ HTML round-trip; tables via native `TableEditor`. Phase 25b: ALL editor HTML must pass through `wrapEditorHtml()` — both native impls parse HTML only inside an exact `<html>…</html>` envelope; bare fragments insert as plain text (raw HTML source visible) and the next save corrupts the doc. `normalizeRichTextValue` recovers previously-corrupted '<'-prefixed values |
| `join` | — (JS) | — (JS) | FlatList table | Read-only related-docs table, sort/paginate |
| `ui` | Custom components (codegen) | Same | `UIField` placeholder | **Fixed in Phase 23** — `FieldRenderer` renders registered custom components (e.g. `products_priceSummary_Field`); web-only components get a `WebViewFieldBridge` wrapper |

**Form chrome:** `DocumentForm` has a `nativeForm` prop that renders a single full-screen SwiftUI `Form`. **OPT-IN, disabled by default since 2026-06-11 (Phase 25):** the previous `nativeForm ?? true` default crashed natively on-device for every collection whose whole field tree is Form-compatible (Events, SiteSettings/Footer — no richText/join carve-out to save them), and `FormCrashBoundary` cannot catch native crashes (it only sees JS render errors). The gate is now strict `nativeForm === true`; no screen opts in, so all collections render the JS FormSection path. Re-enabling requires native-side debugging (prime suspect: raw RN views as direct children of SwiftUI Form/Section cells). The old rule still applies if anyone opts in: a Form in an unsized container (formSheet, details sheet, BottomSheet) is zero-height and swallows all touches.

---

## List view parity vs web admin

| Feature | Web admin | Native status |
|---|---|---|
| Document list | Table | Cards (phone) / table rows (tablet) ✅ |
| Sort | Column headers | ✅ Props-driven + persisted (`list_sort:{slug}`); native toolbar sort menu on iOS (`getSortableFields`), Android internal sort UI shares the same persisted key |
| Pagination / per-page | ✅ | ✅ Per-page selector + `admin.pagination.defaultLimit`; "1–Y of Z" meta |
| Empty states | ✅ | ✅ `ContentUnavailableView`, 3 variants (no docs / no results / error) |
| Filters (where builder) | WhereBuilder | ✅ `FilterBottomSheet`: native DatePicker, relationship value picker, editable chips, **full OR-group builder** (Phase 24): `ActiveFilter.groupIndex` — conditions AND within a group, groups OR across, serialized `{ or: [{ and: [...] }] }` (single group degrades to flat AND, backward compatible); OR-group overview step + AND/OR choice at value step; chips cluster by group with 'or' micro-label; operator matrix mirrors web `field-types.tsx` (in/not_in, like/not_like/contains, ranges, exists); persisted per collection as versioned `{ v: 2, groups }` under `list_filters:{slug}` with legacy flat-array reads (`hooks/useDocumentListFilters.ts`) |
| Search | ✅ | ✅ (list search bar) |
| Column selector | ✅ | ✅ Summary-fields picker (drag-to-reorder) |
| Bulk select + actions | ✅ | ✅ Multi-select mode + custom `listActions` (server metadata → native menu/action bar); selection mode now reachable for EVERY collection (iOS Actions toolbar menu always rendered; Android CheckSquare header button unconditional) |
| Bulk edit drawer (EditMany) | ✅ | ✅ `BulkEditSheet` (`src/components/BulkEditSheet.tsx`, Phase 24): BottomSheet two-step flow — field picker over bulk-editable root fields (web EditMany skip rules: richText/join/ui, structural containers, upload-hasMany, polymorphic rels, unique/hidden/readOnly, `admin.disableBulkEdit`) → normal `FieldRenderer` input + Save/Save Draft/Publish choice when drafts enabled; per-doc patch merged over full stripped original via `useValidatedMutations.update`, live progress, ok/failed toast |
| Group-by | ✅ | ❌ |
| Query presets | ✅ | ✅ **Native (Phase 26)**: server `enableQueryPresets` on Posts/Products/Events/Pages + root `queryPresets` config auto-registers `payload-query-presets` (web parity intact). Mobile lists/applies/saves them in FilterBottomSheet's overview step via **REST only** (`payloadApi`, `where[relatedCollection][equals]=slug` — the `payload-` slug prefix excludes the collection from RxDB sync by design); apply converts Payload where → the sheet's OR-group model (inline notes for operators the local evaluator lacks); 'Save filters as preset…' POSTs the canonical `{ title, relatedCollection, where, columns }` shape |
| View presets (saved views) | — (web has only query presets) | ✅ **Native-first extension (Phase 26)**: synced `view-presets` collection (works offline) captures view mode + kanban board config + structured filters; `useViewPresets(slug)` local-first CRUD + `PresetsSheet` (save-as, My/Shared sections, apply-on-tap, Rename/Update-from-current/Share/Delete row actions, access segmented onlyMe/specificUsers/everyone + user picker); owner-only mutations, owner pinned server-side; applying sets view mode + board config + both filter pipelines (table via epoch-bumped DocumentList prop) |
| Kanban board | ❌ (no web equivalent) | ✅ **Native-first extension beyond web parity (Phase 26)**: `admin-native/src/kanban/` — columns from any plain select (`hasMany:false`) or radio field, liquid-glass columns/cards, drag-drop via optional reanimated-dnd (finger-following overlay, edge auto-scroll) with a guaranteed "Move to <column>" menu fallback, trailing No-status column, hidden columns, per-column colors, card-fields customization (`KanbanCustomizeSheet`); native view-selector toolbar group (table/kanban, persisted `list_view_mode:{slug}`); same local-first docs + filters as the table; selection/swipe-delete/bulk-edit stay table-only |
| Calendar view | ❌ (no web equivalent) | ✅ **Native-first extension beyond web parity (Phase 27 + 27b)**: third view-mode for any collection with ≥1 date field (nested dot-paths count; entry hidden otherwise). Mode model: `'month' \| 'week' \| 'day'` (week and day share the CalendarKit timeline surface — day is week's child mode). Native tier = local `modules/calendar-view` Expo module (**iOS-only; pods `HorizonCalendar ~> 2.0.0` + `CalendarKit ~> 1.1.9` — REQUIRES A NEW EAS BUILD**): HorizonCalendar month grid — on regular-width (≥600 px, iPad/landscape): Apple-Calendar-style globally lane-packed titled event bars (multi-day bars span cells as continuous bars with continuation treatment across week wraps, single-day events as compact labeled chips, "+N more" overflow; `showEventBars` Bool? prop); on compact width: max-3 dots + range strips — CalendarKit day timeline (horizontal swipe pages days in week mode; all-day events in native all-day row; `allDay` inferred from date-only starts). JS tier = `admin-native/src/calendar/` MonthGridFallback/DayListFallback/WeekStrip when `isNativeCalendarAvailable` is false (Expo Go / Android / old dev clients); JS all-day glass-chip strip renders ONLY in the fallback tier (never both). Week mode: `WeekStrip` (locale-aware Mon-start via `Intl.Locale` weekInfo, 7-day pill row with presence dots, chevron/swipe week paging, two-way selectedDate sync) above the timeline. Multi-source date mapping (`pickDefaultSources` start/end + From/To pairing; dot-path `getByPath` resolution; date-only → allDay; kanban palette colors), `CalendarCustomizeSheet` (sources reorder/add/edit, Month/**Week**/Day default, ColorPicker), `calendar_config:{slug}`, same local-first docs + filters as table/kanban; rows peek via `ScrollablePreview.Trigger`; selection/swipe-delete stay table-only; view presets carry `calendarSources`/`calendarDefaultMode` ('month'\|'week'\|'day') |
| Trash (soft delete) | ✅ | ❌ |
| Folders (browse-by-folder) | ✅ | ❌ (`BrowseByFolderButton` is a null stub in the ui shim) |
| Live per-collection counts | — | ✅ Dashboard badges from reactive RxDB `count()` (mobile-only nicety) |
| Swipe-to-delete on rows | — | ✅ (Phase 25b) `SwipeToDeleteRow` — pure RN PanResponder tier (RNGH Swipeable crashed on iOS 26), iOS Mail behaviour, single-open-row registry, coexists with the peek trigger's native recognizers |

## Edit view parity vs web admin

| Feature | Web admin | Native status |
|---|---|---|
| Document form (all field types) | ✅ | ✅ See field table; JS FormSection everywhere (native SwiftUI Form is opt-in, disabled by default after the 2026-06-11 on-device crash) |
| Validation | Server + client | ✅ Client-side (zod + client-validators) + server errors inline |
| Drafts / publish / unpublish | ✅ | ✅ Status pills, publish/unpublish actions |
| Autosave | ✅ | ✅ Draft docs only, from `clientConfig.versions.drafts.autosave` (Pages: 1500ms), via interval polling + `_status:'draft'` PATCH; **deliberately disabled for published docs** (local-first model can't represent draft-of-published — would silently unpublish) |
| Versions list + restore | ✅ | ✅ `VersionsBottomSheet` (+ Autosave pill) + `VersionDiff` upgraded Phase 24: word-level inline diffs (dep-free LCS in `utils/diff.ts`) for text/textarea/email/code/json; richText diffed on extracted Lexical plain text with '(formatting-only change)' note; per-row array/blocks diffs (Added/Removed/Changed badges, id-based matching, blockType swap handling); relationship/upload labels resolved; per-locale sub-rows; 'Changed fields only' toggle; group/tab label prefixes |
| Conditions (`admin.condition`) | ✅ (functions run in browser) | ✅ `ConditionContext`: app registers slug→fieldPath→fn (`src/conditions/`), evaluated against live form data, fail-open. Server emits condition markers via admin-schema |
| Localization | Locale selector | ✅ Locale toolbar menu (en/es) from `schema.localization`; non-default locales load/save via REST `?locale=X` (online-only, RxDB bypassed), default locale stays local-first |
| API view | ✅ | ✅ `[slug]/api` formSheet route (JSON inspector, depth stepper) |
| UI fields / custom field components | ✅ | ✅ Codegen pipeline (11 components in sample app); web-only components bail out to `WebViewFieldBridge` wrapper (placeholder HTML — real bundling not implemented) |
| Custom actions (edit menu) | ✅ | ✅ `editActions` metadata → native SwiftUI Menu w/ SF Symbols + destructive roles (iOS), JC ContextMenu (Android) |
| Duplicate | Built-in | ✅ Generic (Phase 24): `[id].tsx` `handleDuplicate` clones doc, strips id/timestamps/`_status`/RxDB internals, appends ' (Copy)' to `useAsTitle` + '-copy' to slug, resets to draft when drafts enabled, inserts via `validatedCreate`; iOS toolbar Actions menu + Android `DocumentActionsMenu` extraActions, before custom `editActions` |
| Delete | Built-in | ✅ Generic destructive-confirm delete in the same iOS Actions menu / Android extraActions |
| Unsaved-changes guard | ✅ (leave-without-saving modal) | ✅ (Phase 25b) `useUnsavedChangesGuard` — `usePreventRemove` discard confirm driven by DocumentForm's `onDirtyChange`; intentional navigations bypass via `allowLeave()`. Save is a dirty-state checkmark toolbar button (enabled+blue when dirty) |
| Document locking / take-over | ✅ | ❌ (Users collection has `lockDocuments` server-side; no native UI) |
| Live preview | ✅ | ❌ |
| Inline relationship create | Drawer | ✅ `RelationshipInlineCreateProvider` (formSheet, `nativeForm={false}`) |

## Server sample app coverage (test_app/apps/server)

Collections: **Pages** (5 block types, named tabs, localized fields, autosave 1500ms), **Products** (code/json/point/hasMany/polymorphic relationship/filterOptions/ui field + action metadata; Phase 26: `lifecycleStage` select — concept/development/launched/mature/retired — as a kanban driver, `availability` stays the radio exercise), **Events** (timezone dates, all pickerAppearance variants, RowLabel array, condition-dependent fields, `eventType` select), Posts (Phase 26: `status` now draft/**review**/published/archived), Media (imageSizes/focal/crop), Users (useAPIKey/lock/role), **ViewPresets** (`view-presets`, Phase 26 — synced; owner/everyone/specificUsers read access, owner-only mutations, owner pinned in `beforeChange`; Phase 27: `'calendar'` viewType + `calendarSources` json + `calendarDefaultMode` select). Globals: **SiteSettings**, **Footer** (RowLabel links). Localization: en+es. Root `queryPresets` config + `enableQueryPresets` on Posts/Products/Events/Pages (hidden `payload-query-presets` collection — web presets UI works; mobile reaches it REST-only).

---

## Long-press peek module (Phase 24 rework — Telegram-style)

`modules/scrollable-preview` was rebuilt from Telegram-iOS's actual sources (ContextGesture / PeekController / PeekControllerNode). No `UIContextMenuInteraction` anywhere.

**iOS architecture:**
- Trigger keeps `UILongPressGestureRecognizer`; presents a dedicated **`UIWindow` at `.alert` level** mirroring the host window's frame — source-rect coordinates map 1:1, and an RN Modal tearing down can never reparent/kill the overlay. A `willMove(toWindow:nil)` hook tears the peek down synchronously if the enclosing Modal/BottomSheet closes mid-peek.
- RN Content is reparented into a rounded (16pt continuous) shadowed container over `UIVisualEffectView` blur + dim. Spring morph from/to the trigger's on-screen rect via `UIViewPropertyAnimator` (0.42s, damping 0.8); `UIImpactFeedbackGenerator(.medium)` on open.
- After finger-lift the peek stays open in interactive mode; inner RN ScrollViews/FlatLists scroll natively. The decisive scrolling fix is JS-side: Trigger resolves the preview size (default 92% w × 65% h, overridable via `previewWidth`/`previewHeight`/`previewHeightFraction`) through an internal context; Content styles itself `position:absolute` at exactly that size so Yoga layout matches the native frame.
- Actions are native glass capsule rows (systemMaterial, SF Symbol + title, destructive = systemRed); pan-while-held highlights rows (12pt threshold, selection haptic), lift performs. Dismissal: backdrop tap, scroll-aware swipe-down with translation-follow (engages only when the touched scroll view is at top; 140pt / 900pt-s thresholds), tap-on-preview fires `onPrimaryAction`.

**Android parity:** same Trigger/Content/Action ExpoViews; long-press (GestureDetector from `dispatchTouchEvent`, LONG_PRESS haptic) opens a full-screen Dialog with `FLAG_DIM_BEHIND` (0.55), rounded clipped card preserving RN-computed layout, action pill rows, tap-outside/back/fling-down dismissal, content restored to original parent on dismiss/detach.

**JS API:** fully backward compatible (Trigger/Content/Action, `onPrimaryAction`/`onPreviewOpen`/`onPreviewClose`/`onActionPress`, `title`/`icon`/`destructive`); `previewHeightFraction` is the only addition.

**Sheet-safety rules:** consumers use the `useScrollablePreview()` context ONLY (fallback-safe when the module is absent); `useIsInsidePreview` (set by BottomSheet) suppresses nested peeks inside sheets/previews; the relationship PICKER rows keep the pure-JS inline preview (module exposes no Modal-safety capability flag, and the old-binary EAS snapshot predates the rework). hasMany relationship *selected* rows peek a read-only `DocumentForm` (`nativeForm={false}` + `PreviewContextProvider`), lazy local-RxDB-first with REST fallback; row up/down/X Pressables stay OUTSIDE the trigger to avoid recognizer fights.

---

## Needs on-device verification (aggregated from Phases 23–27)

Phase 27b + 27 (calendar — code-verified, typechecked, bundle-exported; the native Swift side has NEVER compiled: pods install on the next EAS build):
- **HorizonCalendar + CalendarKit compile**: first `pod install` of `ExpoCalendarView` (HorizonCalendar ~> 2.0.0, CalendarKit ~> 1.1.9) on the EAS build — Swift compile errors surface only there (Equatable diffing, CalendarKit header-hiding API, HorizonCalendar `dayItemProvider`/`calendarItemModel` API, `MonthEventBarView` custom draw, `Bool?` Expo prop DSL are the compile-uncertain spots; `calendarBlended(with:ratio:)` extension was missing before Phase 27b and is now present).
- **Month bars on iPad/regular width**: `showEventBars=true` path — globally lane-packed event bars render across day cells with correct bleed, titles at week-run starts, continuation chevrons at row wraps, "+N more" overflow; multi-day event spans multiple cells at the same lane row; single-day chips present.
- **Week strip sync**: `WeekStrip` day-pill selection follows native timeline swipe → `onChangeDate` → `selectedDate` prop round-trip; chevron/swipe week paging pages the strip; tapping a day pill moves the timeline to that day.
- **Week mode all-day row**: CalendarKit's native all-day row shows allDay events above the timeline; the JS `allDayStrip` is NOT rendered in the native tier (gated on `!nativeAvailable`).
- **Day mode as week child**: same CalendarKit timeline, single-date chevron header instead of week strip; mode switch month→week→day and back preserves `selectedDate`.
- Month grid rendering: paginated month swipe, day-cell dots (compact, max 3) + multi-day range strips, selected-day pill + today ring, `onSelectDate`/`onChangeVisibleMonth` round-trip.
- Day timeline: CalendarKit DayView with hidden header, horizontal swipe-to-change-day → `onChangeDate`, event tap → `onPressEvent`, point events as 30-min blocks, allDay events in native all-day header row.
- Dark mode on BOTH native calendars: dynamic-color/CGColor re-resolution on trait change (peek-module pattern), event bar wash + title-color legibility in dark.
- Fallback tiers: Expo Go + Android render MonthGridFallback/DayListFallback (`isNativeCalendarAvailable === false`); an OLD dev client (predating the module) must also fall back, not crash — try/catch `requireNativeModule` path.
- Integration: view menu Calendar entry only on date-bearing collections; `calendar_config:{slug}` + CalendarCustomizeSheet round-trip (source reorder, Week option in default-mode row, ColorPicker outside Sortables); calendar presets apply (sources + default mode including 'week' + filters); day-list row peek coexistence.

Phase 26 (kanban + presets — all code-verified, typechecked, bundle-exported; none device-tested yet):
- Kanban drag-drop on device: finger-following overlay tracking vs FlatList clipping, long-press `preDragDelay` vs card tap vs peek coexistence, edge-hover auto-scroll + drop-target re-measure after scroll, drop accuracy after horizontal scrolling.
- "Move to <column>" fallback menu in BOTH tiers (registry SwiftUI Menu without dnd; lucide+BottomSheet when dnd wraps the card).
- KanbanCustomizeSheet: Sortable reorder (column + card fields), registry ColorPicker rendering OUTSIDE the Sortable trees, status-field switch resetting config.
- View presets end-to-end: save/apply/rename/update-from-current/delete, sharing round-trip between two users (everyone + specificUsers), offline apply (synced collection), epoch-bumped filter application to the table.
- Query presets: REST list/apply/save against `payload-query-presets` with a regular user token; where→OR-group conversion fidelity on real presets created in the web admin.
- View-selector toolbar group ordering on a real device (group before Actions inside the single right toolbar; `isOn` checkmarks).

Phase 25b (post-fleet UX round — code-verified, pending device pass):
- Dirty-state checkmark Save (enabled/disabled transitions, both schemes) + unsaved-changes discard confirm; `allowLeave()` bypass on save/delete/duplicate navigations.
- SwipeToDeleteRow: gesture coexistence with the peek trigger's native recognizers and FlatList scrolling; single-open-row behaviour; array/blocks `canDelete`/minRows path.
- RowActionsMenu three tiers on array/blocks rows.
- Rich-text envelope: existing docs corrupted by the pre-fix path (raw HTML as plain text) render recovered; new saves round-trip cleanly.
- Peek overlay window mirrors dark mode (incl. live theme switch while a peek is open).
- `UIUserInterfaceStyle: Automatic` — **requires a NEW native binary**; the in-flight EAS build predates it.

Phase 25 hotfixes — **fixed in code, pending on-device retest** (all were user-reported on-device bugs, iPad dev client, dark mode):
- ~~Native crash opening Events / SiteSettings / Footer~~ **FIXED-pending-retest**: native SwiftUI Form is now opt-in (`nativeForm === true`); no screen opts in → JS FormSection path everywhere. Retest: open an Events doc and both globals.
- ~~"Maximum update depth exceeded" on the details sheet~~ **FIXED-pending-retest**: stable `EMPTY_DOC` constants + details.tsx loading gate + `useStableInitialData` deep-equal latch in DocumentForm. Retest: open the Posts details sheet; sidebar fields must show real values (previously empty — RHF mount-captured defaults).
- ~~Textarea auto-grow runaway / collapsible flailing~~ **FIXED-pending-retest**: content-space measurement (padding on wrapper), clamp-before-store, ≤2px guard. Retest: long text in a textarea inside a collapsible; check caret baseline (textContainerInset 0 vs 8).
- ~~No/invisible save buttons (create + edit)~~ **FIXED-pending-retest**: create.tsx headerRight Save Draft/Publish/Create via form ref; [id].tsx labeled 'Save' (`variant="done"`) + explicit `useListColors` tints; headerRight fallback whenever Stack.Toolbar API is unavailable; Users create via REST with password inputs. Retest in BOTH color schemes; if the iOS toolbar is still empty the installed dev client predates RNS 4.20 bar-button items — force `useNativeHeaderToolbar` false.
- ~~Dark mode: white cards/headers over dark palettes~~ **FIXED-pending-retest**: `ThemeVarsProvider` NativeWind `vars()` from `useListColors` (css-interop's media-query observable sticks on 'light' at launch); preferences drive nativewind `colorScheme.set`. Retest: Schema Summary card, login inputs, headers, System/Light/Dark override switch.

Phase 24 (all require a NEW native build — the in-flight EAS build snapshot predates the peek module rework):
- Telegram-style peek end-to-end on device: long-press open, interactive-mode scrolling inside the peek, scroll-aware swipe-down dismissal, action row pan-highlight, Modal/BottomSheet mid-peek teardown (`willMove(toWindow:nil)` path).
- Android peek Dialog parity (long-press haptic, fling-down dismissal, content restored to original parent).
- BulkEditSheet flow on device (field picker → input → save modes; progress + toast), OR-group filter sheet UX, upgraded VersionDiff rendering on real version histories.

UI / glass:
- Native glass RichTextToolbar on iOS 26: pill blending at `GlassEffectContainer spacing 10`, icon-only Buttons with `label=''` (possible off-center gap), intrinsic-width Host inside horizontal RN ScrollView (clipping risk).
- Dark mode end-to-end — **superseded by Phase 25**: the media-query CSS-variable path is dead on native (css-interop's `systemColorScheme` observable sticks at launch); tokens now come from `ThemeVarsProvider` `vars()` and the preference switch goes through nativewind `colorScheme.set`. Remaining check: `dark:` variants in files NOT swept in Phase 25 (generated components, other screens) still ride the stuck-prone observable.
- Collections tab SwiftUI Menu now follows system appearance (removed `colorScheme="light"` — original prop may have been a workaround).
- SF Symbol availability: `curlybraces` (API action), `rectangle.3.group` (layout-template), `dock.rectangle` (panel-bottom) — missing symbols render blank, no crash.

Forms / behavior:
- ~~`nativeForm` SwiftUI Form path + `FormCrashBoundary` across all sample collections~~ — **RESOLVED NEGATIVELY (Phase 25)**: it crashed natively on-device for fully-Form-compatible collections; the path is now opt-in and disabled by default. `FormCrashBoundary` cannot catch native crashes.
- `Stack.Toolbar.MenuAction isOn` checkmarks (verified in typings only; older expo-router ignores silently).
- api.tsx Stepper is natively uncontrolled — programmatic resets would not be reflected (nothing resets it today).
- Autosave polling (`getFormData` + JSON diff each interval) on very large block-heavy documents.
- Non-default locale editing is online-only: no offline support, server errors via form banner, delete still hits the whole local doc.

Known debt (will bite later):
- `packages/ui/src/index.native.tsx` imports expo-router (convention violation, pre-existing) and hardcodes light colors.
- `WebViewFieldBridge` renders placeholder HTML, not the actual web component (e.g. ReadTimeChart).
- ~~Generated action components hardcode `#1f1f1f` labels; regen overwrites hand-fixes~~ **FIXED in Phase 24**: `transform.ts` now strips `type=` on button→Pressable conversions, wraps raw text children of converted containers in `<Text>`, MOVES text-only style props onto the Text wrapper, converts near-black/near-white literal text colors to `Platform.OS === 'ios' ? PlatformColor('label'|'systemBackground') : '<literal>'`, renames `background`→`backgroundColor` / `textDecoration`→`textDecorationLine`, bakes unitless line-height multipliers into absolute RN values, and adds native-shim compat casts. All 11 components regenerated; the previously hand-fixed files regenerate at parity-or-better and the generated dir contributes zero TS errors.
- Duplicate `@payload-universal/ui` packages: `packages/ui` is what actually resolves (pnpm symlink beats metro `extraNodeModules`); `packages/payload-universal-ui` is richer but dead. Consolidation pending.

---

## Typecheck baselines (2026-06-12, post-Phase-27b) — ZERO everywhere

Run with `cd <dir> && /Users/…/test_app/node_modules/typescript/bin/tsc --noEmit` (NOT `npx tsc` — workspace name conflict). All six targets re-verified fresh after Phase 27b (Apple-style month bars + week mode); `npx expo export --platform ios --dev` bundles clean (26MB — the `calendar-view` module import is Expo Go/web-safe). (`payload-universal-ui` has 2 pre-existing unrelated errors; it is not one of the six tracked targets.)

| Target | Errors | Was (Phase 23) |
|---|---|---|
| admin-native | **0** | 27 |
| mobile-expo app | **0** | 46 |
| server | **0** | 66 |
| admin-schema | **0** | 16 |
| local-db | **0** | 27 |
| client-validators | **0** | (no tsconfig before — one was created) |

Zero is the baseline now — any new error is a regression. No `@ts-expect-error` suppressions were used for the elimination (real fixes; a handful of justified `as` casts with comments). Notable mechanisms that must NOT be reverted:
- server `tsconfig.json` `paths` pins `payload` + subpaths to the payload-main copy (kills the dual-payload-instance TS2322 class).
- mobile-expo `tsconfig.json` `paths` dedupes `react-native` to the app copy (nativewind `className` augmentation) and maps `@payload-universal/local-db` to a generated declaration snapshot at `types/local-db` (type-only; Metro bundles the real source — remove once local-db's rxdb typings are fixed upstream).
- rxdb v16 API corrections in local-db were runtime fixes, not just typing (`db.destroy()`→`db.close()`, guarded `pushNow?.()`, request-time token resolution in UploadQueueManager).
