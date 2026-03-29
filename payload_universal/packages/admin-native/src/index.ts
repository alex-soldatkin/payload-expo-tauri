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

// Core components
export { BottomSheet } from './BottomSheet'
export { DocumentForm } from './DocumentForm'
export type { DocumentFormHandle } from './DocumentForm'
export { DocumentList } from './DocumentList'
export { FieldRenderer } from './FieldRenderer'
export { FilterBottomSheet } from './FilterBottomSheet'
export { FilterChips } from './FilterChips'
export { SyncStatusCard } from './SyncStatusCard'
export { SyncStatusSection } from './SyncStatusSection'

// Toast notifications
export { ToastProvider, useToast } from './Toast'

// Search & filter hooks
export { useDocumentListFilters } from './useDocumentListFilters'
export type { ActiveFilter } from './useDocumentListFilters'

// Filter utilities
export { getOperatorsForFieldType, isFieldFilterable, getFilterableFieldTypes } from './filterOperators'
export type { FilterOperator } from './filterOperators'

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
export { payloadApi } from './api'
export { PayloadAPIError } from './api'
export type { PayloadAPIConfig } from './api'

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
  isFieldHidden,
  isFieldSidebar,
  normalizeOption,
  setByPath,
  splitFieldsBySidebar,
} from './schemaHelpers'

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
