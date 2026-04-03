/**
 * Validation runner — walks the client field schema tree and runs
 * built-in + custom validators against the form data.
 *
 * Returns a Record<string, string> (field path → error message) that is
 * directly compatible with admin-native's FormErrors type.
 */
import type {
  ClientFieldConfig,
  ClientHooksConfig,
  ClientValidateOptions,
  ValidationErrors,
  ValidationResult,
} from './types'

import { builtinValidators } from './builtinValidators'

// ---------------------------------------------------------------------------
// ClientField shape (mirrors admin-native/src/types.ts without importing it)
// ---------------------------------------------------------------------------

type AnyField = {
  name?: string
  type: string
  label?: string | Record<string, string>
  required?: boolean
  admin?: {
    hidden?: boolean
    readOnly?: boolean
    position?: string
    [key: string]: unknown
  }
  // Constraint metadata
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  minRows?: number
  maxRows?: number
  hasMany?: boolean
  options?: Array<{ label?: string; value: string } | string>
  // Structural children
  fields?: AnyField[]
  tabs?: Array<{ name?: string; fields?: AnyField[]; [key: string]: unknown }>
  blocks?: Array<{ slug: string; fields?: AnyField[]; [key: string]: unknown }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return current
}

function getSiblingData(data: Record<string, unknown>, path: string): Record<string, unknown> {
  const parts = path.split('.')
  if (parts.length <= 1) return data
  const parentPath = parts.slice(0, -1).join('.')
  const parent = getByPath(data, parentPath)
  return (typeof parent === 'object' && parent !== null ? parent : {}) as Record<string, unknown>
}

function buildPath(basePath: string, fieldName: string): string {
  return basePath ? `${basePath}.${fieldName}` : fieldName
}

// ---------------------------------------------------------------------------
// Core validation traversal
// ---------------------------------------------------------------------------

