/**
 * Phase 1 — Zod schema generation from Payload field definitions.
 *
 * Converts the admin schema's ClientField[] into a Zod schema that
 * can validate form data client-side before hitting the API.
 *
 * Supports: required, min/max, minLength/maxLength, options enum,
 * email format, arrays (minRows/maxRows), nested groups, tabs, blocks.
 */
import { z } from 'zod'

import type {
  ClientArrayField,
  ClientBlocksField,
  ClientCheckboxField,
  ClientCodeField,
  ClientDateField,
  ClientEmailField,
  ClientField,
  ClientGroupField,
  ClientJSONField,
  ClientNumberField,
  ClientPointField,
  ClientRadioField,
  ClientRelationshipField,
  ClientSelectField,
  ClientTabsField,
  ClientTextField,
  ClientTextareaField,
  ClientUploadField,
} from './types'
import { normalizeOption } from './schemaHelpers'

// ---------------------------------------------------------------------------
// Single field → Zod schema
// ---------------------------------------------------------------------------

const textSchema = (field: ClientTextField): z.ZodTypeAny => {
  let s = z.string()
  if (field.minLength != null) s = s.min(field.minLength, `Minimum ${field.minLength} characters`)
  if (field.maxLength != null) s = s.max(field.maxLength, `Maximum ${field.maxLength} characters`)
  if (field.required) return s.min(1, 'This field is required')
  return s.optional().or(z.literal(''))
}

const emailSchema = (field: ClientEmailField): z.ZodTypeAny => {
  let s = z.string().email('Invalid email address')
  if (field.required) return s
  return s.optional().or(z.literal(''))
}

const numberSchema = (field: ClientNumberField): z.ZodTypeAny => {
  let n = z.number({ invalid_type_error: 'Must be a number' })
  if ((field as any).min != null) n = n.min((field as any).min, `Minimum value is ${(field as any).min}`)
  if ((field as any).max != null) n = n.max((field as any).max, `Maximum value is ${(field as any).max}`)
  if (field.required) return n
  return n.optional().nullable()
}

const textareaSchema = (field: ClientTextareaField): z.ZodTypeAny => {
  let s = z.string()
  if (field.minLength != null) s = s.min(field.minLength, `Minimum ${field.minLength} characters`)
  if (field.maxLength != null) s = s.max(field.maxLength, `Maximum ${field.maxLength} characters`)
  if (field.required) return s.min(1, 'This field is required')
  return s.optional().or(z.literal(''))
}

const codeSchema = (field: ClientCodeField): z.ZodTypeAny => {
  if (field.required) return z.string().min(1, 'This field is required')
  return z.string().optional().or(z.literal(''))
}

const jsonSchema = (_field: ClientJSONField): z.ZodTypeAny => {
  // JSON fields accept any valid JSON value
  return z.any()
}

const dateSchema = (field: ClientDateField): z.ZodTypeAny => {
  // Dates are stored as ISO strings
  const s = z.string()
  if (field.required) return s.min(1, 'This field is required')
  return s.optional().nullable().or(z.literal(''))
}

const pointSchema = (field: ClientPointField): z.ZodTypeAny => {
  const tuple = z.tuple([z.number(), z.number()])
  if (field.required) return tuple
  return tuple.optional().nullable()
}

const checkboxSchema = (_field: ClientCheckboxField): z.ZodTypeAny => {
  return z.boolean().optional().default(false)
}

const selectSchema = (field: ClientSelectField): z.ZodTypeAny => {
  const opts = (field.options ?? []).map(normalizeOption)
  const values = opts.map((o) => o.value)

  if (field.hasMany) {
    const arr = z.array(z.enum(values as [string, ...string[]]))
    if (field.required) return arr.min(1, 'Select at least one option')
    return arr.optional().default([])
  }

  if (values.length > 0) {
    const enumSchema = z.enum(values as [string, ...string[]])
    if (field.required) return enumSchema
    return enumSchema.optional().nullable()
  }

  if (field.required) return z.string().min(1, 'This field is required')
  return z.string().optional().nullable()
}

const radioSchema = (field: ClientRadioField): z.ZodTypeAny => {
  const opts = (field.options ?? []).map(normalizeOption)
  const values = opts.map((o) => o.value)

  if (values.length > 0) {
    const enumSchema = z.enum(values as [string, ...string[]])
    if (field.required) return enumSchema
    return enumSchema.optional().nullable()
  }

  if (field.required) return z.string().min(1, 'This field is required')
  return z.string().optional().nullable()
}

const relationshipSchema = (field: ClientRelationshipField): z.ZodTypeAny => {
  // Relationship values can be IDs (strings) or populated objects
  const idOrObj = z.union([z.string(), z.record(z.unknown())])

  if (field.hasMany) {
    const arr = z.array(idOrObj)
    if (field.required) return arr.min(1, 'Select at least one')
    return arr.optional().default([])
  }

  if (field.required) return idOrObj
  return idOrObj.optional().nullable()
}

const uploadSchema = (field: ClientUploadField): z.ZodTypeAny => {
  const idOrObj = z.union([z.string(), z.record(z.unknown())])
  if (field.required) return idOrObj
  return idOrObj.optional().nullable()
}

// ---------------------------------------------------------------------------
// Structural fields → recursive Zod shape
// ---------------------------------------------------------------------------

