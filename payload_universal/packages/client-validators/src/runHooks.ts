/**
 * Client-side hooks runner.
 *
 * Executes collection-level and field-level hooks in a pipeline,
 * matching Payload's server-side execution order:
 *   1. Collection beforeValidate hooks
 *   2. Field beforeValidate hooks (per field)
 *   3. Validation (handled by runValidation, not this module)
 *   4. Collection beforeChange hooks
 *   5. Field beforeChange hooks (per field)
 *   6. Write (handled by caller)
 *   7. Collection afterChange hooks
 *   8. Field afterChange hooks (per field)
 */
import type {
  ClientCollectionHook,
  ClientCollectionHookArgs,
  ClientFieldHook,
  ClientFieldHookArgs,
  ClientHooksConfig,
} from './types'

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

function setByPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const parts = path.split('.')
  const result = { ...obj }
  let current: Record<string, unknown> = result

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    const next = current[part]
    if (typeof next === 'object' && next !== null) {
      current[part] = Array.isArray(next) ? [...next] : { ...next }
    } else {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
  return result
}

function getSiblingData(data: Record<string, unknown>, path: string): Record<string, unknown> {
  const parts = path.split('.')
  if (parts.length <= 1) return data
  const parentPath = parts.slice(0, -1).join('.')
  const parent = getByPath(data, parentPath)
  return (typeof parent === 'object' && parent !== null ? parent : {}) as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Collection-level hooks
// ---------------------------------------------------------------------------

async function runCollectionHooks(
  hooks: ClientCollectionHook[] | undefined,
  args: ClientCollectionHookArgs,
): Promise<Record<string, unknown>> {
  if (!hooks || hooks.length === 0) return args.data

  let data = args.data
  for (const hook of hooks) {
    const result = await hook({ ...args, data })
    if (result && typeof result === 'object') {
      data = result
    }
  }
  return data
}

// ---------------------------------------------------------------------------
// Field-level hooks
// ---------------------------------------------------------------------------

async function runFieldHooks(
  fieldHooks: Record<string, ClientFieldHook[] | undefined>,
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | undefined,
  operation: 'create' | 'update' | 'read',
): Promise<Record<string, unknown>> {
  let result = data

  for (const [fieldPath, hooks] of Object.entries(fieldHooks)) {
    if (!hooks || hooks.length === 0) continue

    let value = getByPath(result, fieldPath)
    const previousValue = originalDoc ? getByPath(originalDoc, fieldPath) : undefined
    const siblingData = getSiblingData(result, fieldPath)

    for (const hook of hooks) {
      const hookArgs: ClientFieldHookArgs = {
        value,
        previousValue,
        data: result,
        siblingData,
        operation,
        fieldPath,
      }
      const hookResult = await hook(hookArgs)
      if (hookResult !== undefined) {
        value = hookResult
      }
    }

    // Write the transformed value back
    result = setByPath(result, fieldPath, value)
  }

  return result
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run beforeValidate hooks (collection-level, then field-level).
 * Returns the (possibly transformed) document data.
 */
export async function runBeforeValidateHooks(
  config: ClientHooksConfig | undefined,
  slug: string,
  data: Record<string, unknown>,
  originalDoc?: Record<string, unknown>,
  operation?: 'create' | 'update',
): Promise<Record<string, unknown>> {
  if (!config) return data

  const collConfig = config.collections[slug]
  if (!collConfig) return data

  const op = operation ?? 'update'

  // 1. Collection-level beforeValidate
  let result = await runCollectionHooks(collConfig.hooks?.beforeValidate, {
    data,
    originalDoc,
    operation: op,
    collectionSlug: slug,
  })

  // 2. Field-level beforeValidate
  const fieldBeforeValidate: Record<string, ClientFieldHook[]> = {}
  if (collConfig.fields) {
    for (const [fieldPath, fieldConf] of Object.entries(collConfig.fields)) {
      if (fieldConf.hooks?.beforeValidate) {
        fieldBeforeValidate[fieldPath] = fieldConf.hooks.beforeValidate
      }
    }
  }
  result = await runFieldHooks(fieldBeforeValidate, result, originalDoc, op)

  return result
}

/**
 * Run beforeChange hooks (collection-level, then field-level).
 * Returns the (possibly transformed) document data.
 */
export async function runBeforeChangeHooks(
  config: ClientHooksConfig | undefined,
  slug: string,
  data: Record<string, unknown>,
  originalDoc?: Record<string, unknown>,
  operation?: 'create' | 'update',
): Promise<Record<string, unknown>> {
  if (!config) return data

  const collConfig = config.collections[slug]
  if (!collConfig) return data

  const op = operation ?? 'update'

  // 1. Collection-level beforeChange
  let result = await runCollectionHooks(collConfig.hooks?.beforeChange, {
    data,
    originalDoc,
    operation: op,
    collectionSlug: slug,
  })

  // 2. Field-level beforeChange
  const fieldBeforeChange: Record<string, ClientFieldHook[]> = {}
  if (collConfig.fields) {
    for (const [fieldPath, fieldConf] of Object.entries(collConfig.fields)) {
      if (fieldConf.hooks?.beforeChange) {
        fieldBeforeChange[fieldPath] = fieldConf.hooks.beforeChange
      }
    }
  }
  result = await runFieldHooks(fieldBeforeChange, result, originalDoc, op)

  return result
}

/**
 * Run afterChange hooks (collection-level, then field-level).
 * Returns the (possibly transformed) document data.
 * Typically used for side effects (e.g. analytics, notifications).
 */
export async function runAfterChangeHooks(
  config: ClientHooksConfig | undefined,
  slug: string,
  data: Record<string, unknown>,
  originalDoc?: Record<string, unknown>,
  operation?: 'create' | 'update',
): Promise<Record<string, unknown>> {
  if (!config) return data

  const collConfig = config.collections[slug]
  if (!collConfig) return data

  const op = operation ?? 'update'

  // 1. Collection-level afterChange
  let result = await runCollectionHooks(collConfig.hooks?.afterChange, {
    data,
    originalDoc,
    operation: op,
    collectionSlug: slug,
  })

  // 2. Field-level afterChange
  const fieldAfterChange: Record<string, ClientFieldHook[]> = {}
  if (collConfig.fields) {
    for (const [fieldPath, fieldConf] of Object.entries(collConfig.fields)) {
      if (fieldConf.hooks?.afterChange) {
        fieldAfterChange[fieldPath] = fieldConf.hooks.afterChange
      }
    }
  }
  result = await runFieldHooks(fieldAfterChange, result, originalDoc, op)

  return result
}

/**
 * Run afterRead hooks (field-level only — no collection-level afterRead in this implementation).
 * Returns the (possibly transformed) document data.
 * Used to transform data after reading from the local DB.
 */
export async function runAfterReadHooks(
  config: ClientHooksConfig | undefined,
  slug: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!config) return data

  const collConfig = config.collections[slug]
  if (!collConfig?.fields) return data

  const fieldAfterRead: Record<string, ClientFieldHook[]> = {}
  for (const [fieldPath, fieldConf] of Object.entries(collConfig.fields)) {
    if (fieldConf.hooks?.afterRead) {
      fieldAfterRead[fieldPath] = fieldConf.hooks.afterRead
    }
  }

  return runFieldHooks(fieldAfterRead, data, undefined, 'read')
}
