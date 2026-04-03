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
export { DocumentActionsMenu } from './DocumentActionsMenu'
export { DocumentForm, FormDataContext, useFormData } from './DocumentForm'
export type { DocumentFormHandle, FormDataContextValue } from './DocumentForm'
export { DocumentList } from './DocumentList'
export { FieldRenderer } from './FieldRenderer'
export { FilterBottomSheet } from './FilterBottomSheet'
export { FilterChips } from './FilterChips'
export { SyncStatusCard } from './SyncStatusCard'
export { SyncStatusSection } from './SyncStatusSection'
export { VersionDiff } from './VersionDiff'
export { VersionsBottomSheet } from './VersionsBottomSheet'

// Custom component overrides
export {
  CustomComponentProvider,
  useCustomAdminComponent,
  useCustomComponent,
  useCustomComponentRegistry,
  useCustomFieldSlots,
  useCustomView,
} from './contexts/CustomComponentContext'

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
export { useDocumentListFilters } from './hooks/useDocumentListFilters'
export type { ActiveFilter } from './hooks/useDocumentListFilters'

// Filter utilities
export { getOperatorsForFieldType, isFieldFilterable, getFilterableFieldTypes } from './utils/filterOperators'
export type { FilterOperator } from './utils/filterOperators'

// Field registry
export { fieldRegistry, getFieldComponent, FieldRendererContext } from './fields'

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

// Theme
export { defaultTheme } from './theme'
export type { Theme } from './theme'

// Types
export type {
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
  FieldComponentProps,
  FieldValue,
  FormErrors,
  FormState,
  MenuModel,
  NativeFieldType,
  PaginatedDocs,
  PayloadNativeContextValue,
  SelectOption,
  SerializedSchemaMap,
} from './types'
