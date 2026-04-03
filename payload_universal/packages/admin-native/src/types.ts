import type { AdminSchema, MenuModel, SerializedSchemaMap } from '@payload-universal/admin-schema'

// Re-export schema types for consumer convenience
export type { AdminSchema, MenuModel, SerializedSchemaMap }

// ---------------------------------------------------------------------------
// Client field types (mirrors Payload's ClientField but without server deps)
// ---------------------------------------------------------------------------

export type NativeFieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'textarea'
  | 'code'
  | 'json'
  | 'date'
  | 'point'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'relationship'
  | 'upload'
  | 'array'
  | 'blocks'
  | 'group'
  | 'collapsible'
  | 'row'
  | 'tabs'
  | 'richText'
  | 'join'
  | 'ui'

export type ClientFieldBase = {
  name?: string
  type: string
  label?: string | Record<string, string>
  required?: boolean
  admin?: {
    description?: string | Record<string, string>
    placeholder?: string
    readOnly?: boolean
    hidden?: boolean
    condition?: unknown
    components?: Record<string, unknown>
    width?: string
    /** Sidebar position – field renders in a "Details" section on mobile */
    position?: 'sidebar'
    /** For group fields – hide the left gutter border */
    hideGutter?: boolean
    /** For collapsible fields – start in collapsed state */
    initCollapsed?: boolean
  }
  localized?: boolean
  unique?: boolean
  index?: boolean
  defaultValue?: unknown
}

export type SelectOption = {
  label: string | Record<string, string>
  value: string
}

export type ClientTextField = ClientFieldBase & { type: 'text'; minLength?: number; maxLength?: number; hasMany?: boolean }
export type ClientEmailField = ClientFieldBase & { type: 'email' }
export type ClientNumberField = ClientFieldBase & { type: 'number'; min?: number; max?: number; hasMany?: boolean }
export type ClientTextareaField = ClientFieldBase & { type: 'textarea'; minLength?: number; maxLength?: number }
export type ClientCodeField = ClientFieldBase & { type: 'code'; language?: string }
export type ClientJSONField = ClientFieldBase & { type: 'json' }
export type ClientDateField = ClientFieldBase & {
  type: 'date'
  admin?: ClientFieldBase['admin'] & {
    date?: { pickerAppearance?: 'dayAndTime' | 'dayOnly' | 'monthOnly' | 'timeOnly' }
  }
}
export type ClientPointField = ClientFieldBase & { type: 'point' }
export type ClientSelectField = ClientFieldBase & { type: 'select'; options: Array<SelectOption | string>; hasMany?: boolean }
export type ClientRadioField = ClientFieldBase & { type: 'radio'; options: Array<SelectOption | string> }
export type ClientCheckboxField = ClientFieldBase & { type: 'checkbox' }
export type ClientRelationshipField = ClientFieldBase & { type: 'relationship'; relationTo: string | string[]; hasMany?: boolean }
export type ClientUploadField = ClientFieldBase & { type: 'upload'; relationTo: string }
export type ClientArrayField = ClientFieldBase & {
  type: 'array'
  fields?: ClientField[]
  minRows?: number
  maxRows?: number
  labels?: { singular?: string; plural?: string }
}
export type ClientBlocksField = ClientFieldBase & {
  type: 'blocks'
  blocks?: Array<{ slug: string; fields?: ClientField[]; labels?: { singular?: string; plural?: string } }>
  minRows?: number
  maxRows?: number
}
export type ClientGroupField = ClientFieldBase & { type: 'group'; fields?: ClientField[] }
export type ClientCollapsibleField = ClientFieldBase & { type: 'collapsible'; fields?: ClientField[] }
export type ClientRowField = ClientFieldBase & { type: 'row'; fields?: ClientField[] }
export type ClientTabsField = ClientFieldBase & {
  type: 'tabs'
  tabs?: Array<{
    name?: string
    label?: string | Record<string, string>
    fields?: ClientField[]
    description?: string | Record<string, string>
  }>
}
export type ClientRichTextField = ClientFieldBase & { type: 'richText' }
export type ClientJoinField = ClientFieldBase & {
  type: 'join'
  /** The collection(s) being joined. Single slug or array for polymorphic joins. */
  collection: string | string[]
  /** Dot-path to the relationship/upload field in the joined collection that points back. */
  on: string
  /** Default number of docs per page. */
  defaultLimit?: number
  /** Default sort field (e.g. '-createdAt'). */
  defaultSort?: string
  /** Max population depth. */
  maxDepth?: number
  /** Whether reordering is enabled. */
  orderable?: boolean
  /** Additional WHERE filter applied to the query. */
  where?: Record<string, unknown>
  admin?: ClientFieldBase['admin'] & {
    /** Whether creating new related docs is allowed from the join view. */
    allowCreate?: boolean
    /** Which columns to show in the table. Array of field name strings. */
    defaultColumns?: string[]
    /** Hide the row type selector for polymorphic joins. */
    disableRowTypes?: boolean
  }
  /** Resolved target field info (set by Payload's client config builder). */
  targetField?: {
    relationTo?: string | string[]
  }
}
export type ClientUIField = ClientFieldBase & { type: 'ui' }

export type ClientField =
  | ClientTextField
  | ClientEmailField
  | ClientNumberField
  | ClientTextareaField
  | ClientCodeField
  | ClientJSONField
  | ClientDateField
  | ClientPointField
  | ClientSelectField
  | ClientRadioField
  | ClientCheckboxField
  | ClientRelationshipField
  | ClientUploadField
  | ClientArrayField
  | ClientBlocksField
  | ClientGroupField
  | ClientCollapsibleField
  | ClientRowField
  | ClientTabsField
  | ClientRichTextField
  | ClientJoinField
  | ClientUIField

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

export type FieldValue = unknown
export type FormState = Record<string, FieldValue>
export type FormErrors = Record<string, string | undefined>

// ---------------------------------------------------------------------------
// Field component props
// ---------------------------------------------------------------------------

export type FieldComponentProps<T extends ClientFieldBase = ClientFieldBase> = {
  field: T
  value: FieldValue
  onChange: (value: FieldValue) => void
  path: string
  disabled?: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

export type AuthState = {
  token: string | null
  user: Record<string, unknown> | null
  isAuthenticated: boolean
  isLoading: boolean
}

// ---------------------------------------------------------------------------
// Provider context value
// ---------------------------------------------------------------------------

export type PayloadNativeContextValue = {
  schema: AdminSchema | null
  auth: AuthState
  baseURL: string
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshSchema: () => Promise<void>
  isSchemaLoading: boolean
  schemaError: string | null
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

export type PaginatedDocs<T = Record<string, unknown>> = {
  docs: T[]
  totalDocs: number
  limit: number
  totalPages: number
  page: number
  pagingCounter: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage: number | null
  nextPage: number | null
}