/** Build a Zod schema for a single field (leaf or structural). */
const fieldToZod = (field: ClientField): z.ZodTypeAny => {
  switch (field.type) {
    case 'text':
      return textSchema(field)
    case 'email':
      return emailSchema(field)
    case 'number':
      return numberSchema(field)
    case 'textarea':
      return textareaSchema(field)
    case 'code':
      return codeSchema(field)
    case 'json':
      return jsonSchema(field)
    case 'date':
      return dateSchema(field)
    case 'point':
      return pointSchema(field)
    case 'checkbox':
      return checkboxSchema(field)
    case 'select':
      return selectSchema(field)
    case 'radio':
      return radioSchema(field)
    case 'relationship':
      return relationshipSchema(field)
    case 'upload':
      return uploadSchema(field)

    // -- Structural: recurse into sub-fields --
    case 'group':
      return groupToZod(field)
    case 'array':
      return arrayToZod(field)
    case 'blocks':
      return blocksToZod(field)
    case 'tabs':
      return tabsToZod(field)

    // Row, collapsible, richText, join, ui — pass through or skip
    case 'row':
    case 'collapsible':
      // These are layout wrappers — their sub-fields are flattened
      // into the parent shape by fieldsToZodShape.
      return z.any()
    case 'richText':
      if (field.required) return z.any().refine((v) => v != null && v !== '', 'This field is required')
      return z.any()
    case 'join':
    case 'ui':
      return z.any()

    default:
      return z.any()
  }
}

/** Build a Zod object shape from a flat list of fields (flattening row/collapsible). */
const fieldsToZodShape = (fields: ClientField[]): Record<string, z.ZodTypeAny> => {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of fields) {
    // Row and collapsible are layout-only — their children are siblings
    if (field.type === 'row' || field.type === 'collapsible') {
      const subFields = (field as { fields?: ClientField[] }).fields ?? []
      Object.assign(shape, fieldsToZodShape(subFields))
      continue
    }

    // Skip fields without a name (pure layout / UI)
    if (!field.name) continue

    // Skip hidden or UI-only fields
    if (field.admin?.hidden || field.type === 'ui') continue

    shape[field.name] = fieldToZod(field)
  }

  return shape
}

const groupToZod = (field: ClientGroupField): z.ZodTypeAny => {
  const subFields = field.fields ?? []
  const inner = z.object(fieldsToZodShape(subFields)).passthrough()
  if (field.required) return inner
  return inner.optional().default({})
}

const arrayToZod = (field: ClientArrayField): z.ZodTypeAny => {
  const subFields = field.fields ?? []
  const rowSchema = z.object(fieldsToZodShape(subFields)).passthrough()
  let arr = z.array(rowSchema)
  if (field.minRows != null) arr = arr.min(field.minRows, `At least ${field.minRows} item${field.minRows !== 1 ? 's' : ''} required`)
  if (field.maxRows != null) arr = arr.max(field.maxRows, `At most ${field.maxRows} item${field.maxRows !== 1 ? 's' : ''} allowed`)
  if (field.required && !field.minRows) arr = arr.min(1, 'At least one item required')
  return arr.optional().default([])
}

const blocksToZod = (field: ClientBlocksField): z.ZodTypeAny => {
  const blocks = field.blocks ?? []
  // Each block type has its own shape + discriminator
  const blockSchemas = blocks.map((block) => {
    const shape = fieldsToZodShape(block.fields ?? [])
    return z.object({
      blockType: z.literal(block.slug),
      ...shape,
    }).passthrough()
  })

  const union = blockSchemas.length > 1
    ? z.discriminatedUnion('blockType', blockSchemas as unknown as [z.ZodObject<any>, z.ZodObject<any>, ...z.ZodObject<any>[]])
    : blockSchemas[0] ?? z.object({ blockType: z.string() }).passthrough()

  let arr = z.array(union)
  if (field.minRows != null) arr = arr.min(field.minRows, `At least ${field.minRows} block${field.minRows !== 1 ? 's' : ''} required`)
  if (field.maxRows != null) arr = arr.max(field.maxRows, `At most ${field.maxRows} block${field.maxRows !== 1 ? 's' : ''} allowed`)
  return arr.optional().default([])
}

const tabsToZod = (field: ClientTabsField): z.ZodTypeAny => {
  // Named tabs → each tab is a nested object (like group)
  // Unnamed tabs → their fields are flattened into the parent
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const tab of field.tabs ?? []) {
    const subFields = tab.fields ?? []
    if (tab.name) {
      // Named tab → nested object
      shape[tab.name] = z.object(fieldsToZodShape(subFields)).passthrough().optional().default({})
    } else {
      // Unnamed tab → fields merge into parent
      Object.assign(shape, fieldsToZodShape(subFields))
    }
  }

  return z.object(shape).passthrough()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a Payload ClientField[] array to a Zod validation schema.
 *
 * Usage:
 * ```ts
 * const schema = payloadFieldsToZod(rootFields)
 * const result = schema.safeParse(formData)
 * if (!result.success) {
 *   // result.error.flatten().fieldErrors → { fieldName: ['message'] }
 * }
 * ```
 */
export const payloadFieldsToZod = (fields: ClientField[]): z.ZodObject<any> => {
  return z.object(fieldsToZodShape(fields)).passthrough()
}

/**
 * Validate form data against a Payload field schema.
 * Returns a flat error map (field path → error message) compatible with FormErrors.
 * Returns empty if Zod is not available (no-op — validation skipped).
 */
export const validateFormData = (
  fields: ClientField[],
  data: Record<string, unknown>,
): Record<string, string | undefined> => {
  const schema = payloadFieldsToZod(fields)
  const result = schema.safeParse(data)

  if (result.success) return {}

  const errors: Record<string, string | undefined> = {}
  const issues = result.error.issues

  for (const issue of issues) {
    // Zod paths are arrays of keys — join with dots for Payload's flat path format
    const path = issue.path.map(String).join('.')
    if (path && !errors[path]) {
      errors[path] = issue.message
    }
  }

  return errors
}
