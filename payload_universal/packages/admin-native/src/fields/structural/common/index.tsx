/**
 * Shared infrastructure for structural (layout) fields.
 *
 * INTERNAL — only files inside `fields/structural/` and the `structural.tsx`
 * barrel may import this module. External consumers import from
 * `fields/structural` (the barrel re-exports the public surface).
 *
 * Contains:
 *  - FieldRendererContext / ErrorMapContext (object identity preserved from
 *    the pre-split structural.tsx — DocumentForm depends on these)
 *  - Width-aware sub-field rendering helpers
 *  - Dark-mode-aware palette (follows useColorScheme — never hardcoded light)
 *  - ErrorBadge (unified badge-style error count)
 *  - SegmentedIndexPicker (three-tier: SwiftUI Picker → JC Picker → JS pills)
 *  - RowActionsMenu (three-tier: SwiftUI Menu → JC ContextMenu → BottomSheet)
 *  - AddRowButton (three-tier, liquid-glass styled on iOS 26+)
 *
 * Split into sibling modules (glass / contexts / palette / utils / styles +
 * components/) per the no-god-files convention; this index re-exports the
 * full surface so `from './common'` resolves to `./common/index` unchanged.
 */
export { GlassView, liquidGlassAvailable } from './glass'

export {
  FieldRendererContext,
  useRenderField,
  TabDepthContext,
  useTabDepth,
  RowLabelContext,
  useRowLabelContext,
  ErrorMapContext,
  countErrorsForPrefix,
  useErrorCountForFields,
} from './contexts'
export type { RenderFieldFn, RowLabelContextValue } from './contexts'

export { usePalette } from './palette'
export type { StructuralPalette } from './palette'

export {
  resolveI18nText,
  getTabLabel,
  subPath,
  FIELD_WIDTH_BREAKPOINT,
  useCompactFields,
  renderSubFieldsWithWidth,
  withErrorSuffix,
  SEGMENTED_THRESHOLD,
} from './utils'

export { commonStyles } from './styles'

export { SubFieldRows } from './components/SubFieldRows'
export { ErrorBadge } from './components/ErrorBadge'
export { PillTabBar, SegmentedIndexPicker } from './components/SegmentedIndexPicker'
export { buildRowActions, RowActionsMenu } from './components/RowActionsMenu'
export type { RowAction } from './components/RowActionsMenu'
export { AddRowButton } from './components/AddRowButton'
