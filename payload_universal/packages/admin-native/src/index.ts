/**
 * @payload-universal/admin-native
 *
 * React Native components for building a Payload CMS admin UI on mobile.
 * Driven by the same admin schema that powers the web and desktop admin.
 */

// Provider & hooks
export {
  PayloadNativeProvider,
  useAdminSchema,
  useAuth,
  useBaseURL,
  useMenuModel,
  usePayloadNative,
} from './PayloadNativeProvider'

// Icons
export { CollectionIcon } from './CollectionIcon'
export { getIconComponent, getSFSymbol, isRawSVG, registerIcon } from './utils/iconRegistry'
export type { IconComponent } from './utils/iconRegistry'

// Core components
export { BottomSheet } from './BottomSheet'
export type { SheetDetent } from './BottomSheet'
export { DocumentActionsMenu } from './DocumentActionsMenu'
export { FormSection } from './FormSection'
export { DocumentForm, FormDataContext, useFormData, canUseNativeFormForFields } from './DocumentForm'
export type { DocumentFormHandle, FormDataContextValue } from './DocumentForm'
export { DocumentList, getSortableFields, sortToQueryString } from './DocumentList'
export type { DocumentListSort } from './DocumentList'
export { FieldRenderer } from './FieldRenderer'
export { FilterBottomSheet } from './FilterBottomSheet'
export type { FilterApplyPayload } from './FilterBottomSheet'
export { FilterChips } from './FilterChips'
export { SwipeToDeleteRow, closeOpenSwipeRow } from './SwipeToDeleteRow'
export type { SwipeToDeleteRowProps } from './SwipeToDeleteRow'
export { SyncStatusCard } from './SyncStatusCard'
export { SyncStatusSection } from './SyncStatusSection'
export { VersionDiff } from './VersionDiff'
export { VersionsBottomSheet } from './VersionsBottomSheet'

// Kanban board — liquid-glass, injection-friendly (the screen supplies docs
// and move/press callbacks; drag & drop is a self-contained PanResponder
// overlay — long-press to drag, hold-and-release to preview, ellipsis
// "Move to" menu as the accessibility path)
export { KanbanBoard, KanbanCard, KanbanColumn } from './kanban'
export {
  buildKanbanColumns,
  DEFAULT_KANBAN_PALETTE,
  formatKanbanFieldValue,
  getKanbanColumnValue,
  KANBAN_CARD_WIDTH,
  KANBAN_COLUMN_GAP,
  KANBAN_COLUMN_WIDTH,
  NO_STATUS_COLUMN_COLOR,
  NO_STATUS_COLUMN_VALUE,
} from './kanban'
export type {
  KanbanBoardProps,
  KanbanCardProps,
  KanbanCardRow,
  KanbanColumnProps,
  KanbanColumnSpec,
  KanbanDoc,
  KanbanMoveTarget,
  KanbanStatusField,
  KanbanStatusOption,
} from './kanban'

// Calendar view — config-driven calendar over Payload docs (the screen
// supplies docs, date sources and callbacks; the app's native `calendar-view`
// module is injected via the nativeModule prop with pure-JS month-grid /
// day-list fallbacks when it is absent)
export { CalendarEventRow, CalendarView, DayListFallback, MonthGridFallback } from './calendar'
export {
  addDaysToKey,
  buildEventsByDateKey,
  calendarEventDocId,
  collectionHasCalendarDateFields,
  DEFAULT_CALENDAR_PALETTE,
  docsToCalendarEvents,
  eventOccursOnDate,
  formatEventTimeRange,
  formatLongDate,
  formatTimeOfDay,
  INTERNAL_DATE_FIELDS,
  isMultiDayEvent,
  MAX_EVENT_SPAN_DAYS,
  MAX_MONTH_CELL_DOTS,
  MAX_MONTH_CELL_STRIPS,
  normalizeDateKey,
  parseDateKey,
  pickDefaultSources,
  toDateKey,
  todayDateKey,
} from './calendar'
export type {
  CalendarDoc,
  CalendarEvent,
  CalendarEventRowProps,
  CalendarFieldLike,
  CalendarMode,
  CalendarNativeModule,
  CalendarSource,
  CalendarViewProps,
  DayListFallbackProps,
  MonthGridFallbackProps,
} from './calendar'

