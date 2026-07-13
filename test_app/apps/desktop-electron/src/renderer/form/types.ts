// Shared contracts for the schema-driven form. Field components receive the
// schema field def, the dot-path to their value, and the RHF control — the
// same shape admin-native's field registry uses, translated to DOM.
import type { Control, UseFormGetValues, UseFormSetValue } from 'react-hook-form'

/**
 * A Payload ClientField as it arrives through the serialized admin schema.
 * We type the properties the renderer reads rather than importing payload's
 * 40-type union — the schema is data here, not code.
 */
export type SchemaField = {
  type: string
  name?: string
  label?: LabelValue
  required?: boolean
  localized?: boolean
  unique?: boolean
  hasMany?: boolean
  min?: number
  max?: number
  minRows?: number
  maxRows?: number
  minLength?: number
  maxLength?: number
  options?: Array<string | { label: LabelValue; value: string }>
  relationTo?: string | string[]
  filterOptions?: Record<string, unknown>
  fields?: SchemaField[]
  tabs?: SchemaTab[]
  blocks?: SchemaBlock[]
  labels?: { singular?: LabelValue; plural?: LabelValue }
  defaultValue?: unknown
  admin?: {
    description?: LabelValue
    placeholder?: LabelValue
    position?: 'sidebar'
    width?: string
    hidden?: boolean
    readOnly?: boolean
    disabled?: boolean
    hasCondition?: boolean
    initCollapsed?: boolean
    layout?: 'horizontal' | 'vertical'
    language?: string
    step?: number
    date?: { pickerAppearance?: string; displayFormat?: string }
    pickerAppearance?: string
    isClearable?: boolean
    isSortable?: boolean
  }
  // join fields
  collection?: string
  on?: string
}

export type SchemaTab = {
  name?: string
  label?: LabelValue
  fields: SchemaField[]
}

export type SchemaBlock = {
  slug: string
  labels?: { singular?: LabelValue; plural?: LabelValue }
  fields: SchemaField[]
}

/** Payload labels are plain strings or per-locale records. */
export type LabelValue = string | Record<string, string> | undefined

/** Props every field editor component receives. */
export type FieldComponentProps = {
  field: SchemaField
  /** Dot-path to this field's value in the form object ('' only for containers at root). */
  path: string
  control: Control<Record<string, unknown>>
  getValues: UseFormGetValues<Record<string, unknown>>
  setValue: UseFormSetValue<Record<string, unknown>>
  /** Collection slug (registry + condition scoping). */
  slug: string
  /** Validation error for this exact path, if any. */
  error?: string
  /** Notify the form a field was edited (clears that path's validation error). */
  onEdit?: (path: string) => void
  /** Render a child field (containers use this to recurse). */
  renderField: RenderFieldFn
}

export type RenderFieldFn = (field: SchemaField, basePath: string) => React.ReactNode
