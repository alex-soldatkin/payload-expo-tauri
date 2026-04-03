# Component translation guide

You will translate Payload field components to React Native while keeping the same props and state contracts from admin-core.

Field mapping targets
- text, email, slug, password, confirm-password: React Native TextInput.
- textarea: TextInput with multiline and a larger height.
- number: TextInput with numeric keyboard and min or max handling in validation.
- checkbox: Switch or a custom checkbox component.
- select, radio: Picker or a modal list with single select and multi select.
- relationship, upload: modal list with search and pagination. Use file picker for uploads.
- date: native date and time picker.
- richText: native `EnrichedTextInput` from `react-native-enriched` (Fabric/New Architecture). Bidirectional Lexical JSON ↔ HTML converters (`lexicalToHtml.ts`, `htmlToLexical.ts`). Apple Notes-style glass toolbar with live style detection. Document mentions (`@`) queryable from all user-facing collections via local RxDB. Falls back to plain-text TextInput when library not installed.
- code, json: multiline editor with monospaced font. Add syntax help later.
- array, blocks: list with add, delete, and reorder controls. Use cards for each row or block.
- group, row, collapsible: layout wrappers that control spacing and visibility.
- tabs: top tabs or segmented controls.
- join: scrollable table showing related docs from the joined collection, with configurable columns (`admin.defaultColumns`), tappable rows (Link.Preview peek/pop), sort-by-column, pagination, local-first query via RxDB.
- UI field and custom admin components: use the component registry.

Component registry
- Keep a registry keyed by component path or id.
- Support platform specific entries such as "web" and "native".
- If a native component is missing, render a fallback component that explains the gap and keeps the form usable.
