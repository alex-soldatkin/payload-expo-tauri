/**
 * useValidatedMutations — drop-in replacement for useLocalMutations that
 * adds client-side validation and hooks BEFORE writing to the local DB.
 *
 * Execution order for create/update:
 *   1. beforeValidate hooks (collection + field)
 *   2. Schema-driven validation (built-in + custom validators)
 *   3. If errors → return immediately, do NOT write to DB
 *   4. beforeChange hooks (collection + field)
 *   5. Write to local RxDB (optimistic, instant)
 *   6. afterChange hooks (collection + field)
 *
 * For remove: delegates directly to useLocalMutations (no validation needed).
 */
import { useCallback, useMemo, useState } from 'react'

import {
  runValidation,
  runBeforeValidateHooks,
  runBeforeChangeHooks,
  runAfterChangeHooks,
} from '@payload-universal/client-validators'
import type { ClientHooksConfig, ValidationErrors } from '@payload-universal/client-validators'

import { useLocalMutations } from './hooks'
import { useClientValidatorConfig } from '../contexts/ClientValidatorContext'
import type { PayloadLocalDB } from '../database'

// ---------------------------------------------------------------------------
// AnyField shape (minimal to avoid importing admin-native types)
// ---------------------------------------------------------------------------

type AnyField = {
  name?: string
  type: string
  required?: boolean
  admin?: { hidden?: boolean; readOnly?: boolean; [k: string]: unknown }
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  minRows?: number
  maxRows?: number
  hasMany?: boolean
  options?: Array<{ label?: string; value: string } | string>
  fields?: AnyField[]
  tabs?: Array<{ name?: string; fields?: AnyField[]; [k: string]: unknown }>
  blocks?: Array<{ slug: string; fields?: AnyField[]; [k: string]: unknown }>
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type ValidatedMutationSuccess = { success: true; id?: string }
export type ValidatedMutationFailure = { success: false; errors: ValidationErrors }
export type ValidatedMutationResult = ValidatedMutationSuccess | ValidatedMutationFailure

export type UseValidatedMutationsResult = {
  /**
   * Insert a new document. Runs hooks + validation before writing.
   * Returns `{ success: true, id }` or `{ success: false, errors }`.
   */
  create: (data: Record<string, unknown>) => Promise<ValidatedMutationResult>
  /**
   * Update a document. Runs hooks + validation before writing.
   * Returns `{ success: true }` or `{ success: false, errors }`.
   */
  update: (id: string, data: Record<string, unknown>, originalDoc?: Record<string, unknown>) => Promise<ValidatedMutationResult>
  /**
   * Soft-delete a document. No validation needed.
   */
  remove: (id: string) => Promise<void>
  /** Current validation errors (cleared on next successful mutation). */
  errors: ValidationErrors
  /** Manually clear validation errors (e.g. when user edits a field). */
  clearErrors: () => void
  /** Clear a single field's error. */
  clearFieldError: (fieldPath: string) => void
}

/**
 * Validated mutations hook.
 *
 * @param localDB - The local RxDB database instance.
 * @param slug - The collection slug.
 * @param fields - The root-level client field definitions from the admin schema.
 *                 Used to drive built-in validation (required, min, max, etc.).
 * @param hooksConfigOverride - Optional override for the hooks config.
 *                              If not provided, reads from ClientValidatorProvider context.
 */
export function useValidatedMutations(
  localDB: PayloadLocalDB | null,
  slug: string,
  fields?: AnyField[],
  hooksConfigOverride?: ClientHooksConfig,
): UseValidatedMutationsResult {
  const contextConfig = useClientValidatorConfig()
  const hooksConfig = hooksConfigOverride ?? contextConfig ?? undefined

  const { create: rawCreate, update: rawUpdate, remove } = useLocalMutations(localDB, slug)

  const [errors, setErrors] = useState<ValidationErrors>({})

  const clearErrors = useCallback(() => setErrors({}), [])

  const clearFieldError = useCallback((fieldPath: string) => {
    setErrors((prev) => {
      if (!prev[fieldPath]) return prev
      const next = { ...prev }
      delete next[fieldPath]
      return next
    })
  }, [])

  const create = useCallback(
    async (data: Record<string, unknown>): Promise<ValidatedMutationResult> => {
      // Clear previous errors
      setErrors({})

      try {
        // 1. beforeValidate hooks
        let processedData = await runBeforeValidateHooks(hooksConfig, slug, data, undefined, 'create')

        // 2. Validation
        if (fields && fields.length > 0) {
          const result = await runValidation(fields, processedData, slug, hooksConfig, 'create')
          if (!result.valid) {
            setErrors(result.errors)
            return { success: false, errors: result.errors }
          }
        }

        // 3. beforeChange hooks
        processedData = await runBeforeChangeHooks(hooksConfig, slug, processedData, undefined, 'create')

        // 4. Write to local DB
        const id = await rawCreate(processedData)

        // 5. afterChange hooks (fire-and-forget, don't block the UI)
        runAfterChangeHooks(hooksConfig, slug, { ...processedData, id }, undefined, 'create').catch(() => {
          // afterChange hooks are best-effort
        })

        return { success: true, id }
      } catch (err) {
        // Unexpected error (DB not ready, etc.)
        const message = err instanceof Error ? err.message : 'Create failed'
        setErrors({ _form: message })
        return { success: false, errors: { _form: message } }
      }
    },
    [rawCreate, fields, slug, hooksConfig],
  )

  const update = useCallback(
    async (
      id: string,
      data: Record<string, unknown>,
      originalDoc?: Record<string, unknown>,
    ): Promise<ValidatedMutationResult> => {
      setErrors({})

      try {
        // 1. beforeValidate hooks
        let processedData = await runBeforeValidateHooks(hooksConfig, slug, data, originalDoc, 'update')

        // 2. Validation
        if (fields && fields.length > 0) {
          const result = await runValidation(fields, processedData, slug, hooksConfig, 'update')
          if (!result.valid) {
            setErrors(result.errors)
            return { success: false, errors: result.errors }
          }
        }

        // 3. beforeChange hooks
        processedData = await runBeforeChangeHooks(hooksConfig, slug, processedData, originalDoc, 'update')

        // 4. Write to local DB
        await rawUpdate(id, processedData)

        // 5. afterChange hooks
        runAfterChangeHooks(hooksConfig, slug, { ...processedData, id }, originalDoc, 'update').catch(() => {
          // afterChange hooks are best-effort
        })

        return { success: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Update failed'
        setErrors({ _form: message })
        return { success: false, errors: { _form: message } }
      }
    },
    [rawUpdate, fields, slug, hooksConfig],
  )

  return useMemo(
    () => ({ create, update, remove, errors, clearErrors, clearFieldError }),
    [create, update, remove, errors, clearErrors, clearFieldError],
  )
}
