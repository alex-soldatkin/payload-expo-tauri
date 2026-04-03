/**
 * Phase 2 & 3 — React Hook Form integration for Payload forms.
 *
 * Provides `usePayloadForm` which wraps react-hook-form's `useForm` with:
 *   - Zod resolver built from the Payload field schema
 *   - Client-side validation before submit
 *   - Server error mapping back to individual fields
 *   - Dirty tracking, isDirty, dirtyFields
 *
 * And `usePayloadField` (Phase 3) — a thin wrapper around `useController`
 * that preserves the existing `{ value, onChange, error }` interface.
 *
 * react-hook-form is optional — if not installed, the exports are no-ops
 * and the DocumentForm falls back to its useState-based approach.
 */

import React, { useCallback, useMemo, useState } from 'react'
import type { ClientField, FormErrors } from './types'
import { payloadFieldsToZod } from './validation'

// ---------------------------------------------------------------------------
// Lazy RHF import — the package is optional
// ---------------------------------------------------------------------------

let _useForm: any = null
let _useController: any = null
let _useFormContext: any = null
let _FormProvider: any = null
let _rhfAvailable = false

try {
  const rhf = require('react-hook-form')
  _useForm = rhf.useForm
  _useController = rhf.useController
  _useFormContext = rhf.useFormContext
  _FormProvider = rhf.FormProvider
  _rhfAvailable = true
} catch {
  /* react-hook-form not installed — all exports will be no-ops */
}

/** Whether react-hook-form is available at runtime. */
export const isRHFAvailable = _rhfAvailable

/** Re-export FormProvider for wrapping the form tree. */
export const FormProvider: React.ComponentType<any> | null = _FormProvider

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PayloadFormConfig = {
  /** Root fields from the admin schema. */
  fields: ClientField[]
  /** Initial document data. */
  defaultValues?: Record<string, unknown>
  /** Called on valid submit. */
  onSubmit: (data: Record<string, unknown>, options?: { status?: 'draft' | 'published' }) => Promise<void>
  /** Whether to validate on change (default: false — only on submit). */
  validateOnChange?: boolean
}

export type PayloadFormReturn = {
  /** RHF control object — pass to usePayloadField or Controller. */
  control: any
  /** RHF methods (register, handleSubmit, etc.) */
  methods: any
  /** Submit the form (with optional status override). */
  submit: (statusOverride?: 'draft' | 'published') => Promise<void>
  /** Current form data snapshot. */
  getFormData: () => Record<string, unknown>
  /** Whether the form has been modified. */
  isDirty: boolean
  /** Map of field paths that have been modified. */
  dirtyFields: Record<string, boolean | object>
  /** Whether a submission is in progress. */
  isSubmitting: boolean
  /** Server validation errors mapped to field paths. */
  serverErrors: FormErrors
  /** Set external errors from the server. */
  setServerErrors: (errors: FormErrors) => void
  /** Clear a specific server error (e.g. when user edits a field). */
  clearServerError: (path: string) => void
  /** Whether RHF is driving the form. */
  isRHF: true
}

export type PayloadFormFallback = {
  isRHF: false
}

// ---------------------------------------------------------------------------
// usePayloadForm — Phase 2
// ---------------------------------------------------------------------------

/**
 * Hook that creates a react-hook-form instance configured for Payload schemas.
 *
 * Returns an RHF-aware form controller if react-hook-form is installed,
 * otherwise returns `{ isRHF: false }` so the caller can fall back.
 */
