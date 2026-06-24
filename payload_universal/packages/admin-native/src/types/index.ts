import type { AdminLocale, AdminLocalization, AdminSchema, MenuModel, NativeActionMeta, SerializedSchemaMap } from '@payload-universal/admin-schema'

// Re-export schema types for consumer convenience
export type { AdminLocale, AdminLocalization, AdminSchema, MenuModel, NativeActionMeta, SerializedSchemaMap }

// ---------------------------------------------------------------------------
// Client field types (mirrors Payload's ClientField but without server deps)
// ---------------------------------------------------------------------------
export type {
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
  FieldComponentProps,
  FieldValue,
  FormErrors,
  FormState,
  NativeFieldType,
  SelectOption,
} from './fields'

// ---------------------------------------------------------------------------
// Auth + provider context
// ---------------------------------------------------------------------------
export type { AuthState, PayloadNativeContextValue } from './provider'

// ---------------------------------------------------------------------------
// Custom component overrides + native action items
// ---------------------------------------------------------------------------
export type {
  ActionHandler,
  ActionHandlerRegistry,
  ComponentSlot,
  CustomComponentRegistry,
  CustomFieldEntry,
  EditActionContext,
  ListActionContext,
} from './registry'

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------
export type { PaginatedDocs } from './api'
