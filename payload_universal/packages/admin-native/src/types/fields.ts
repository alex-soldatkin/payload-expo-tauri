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
