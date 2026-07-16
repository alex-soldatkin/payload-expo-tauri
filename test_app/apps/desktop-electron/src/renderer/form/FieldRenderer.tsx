// Type → editor dispatch, mirroring admin-native's FieldRenderer:
// hidden fields skipped, `ui` fields resolve only through the registry,
// registry Field overrides win, conditional fields are gated (fail-open),
// unknown types fall back to a JSON editor so data is never uneditable.
import { createContext, useContext } from 'react'
import { useWatch } from 'react-hook-form'
import type { Control, UseFormGetValues, UseFormSetValue } from 'react-hook-form'
import type { RenderFieldFn, SchemaField } from './types'
import { normalizeIndexes, subPath } from './paths'
import { isFieldVisible } from './conditions'
import { getFieldSlots } from './registry'
import { TextField } from './fields/TextField'
import { TextareaField } from './fields/TextareaField'
import { NumberField } from './fields/NumberField'
import { CheckboxField } from './fields/CheckboxField'
import { DateField } from './fields/DateField'
import { SelectField } from './fields/SelectField'
import { RadioField } from './fields/RadioField'
import { PointField } from './fields/PointField'
import { JsonField } from './fields/JsonField'
import { CodeField } from './fields/CodeField'
import { RichTextField } from './fields/RichTextField'
import { GroupField } from './fields/GroupField'
import { TabsField } from './fields/TabsField'
import { RowField } from './fields/RowField'
import { CollapsibleField } from './fields/CollapsibleField'
import { ArrayField } from './fields/ArrayField'
import { BlocksField } from './fields/BlocksField'
import { RelationshipField } from './fields/RelationshipField'
import { UploadField } from './fields/UploadField'
import { JoinField } from './fields/JoinField'
import { FallbackField } from './fields/FallbackField'

type FormEngine = {
  slug: string
  /** Configured server base URL (media thumbnails, admin links). */
  serverURL: string
  /** Auth JWT — used for direct REST uploads (UploadField drop-zone). */
  token: string
  /** The document being edited (join-field queries). */
  docId: string
  control: Control<Record<string, unknown>>
  getValues: UseFormGetValues<Record<string, unknown>>
  setValue: UseFormSetValue<Record<string, unknown>>
  errors: Record<string, string>
  onEdit: (path: string) => void
}

const FormEngineContext = createContext<FormEngine | null>(null)
export const FormEngineProvider = FormEngineContext.Provider
export function useFormEngine(): FormEngine {
  const ctx = useContext(FormEngineContext)
  if (!ctx) throw new Error('FieldRenderer must be used inside DocumentForm')
  return ctx
}
/** Nullable peek — shim hooks used by ACTION components (outside any form). */
export function useFormEngineMaybe(): FormEngine | null {
  return useContext(FormEngineContext)
}

/** Blocks set this so nested conditions can resolve `{path}.{blockType}.{name}`. */
const BlockScopeContext = createContext<string | undefined>(undefined)
export const BlockScopeProvider = BlockScopeContext.Provider

const COMPONENTS: Record<string, React.ComponentType<any>> = {
  text: TextField,
  email: TextField,
  textarea: TextareaField,
  number: NumberField,
  checkbox: CheckboxField,
  date: DateField,
  select: SelectField,
  radio: RadioField,
  point: PointField,
  json: JsonField,
  code: CodeField,
  richText: RichTextField,
  group: GroupField,
  tabs: TabsField,
  row: RowField,
  collapsible: CollapsibleField,
  array: ArrayField,
  blocks: BlocksField,
  relationship: RelationshipField,
  upload: UploadField,
  join: JoinField,
}

/** Only fields marked hasCondition subscribe to the whole form value. */
function ConditionGate({
  path,
  children,
}: {
  path: string
  children: React.ReactNode
}) {
  const { slug, control } = useFormEngine()
  const blockType = useContext(BlockScopeContext)
  const formData = useWatch({ control }) as Record<string, unknown>
  if (!isFieldVisible(slug, path, formData, blockType)) return null
  return <>{children}</>
}

export const renderField: RenderFieldFn = (field, basePath) => {
  return <FieldNode key={`${basePath}::${field.name ?? field.type}`} field={field} basePath={basePath} />
}

function FieldNode({ field, basePath }: { field: SchemaField; basePath: string }) {
  const engine = useFormEngine()
  const path = field.name ? subPath(basePath, field.name) : basePath

  if (field.admin?.hidden || (field as { hidden?: boolean }).hidden) return null

  // Normalize row indexes so slots registered for 'sessions.title' also
  // resolve at 'sessions.0.title' (fields nested in array/blocks rows).
  const slots = field.name ? getFieldSlots(engine.slug, normalizeIndexes(path)) : undefined

  // `ui` fields are purely presentational — render only if a component is registered.
  if (field.type === 'ui') {
    const Custom = slots?.Field
    return Custom ? <Custom {...componentProps(engine, field, path)} /> : null
  }

  const Component = slots?.Field ?? COMPONENTS[field.type] ?? FallbackField
  const Before = slots?.beforeInput
  const After = slots?.afterInput

  const body = (
    <>
      {Before && <Before {...componentProps(engine, field, path)} />}
      <Component {...componentProps(engine, field, path)} />
      {After && <After {...componentProps(engine, field, path)} />}
    </>
  )

  if (field.admin?.hasCondition) {
    return <ConditionGate path={path}>{body}</ConditionGate>
  }
  return body
}

function componentProps(engine: FormEngine, field: SchemaField, path: string) {
  return {
    field,
    path,
    control: engine.control,
    getValues: engine.getValues,
    setValue: engine.setValue,
    slug: engine.slug,
    error: engine.errors[path],
    onEdit: engine.onEdit,
    renderField,
  }
}