// Gantt chart — infinitely scrollable, user-editable gantt over Payload docs
// (the screen supplies docs, ScheduleSource entries — the server view-presets
// `ganttSources` shape — and press/preview/update callbacks; drag editing is
// a self-contained PanResponder tier: dedicated resize handles, hold-then-move
// body shift, static-hold preview)
export { GanttBar, GanttChart, TimeAxis } from './gantt'
export {
  buildGanttRows,
  computeNextRange,
  GANTT_CHART_DEFAULT_PX_PER_DAY,
  GANTT_MAX_PX_PER_DAY,
  GANTT_MIN_PX_PER_DAY,
  GANTT_REGULAR_WIDTH,
  GANTT_TITLE_COLUMN_WIDTH,
  initialGanttWindow,
  shiftIsoByDays,
} from './gantt'
export type {
  GanttBarProps,
  GanttBarSpec,
  GanttChartHandle,
  GanttChartProps,
  GanttDragMode,
  GanttRowModel,
  TimeAxisProps,
} from './gantt'

// Scheduling — the shared, view-agnostic source/event layer behind the
// calendar AND the gantt view (Schedule* canonical names + gantt date<->x
// scale helpers; the Calendar* aliases above re-export the same values, so
// only the NEW names are exported here to avoid duplicates)
export {
  clampDateRange,
  collectionHasScheduleDateFields,
  createGanttScale,
  dateKeyFromDayIndex,
  dayIndexFromKey,
  DEFAULT_GANTT_PX_PER_DAY,
  DEFAULT_SCHEDULE_PALETTE,
  docsToScheduleEvents,
  getFirstDayOfWeek,
  isoToDate,
  scheduleEventDocId,
  weekKeysForDate,
  weekStartKey,
} from './scheduling'
export type {
  DateKeyRange,
  GanttScale,
  ScheduleDoc,
  ScheduleEvent,
  ScheduleFieldLike,
  ScheduleSource,
} from './scheduling'

// Custom component overrides
export {
  CustomComponentProvider,
  useCustomAdminComponent,
  useCustomComponent,
  useCustomComponentRegistry,
  useCustomFieldSlots,
  useCustomView,
} from './contexts/CustomComponentContext'

// Action handler registry — collection-level custom action buttons
export {
  ActionRegistryProvider,
  useActionRegistry,
  useEditActionHandlers,
  useListActionHandlers,
} from './contexts/ActionContext'

// Client-side admin.condition registry — Metro-bundled condition functions
// matched by collection slug + field schema path. Fields with a hasCondition
// marker but no registered condition stay visible (fail open).
export {
  ConditionRegistryProvider,
  evaluateFieldVisibility,
  resolveFieldCondition,
  useCollectionConditions,
  useConditionRegistry,
} from './contexts/ConditionContext'
export type { ClientFieldCondition, ConditionRegistry } from './contexts/ConditionContext'

// WebView fallback bridge
export { WebViewFieldBridge } from './WebViewFieldBridge'
export type { WebViewFieldBridgeProps } from './WebViewFieldBridge'

// Preview context — wrap content in PreviewContextProvider to disable Link.Preview in nested fields
export { PreviewContextProvider, useIsInsidePreview } from './contexts/PreviewContext'

// Scrollable preview — host app injects its native module so shared fields can offer long-press previews
export { ScrollablePreviewProvider, useScrollablePreview } from './contexts/ScrollablePreviewContext'
export type { ScrollablePreviewModule } from './contexts/ScrollablePreviewContext'

// Toast notifications
export { ToastProvider, useToast } from './Toast'

// Search & filter hooks
export {
  applyWhereToDocs,
  filtersToWhere,
  matchesWhere,
  useDocumentListFilters,
  whereToFilterGroups,
} from './hooks/useDocumentListFilters'
export type { ActiveFilter, FilterCondition, FilterGroup, WhereClause } from './hooks/useDocumentListFilters'

// Dark-mode aware list palette (follows useColorScheme — never hardcoded light)
export { useListColors } from './hooks/useListColors'
export type { ListColorPalette } from './hooks/useListColors'

// Filter utilities
export { getOperatorsForFieldType, isFieldFilterable, getFilterableFieldTypes } from './utils/filterOperators'
export type { FilterOperator } from './utils/filterOperators'

// Field registry
export { fieldRegistry, getFieldComponent, FieldRendererContext } from './fields'

// Field chrome — label/description/error shell around custom field inputs.
// The @payload-universal/ui native shim imports this from the MAIN barrel
// (not ./fields), so it must be re-exported here.
export { FieldShell, fieldShellStyles } from './fields'

