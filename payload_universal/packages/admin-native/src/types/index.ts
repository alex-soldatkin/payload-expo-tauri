import type React from 'react'
import type { AdminLocale, AdminLocalization, AdminSchema, MenuModel, NativeActionMeta, SerializedSchemaMap } from '@payload-universal/admin-schema'

// Re-export schema types for consumer convenience
export type { AdminLocale, AdminLocalization, AdminSchema, MenuModel, NativeActionMeta, SerializedSchemaMap }

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
    /** Right-to-left text entry (text/textarea fields). */
    rtl?: boolean
    condition?: unknown
    /**
     * True when the server config declares an `admin.condition` function.
     * Functions cannot serialize — the server emits this boolean marker
     * (plus the field path in AdminSchema.conditions) so a client-side
     * condition registry can match and evaluate locally.
     */
    hasCondition?: boolean
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

export type ClientTextField = ClientFieldBase & {
  type: 'text'
  minLength?: number
  maxLength?: number
  hasMany?: boolean
  /** Min/max number of values when hasMany. */
  minRows?: number
  maxRows?: number
  admin?: ClientFieldBase['admin'] & {
    /** HTML autocomplete hint (web parity); 'password' switches to secure entry on native. */
    autoComplete?: string
  }
}
export type ClientEmailField = ClientFieldBase & { type: 'email' }
export type ClientNumberField = ClientFieldBase & {
  type: 'number'
  min?: number
  max?: number
  hasMany?: boolean
  /** Min/max number of values when hasMany. */
  minRows?: number
  maxRows?: number
  admin?: ClientFieldBase['admin'] & {
    /** Increment step (web parity); drives the native Stepper when min/max bound the field. */
    step?: number
  }
}
export type ClientTextareaField = ClientFieldBase & {
  type: 'textarea'
  minLength?: number
  maxLength?: number
  admin?: ClientFieldBase['admin'] & {
    /** Initial visible line count (web parity); seeds the autogrow height on native. */
    rows?: number
  }
}
export type ClientCodeField = ClientFieldBase & { type: 'code'; language?: string }
export type ClientJSONField = ClientFieldBase & { type: 'json' }
export type ClientDateField = ClientFieldBase & {
  type: 'date'
  /** Whether the field stores a timezone alongside the date (Payload field-level `timezone: true`). */
  timezone?: boolean
  admin?: ClientFieldBase['admin'] & {
    date?: {
      pickerAppearance?: 'dayAndTime' | 'dayOnly' | 'monthOnly' | 'timeOnly'
      /** date-fns format string used for display (e.g. 'dd/MM/yyyy'). */
      displayFormat?: string
      timeFormat?: string
      timeIntervals?: number
      /** Serialized over JSON as ISO strings. */
      minDate?: string | Date
      maxDate?: string | Date
    }
  }
}
export type ClientPointField = ClientFieldBase & { type: 'point' }
export type ClientSelectField = ClientFieldBase & {
  type: 'select'
  options: Array<SelectOption | string>
  hasMany?: boolean
  admin?: ClientFieldBase['admin'] & {
    /** Allow clearing the selection (renders a clear affordance). */
    isClearable?: boolean
    /** Allow drag-sorting of selected values when hasMany. */
    isSortable?: boolean
  }
}
export type ClientRadioField = ClientFieldBase & {
  type: 'radio'
  options: Array<SelectOption | string>
  admin?: ClientFieldBase['admin'] & {
    /** Option layout direction (web parity; default 'horizontal'). */
    layout?: 'horizontal' | 'vertical'
  }
}
export type ClientCheckboxField = ClientFieldBase & { type: 'checkbox' }
export type ClientRelationshipField = ClientFieldBase & {
  type: 'relationship'
  relationTo: string | string[]
  hasMany?: boolean
  /** Min/max number of related docs when hasMany. */
  minRows?: number
  maxRows?: number
  maxDepth?: number
  /**
   * Where-clause filter for selectable docs. Only OBJECT-form filterOptions
   * survive serialization (re-attached by admin-schema); function-form is
   * server-only and arrives as undefined.
   */
  filterOptions?: Record<string, unknown>
  admin?: ClientFieldBase['admin'] & {
    /** Whether the "create new" affordance is allowed (default true). */
    allowCreate?: boolean
    /** Sort order for options: '-fieldName' or per-collection map for polymorphic. */
    sortOptions?: string | Record<string, string>
    /** Allow drag-sorting of selected values when hasMany. */
    isSortable?: boolean
  }
}
export type ClientUploadField = ClientFieldBase & {
  type: 'upload'
  relationTo: string
  hasMany?: boolean
  /** Min/max number of uploads when hasMany. */
  minRows?: number
  maxRows?: number
  /** Show an image preview thumbnail next to the value (web parity). */
  displayPreview?: boolean
  /** Object-form filterOptions (see ClientRelationshipField.filterOptions). */
  filterOptions?: Record<string, unknown>
}
export type ClientArrayField = ClientFieldBase & {
  type: 'array'
  fields?: ClientField[]
  minRows?: number
  maxRows?: number
  labels?: { singular?: string; plural?: string }
  admin?: ClientFieldBase['admin'] & {
    /** Whether rows can be drag-sorted (default true). */
    isSortable?: boolean
    /**
     * Row label config. Component/function RowLabels do NOT serialize
     * (stripped with admin.components) — only static string/record values
     * arrive here; component RowLabels must come via the codegen registry.
     */
    RowLabel?: string | Record<string, string>
  }
}
export type ClientBlocksField = ClientFieldBase & {
  type: 'blocks'
  blocks?: Array<{
    slug: string
    fields?: ClientField[]
    labels?: { singular?: string; plural?: string }
    /** Thumbnail shown in the block picker. */
    imageURL?: string
    imageAltText?: string
    /** Block description shown in the block picker (if provided). */
    description?: string | Record<string, string>
    admin?: {
      /** Group heading the block sorts under in the searchable block picker. */
      group?: string | Record<string, string>
    }
  }>
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
  firstRegister: (email: string, password: string, confirmPassword: string) => Promise<void>
  logout: () => Promise<void>
  refreshSchema: () => Promise<void>
  isSchemaLoading: boolean
  schemaError: string | null
}

