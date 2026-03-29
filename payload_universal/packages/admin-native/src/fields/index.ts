/**
 * Field component registry.
 * Maps Payload field types → native React Native components.
 */
import type React from 'react'
import type { FieldComponentProps } from '../types'

import { CodeField, EmailField, JSONField, NumberField, PointField, TextField, TextareaField } from './inputs'
import { CheckboxField, DateField } from './controls'
import { RadioField, RelationshipField, SelectField, UploadField } from './pickers'
import { ArrayField, BlocksField, CollapsibleField, GroupField, RowField, TabsField } from './structural'
import { RichTextField } from './richtext'
import { FallbackField } from './fallback'

// Re-export everything for direct imports
export {
  // inputs
  TextField,
  EmailField,
  NumberField,
  TextareaField,
  CodeField,
  JSONField,
  PointField,
  // controls
  CheckboxField,
  DateField,
  // pickers
  SelectField,
  RadioField,
  RelationshipField,
  UploadField,
  // structural
  ArrayField,
  BlocksField,
  GroupField,
  CollapsibleField,
  RowField,
  TabsField,
  // richtext
  RichTextField,
  // fallback
  FallbackField,
}

export { ErrorMapContext, FieldRendererContext } from './structural'

// ---------------------------------------------------------------------------
// Registry: field.type → component
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fieldRegistry: Record<string, React.ComponentType<FieldComponentProps<any>>> = {
  text: TextField,
  email: EmailField,
  number: NumberField,
  textarea: TextareaField,
  code: CodeField,
  json: JSONField,
  point: PointField,
  checkbox: CheckboxField,
  date: DateField,
  select: SelectField,
  radio: RadioField,
  relationship: RelationshipField,
  upload: UploadField,
  array: ArrayField,
  blocks: BlocksField,
  group: GroupField,
  collapsible: CollapsibleField,
  row: RowField,
  tabs: TabsField,
  richText: RichTextField,
}

/** Look up the component for a given field type, falling back to FallbackField. */
export const getFieldComponent = (
  type: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): React.ComponentType<FieldComponentProps<any>> => fieldRegistry[type] ?? FallbackField