// Relationship field public props (onRequestCreate injection point)
export type { RelationshipFieldProps } from './fields/pickers'

// Array row label context — ArrayField provides it around custom RowLabel
// components; the @payload-universal/ui native shim's useRowLabel reads it.
export { RowLabelContext, useRowLabelContext } from './fields/structural'
export type { RowLabelContextValue } from './fields/structural'

// Segmented index picker (three-tier SwiftUI/JC/pill) — the calendar's
// Month/Week/Day toolbar; reused by the gantt screen header's S/M/L zoom so
// both scheduling views share the identical native segmented control.
export { SegmentedIndexPicker } from './fields/structural/common'

// hex → rgba(...) tint helper — kanban/gantt bar surfaces and the calendar
// legend chips compose source colours through it (the screen's gantt legend
// reuses it for visual parity with the calendar legend).
export { hexToRgba } from './kanban/types'

// Field components (for direct use or overriding)
export {
  ArrayField,
  BlocksField,
  CheckboxField,
  CodeField,
  CollapsibleField,
  DateField,
  EmailField,
  FallbackField,
  GroupField,
  JoinField,
  JSONField,
  NumberField,
  PointField,
  RadioField,
  RelationshipField,
  RichTextField,
  RowField,
  SelectField,
  TabsField,
  TextField,
  TextareaField,
  UIField,
  UploadField,
} from './fields'

// API client
export { payloadApi } from './utils/api'
export { PayloadAPIError } from './utils/api'
export type { PayloadAPIConfig, VersionDoc } from './utils/api'

// Schema helpers
export {
  deserializeSchemaMap,
  extractRootFields,
  getByPath,
  getCollectionLabel,
  getDocumentTitle,
  getFieldDescription,
  getFieldLabel,
  getGlobalLabel,
  groupFieldsByWidth,
  isFieldHidden,
  isFieldSidebar,
  normalizeOption,
  setByPath,
  splitFieldsBySidebar,
} from './utils/schemaHelpers'
export type { FieldWidthGroup } from './utils/schemaHelpers'

// Lexical JSON ↔ HTML converters (for react-native-enriched integration)
export { lexicalToHtml } from './utils/lexicalToHtml'
export { htmlToLexical } from './utils/htmlToLexical'

// Rich text toolbar
export { RichTextToolbar } from './fields/RichTextToolbar'
export type { StyleState, StyleStateEntry, RichTextToolbarProps } from './fields/RichTextToolbar'

// Mention picker
export { MentionPicker } from './fields/MentionPicker'

// Validation (Phase 1 — Zod schema from Payload fields)
export { payloadFieldsToZod, validateFormData } from './utils/validation'

// React Hook Form integration (Phase 2 + 3)
export {
  isRHFAvailable,
  usePayloadField,
  usePayloadForm,
  usePayloadFormContext,
} from './hooks/usePayloadForm'
export type {
  PayloadFieldProps,
  PayloadFieldReturn,
  PayloadFormConfig,
  PayloadFormReturn,
} from './hooks/usePayloadForm'

// Theme + canonical form-row metrics (FieldShell/FormSection row contract)
export { CONTENT_INSET, defaultTheme, INLINE_ROW_GAP, ROW_MIN_HEIGHT, STACKED_LABEL_GAP } from './theme'
export type { Theme } from './theme'

// Types
export type {
  ActionHandler,
  ActionHandlerRegistry,
  AdminSchema,
  AuthState,
  ClientArrayField,
  ClientBlocksField,
  ClientCheckboxField,
  ClientCodeField,
  ClientCollapsibleField,
  ClientDateField,
  ClientEmailField,
  ClientField,
  ClientFieldBase,
  ClientGroupField,
  ClientJoinField,
  ClientJSONField,
  ClientNumberField,
  ClientPointField,
  ClientRadioField,
  ClientRelationshipField,
  ClientRichTextField,
  ClientRowField,
  ClientSelectField,
  ClientTabsField,
  ClientTextField,
  ClientTextareaField,
  ClientUIField,
  ClientUploadField,
  ComponentSlot,
  CustomComponentRegistry,
  CustomFieldEntry,
  EditActionContext,
  FieldComponentProps,
  FieldValue,
  FormErrors,
  FormState,
  ListActionContext,
  MenuModel,
  NativeActionMeta,
  NativeFieldType,
  PaginatedDocs,
  PayloadNativeContextValue,
  SelectOption,
  SerializedSchemaMap,
} from './types'