// ---------------------------------------------------------------------------
// Custom component override types
// ---------------------------------------------------------------------------

/** Slots where a custom component can override the default rendering. */
export type ComponentSlot = 'Field' | 'Cell' | 'Label' | 'Description' | 'Error' | 'RowLabel'

/**
 * A custom field entry in the registry.
 * Can provide overrides for individual slots (Field, Cell, Label, etc.)
 * and injection points (beforeInput, afterInput).
 */
export type CustomFieldEntry = {
  Field?: React.ComponentType<FieldComponentProps>
  Cell?: React.ComponentType<any>
  Label?: React.ComponentType<any>
  Description?: React.ComponentType<any>
  Error?: React.ComponentType<any>
  /**
   * Custom array-row label (codegen registry slot). Rendered inside
   * RowLabelContext; also receives { data, index, rowNumber, path } props.
   */
  RowLabel?: React.ComponentType<any>
  beforeInput?: React.ComponentType<any>[]
  afterInput?: React.ComponentType<any>[]
}

/**
 * Registry of custom component overrides.
 *
 * - `fields`: Keyed by "collectionSlug.fieldPath" (e.g. "posts.title")
 *   or just "fieldPath" for global overrides. Values are either a bare
 *   component (treated as a Field slot override) or a CustomFieldEntry.
 *
 * - `views`: Custom collection/global views keyed by
 *   "collectionSlug.viewKey" (e.g. "posts.Edit.CustomTab").
 *
 * - `admin`: Admin-level overrides keyed by slot name
 *   (e.g. "Nav", "beforeDashboard", "afterDashboard").
 */
export type CustomComponentRegistry = {
  fields: Record<string, CustomFieldEntry | React.ComponentType<any>>
  views: Record<string, { Component: React.ComponentType<any>; tab?: { label: string } }>
  admin: Record<string, React.ComponentType<any>>
  /**
   * Custom action components for collection list views, keyed by collection slug.
   * Each entry has a `component` (transpiled from Payload's `admin.components.listMenuItems`)
   * and a `label` extracted from the web component's button text during codegen.
   */
  listActions?: Record<string, Array<{ component: React.ComponentType<any>; label?: string }>>
  /**
   * Custom action components for document edit views, keyed by collection slug.
   * Transpiled from `admin.components.edit.editMenuItems`.
   */
  editActions?: Record<string, Array<{ component: React.ComponentType<any>; label?: string }>>
}

// ---------------------------------------------------------------------------
// Native action items (collection-level custom action buttons)
// ---------------------------------------------------------------------------

/**
 * Context provided to list action handlers.
 */
export type ListActionContext = {
  collectionSlug: string
  /** IDs of currently selected documents. Empty if nothing selected. */
  selectedIds: string[]
  /** All currently visible documents. */
  allDocs: Record<string, unknown>[]
  /** Local RxDB instance (may be null if DB not ready). */
  localDB: any
  /** Payload REST API base URL. */
  baseURL: string
  /** Current auth token. */
  token: string | null
}

/**
 * Context provided to edit action handlers.
 */
export type EditActionContext = {
  collectionSlug: string
  documentId: string
  /** The current document data. */
  doc: Record<string, unknown>
  /** Local RxDB instance (may be null if DB not ready). */
  localDB: any
  /** Payload REST API base URL. */
  baseURL: string
  /** Current auth token. */
  token: string | null
}

/** A handler function for a native action. */
export type ActionHandler<Ctx = ListActionContext | EditActionContext> =
  (context: Ctx) => void | Promise<void>

/**
 * Registry of action handlers defined in the mobile app (Metro-bundled).
 *
 * Keyed by collection slug → action key → handler function.
 * Defined per-app (like client validators), not serialized in JSON.
 */
export type ActionHandlerRegistry = {
  [collectionSlug: string]: {
    list?: Record<string, ActionHandler<ListActionContext>>
    edit?: Record<string, ActionHandler<EditActionContext>>
  }
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
