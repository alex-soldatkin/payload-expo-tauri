/**
 * Structural (layout) fields: group, collapsible, row, tabs, array, blocks.
 * These contain sub-fields and use FieldRendererContext to render them.
 *
 * Implementation lives in `./structural/` — this barrel is the ONLY module
 * external code may import from (DocumentForm, fields/index.ts). Do not
 * import `./structural/*` subfiles directly elsewhere.
 *
 * Native tiers (registry-gated, three-tier fallback per shared/native):
 *   - Tabs / Array switcher → SwiftUI segmented Picker (iOS),
 *     JC segmented Picker (Android), JS pill bar (fallback)
 *   - Collapsible → SwiftUI Section / DisclosureGroup (iOS), JS fallback
 *   - Array / Blocks row actions → SwiftUI ContextMenu (iOS),
 *     JC ContextMenu (Android), BottomSheet (fallback)
 *   - Blocks add → searchable picker in the package BottomSheet
 */
export {
  ErrorMapContext,
  FieldRendererContext,
  FIELD_WIDTH_BREAKPOINT,
  RowLabelContext,
  useCompactFields,
  useRowLabelContext,
} from './structural/common'
export type { RowLabelContextValue } from './structural/common'
export { GroupField } from './structural/group'
export { CollapsibleField } from './structural/collapsible'
export { RowField } from './structural/row'
export { TabsField } from './structural/tabs'
export { ArrayField } from './structural/array'
export { BlocksField } from './structural/blocks'