async function validateField(
  field: AnyField,
  value: unknown,
  path: string,
  data: Record<string, unknown>,
  errors: ValidationErrors,
  collectionSlug: string,
  hooksConfig?: ClientHooksConfig,
  operation?: 'create' | 'update',
): Promise<void> {
  // Skip hidden and read-only fields
  if (field.admin?.hidden || field.admin?.readOnly) return

  const fieldType = field.type

  // --- Structural fields: recurse into children ---

  if (fieldType === 'group') {
    const groupData = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
    for (const child of field.fields ?? []) {
      const childName = child.name
      if (!childName) {
        // Unnamed fields (row, collapsible) — recurse transparently
        await validateField(child, groupData, path, data, errors, collectionSlug, hooksConfig, operation)
        continue
      }
      const childPath = buildPath(path, childName)
      const childValue = groupData[childName]
      await validateField(child, childValue, childPath, data, errors, collectionSlug, hooksConfig, operation)
    }
    return
  }

  if (fieldType === 'row' || fieldType === 'collapsible') {
    // Transparent wrappers — children are at the same data level
    const parentData = (typeof getByPath(data, path.split('.').slice(0, -1).join('.') || '') === 'object'
      ? getByPath(data, path.split('.').slice(0, -1).join('.') || '')
      : data) as Record<string, unknown>
    for (const child of field.fields ?? []) {
      const childName = child.name
      if (!childName) {
        await validateField(child, parentData, '', data, errors, collectionSlug, hooksConfig, operation)
        continue
      }
      // For row/collapsible, the parent path is the container's parent
      const basePath = path // path here is the parent context path
      const childPath = basePath ? `${basePath}.${childName}` : childName
      const childValue = getByPath(data, childPath)
      await validateField(child, childValue, childPath, data, errors, collectionSlug, hooksConfig, operation)
    }
    return
  }

  if (fieldType === 'tabs') {
    for (const tab of field.tabs ?? []) {
      if (tab.name) {
        // Named tab: adds a path segment
        const tabPath = buildPath(path, tab.name)
        const tabData = (typeof getByPath(data, tabPath) === 'object'
          ? getByPath(data, tabPath)
          : {}) as Record<string, unknown>
        for (const child of tab.fields ?? []) {
          const childName = child.name
          if (!childName) {
            await validateField(child, tabData, tabPath, data, errors, collectionSlug, hooksConfig, operation)
            continue
          }
          const childPath = buildPath(tabPath, childName)
          const childValue = tabData[childName]
          await validateField(child, childValue, childPath, data, errors, collectionSlug, hooksConfig, operation)
        }
      } else {
        // Unnamed tab: transparent — fields at current level
        for (const child of tab.fields ?? []) {
          const childName = child.name
          if (!childName) {
            await validateField(child, data, '', data, errors, collectionSlug, hooksConfig, operation)
            continue
          }
          const childPath = buildPath(path, childName)
          const childValue = getByPath(data, childPath)
          await validateField(child, childValue, childPath, data, errors, collectionSlug, hooksConfig, operation)
        }
      }
    }
    return
  }

  if (fieldType === 'array') {
    // Validate the array itself (minRows, maxRows)
    const builtinValidator = builtinValidators[fieldType]
    if (builtinValidator) {
      const opts: ClientValidateOptions = {
        required: field.required,
        minRows: field.minRows,
        maxRows: field.maxRows,
        data,
        siblingData: getSiblingData(data, path),
        operation,
      }
      const result = await builtinValidator(value, opts)
      if (typeof result === 'string') {
        errors[path] = result
      }
    }

    // Validate each row's fields
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const rowData = (typeof value[i] === 'object' && value[i] !== null ? value[i] : {}) as Record<string, unknown>
        for (const child of field.fields ?? []) {
          const childName = child.name
          if (!childName) continue
          const childPath = `${path}.${i}.${childName}`
          const childValue = rowData[childName]
          await validateField(child, childValue, childPath, data, errors, collectionSlug, hooksConfig, operation)
        }
      }
    }
    return
  }

  if (fieldType === 'blocks') {
    // Validate the blocks array itself
    const builtinValidator = builtinValidators[fieldType]
    if (builtinValidator) {
      const opts: ClientValidateOptions = {
        required: field.required,
        minRows: field.minRows,
        maxRows: field.maxRows,
        data,
        siblingData: getSiblingData(data, path),
        operation,
      }
      const result = await builtinValidator(value, opts)
      if (typeof result === 'string') {
        errors[path] = result
      }
    }

    // Validate each block's fields
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const blockData = (typeof value[i] === 'object' && value[i] !== null ? value[i] : {}) as Record<string, unknown>
        const blockType = blockData.blockType as string | undefined
        if (!blockType) continue

        const blockDef = (field.blocks ?? []).find((b) => b.slug === blockType)
        if (!blockDef) continue

        for (const child of blockDef.fields ?? []) {
          const childName = child.name
          if (!childName) continue
          const childPath = `${path}.${i}.${childName}`
          const childValue = blockData[childName]
          await validateField(child, childValue, childPath, data, errors, collectionSlug, hooksConfig, operation)
        }
      }
    }
    return
  }

  // Skip fields with no type or ui-only fields
  if (fieldType === 'ui' || fieldType === 'join') return

  // --- Leaf fields: run validation ---

  if (!field.name) return // Unnamed fields shouldn't validate at leaf level

  // 1. Run built-in validator
  const builtinValidator = builtinValidators[fieldType]
  if (builtinValidator) {
    const opts: ClientValidateOptions = {
      required: field.required,
      minLength: field.minLength,
      maxLength: field.maxLength,
      min: field.min,
      max: field.max,
      minRows: field.minRows,
      maxRows: field.maxRows,
      hasMany: field.hasMany,
      options: field.options,
      data,
      siblingData: getSiblingData(data, path),
      operation,
    }

    const result = await builtinValidator(value, opts)
    if (typeof result === 'string') {
      errors[path] = result
      return // Don't run custom validator if built-in already failed
    }
  }

  // 2. Run custom validator (from ClientHooksConfig)
  const fieldConfig = hooksConfig?.collections[collectionSlug]?.fields?.[path]
  if (fieldConfig?.validate) {
    const opts: ClientValidateOptions = {
      required: field.required,
      minLength: field.minLength,
      maxLength: field.maxLength,
      min: field.min,
      max: field.max,
      hasMany: field.hasMany,
      options: field.options,
      data,
      siblingData: getSiblingData(data, path),
      operation,
    }
    const result = await fieldConfig.validate(value, opts)
    if (typeof result === 'string') {
      errors[path] = result
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run client-side validation on a full document against the field schema.
 *
 * @param fields - The root-level client field definitions from the admin schema.
 * @param data - The form data to validate.
 * @param collectionSlug - The collection slug (for looking up custom validators).
 * @param hooksConfig - Optional app-level hooks/validators config.
 * @param operation - Whether this is a 'create' or 'update' operation.
 * @returns ValidationResult with `valid` flag and `errors` map.
 */
export async function runValidation(
  fields: AnyField[],
  data: Record<string, unknown>,
  collectionSlug: string,
  hooksConfig?: ClientHooksConfig,
  operation?: 'create' | 'update',
): Promise<ValidationResult> {
  const errors: ValidationErrors = {}

  for (const field of fields) {
    const fieldName = field.name
    if (!fieldName) {
      // Unnamed structural fields (row, collapsible, tabs at root) — recurse
      await validateField(field, data, '', data, errors, collectionSlug, hooksConfig, operation)
      continue
    }
    const value = data[fieldName]
    await validateField(field, value, fieldName, data, errors, collectionSlug, hooksConfig, operation)
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}