export const usePayloadForm = (config: PayloadFormConfig): PayloadFormReturn | PayloadFormFallback => {
  if (!_rhfAvailable || !_useForm) {
    return { isRHF: false }
  }

  const { fields, defaultValues = {}, onSubmit, validateOnChange = false } = config

  // Build Zod schema from Payload fields (memoized by fields reference)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const zodSchema = useMemo(() => payloadFieldsToZod(fields), [fields])

  // Custom resolver that uses our Zod schema
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const resolver = useCallback(async (data: Record<string, unknown>) => {
    const result = zodSchema.safeParse(data)
    if (result.success) {
      return { values: result.data, errors: {} }
    }
    const errors: Record<string, any> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.')
      if (path && !errors[path]) {
        errors[path] = { type: 'validation', message: issue.message }
      }
    }
    return { values: {}, errors }
  }, [zodSchema])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const methods = _useForm({
    defaultValues,
    resolver,
    mode: validateOnChange ? 'onChange' : 'onSubmit',
    reValidateMode: 'onChange',
  })

  const { control, handleSubmit: rhfHandleSubmit, formState, getValues, setError, clearErrors } = methods

  // Server-side errors (from Payload API validation responses)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [serverErrors, setServerErrorsState] = useState<FormErrors>({})

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const setServerErrors = useCallback((errors: FormErrors) => {
    setServerErrorsState(errors)
    // Also inject into RHF's error state so fields see them via useController
    for (const [path, message] of Object.entries(errors)) {
      if (message) {
        setError(path, { type: 'server', message })
      }
    }
  }, [setError])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const clearServerError = useCallback((path: string) => {
    setServerErrorsState((prev: FormErrors) => {
      if (!prev[path]) return prev
      const next = { ...prev }
      delete next[path]
      return next
    })
    clearErrors(path)
  }, [clearErrors])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const submit = useCallback(async (statusOverride?: 'draft' | 'published') => {
    // Use RHF's handleSubmit which runs validation first
    await rhfHandleSubmit(async (data: Record<string, unknown>) => {
      const opts = statusOverride ? { status: statusOverride } : undefined
      await onSubmit(data, opts)
    })()
  }, [rhfHandleSubmit, onSubmit])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const getFormData = useCallback(() => getValues(), [getValues])

  return {
    control,
    methods,
    submit,
    getFormData,
    isDirty: formState.isDirty,
    dirtyFields: formState.dirtyFields,
    isSubmitting: formState.isSubmitting,
    serverErrors,
    setServerErrors,
    clearServerError,
    isRHF: true,
  }
}

// ---------------------------------------------------------------------------
// usePayloadField — Phase 3
// ---------------------------------------------------------------------------

export type PayloadFieldProps = {
  /** RHF control object (from usePayloadForm or useFormContext). */
  control: any
  /** Dot-path field name (e.g. 'title', 'gallery.images.0.caption'). */
  name: string
  /** Default value for the field. */
  defaultValue?: unknown
}

export type PayloadFieldReturn = {
  /** Current field value. */
  value: unknown
  /** Change handler — call with the new value. */
  onChange: (value: unknown) => void
  /** Blur handler — marks the field as touched. */
  onBlur: () => void
  /** Validation error message (client or server). */
  error: string | undefined
  /** Whether the field has been modified since form load. */
  isDirty: boolean
  /** Whether the field has been touched (blurred). */
  isTouched: boolean
  /** Ref for the input element. */
  ref: any
}

/**
 * Hook for individual field components (Phase 3).
 *
 * Wraps react-hook-form's `useController` to provide the same
 * `{ value, onChange, error }` interface that field components
 * already expect — zero API change for consumers.
 *
 * Returns null if RHF is not available.
 */
export const usePayloadField = (props: PayloadFieldProps): PayloadFieldReturn | null => {
  if (!_rhfAvailable || !_useController) return null

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { field, fieldState } = _useController({
    control: props.control,
    name: props.name,
    defaultValue: props.defaultValue,
  })

  return {
    value: field.value,
    onChange: field.onChange,
    onBlur: field.onBlur,
    error: fieldState.error?.message,
    isDirty: fieldState.isDirty,
    isTouched: fieldState.isTouched,
    ref: field.ref,
  }
}

/**
 * Get the RHF form context (if inside a FormProvider).
 * Returns null if RHF is not available.
 */
export const usePayloadFormContext = (): any | null => {
  if (!_rhfAvailable || !_useFormContext) return null
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return _useFormContext()
}
