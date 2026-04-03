/**
 * useField — Native implementation.
 *
 * Wraps admin-native's usePayloadField (RHF useController) to match
 * the @payloadcms/ui useField return signature.
 *
 * Data flow (local-first):
 *   useField('title')
 *     → usePayloadField({ control, name: 'title' })
 *       → RHF useController → reads from form state
 *         → form was initialized from useLocalDocument (RxDB/SQLite)
 *     → onChange → RHF dirty tracking
 *       → on submit → useValidatedMutations → write to local RxDB
 *         → replication pushes to server in background
 */
import { usePayloadField, usePayloadFormContext } from '@payload-universal/admin-native/form'

export type UseFieldOptions = {
  path: string
  hasMany?: boolean
  validate?: (value: unknown) => string | true | Promise<string | true>
}

export type UseFieldReturn<T = unknown> = {
  value: T
  setValue: (value: T) => void
  errorMessage: string | undefined
  showError: boolean
  formSubmitted: boolean
  formProcessing: boolean
  path: string
}

export function useField<T = unknown>(options: UseFieldOptions): UseFieldReturn<T> {
  const { path } = options
  const formContext = usePayloadFormContext()

  if (!formContext) {
    // No RHF form context — return inert state
    return {
      value: undefined as T,
      setValue: () => {},
      errorMessage: undefined,
      showError: false,
      formSubmitted: false,
      formProcessing: false,
      path,
    }
  }

  const { control, formState } = formContext
  const fieldState = usePayloadField({ control, name: path })

  if (!fieldState) {
    return {
      value: undefined as T,
      setValue: () => {},
      errorMessage: undefined,
      showError: false,
      formSubmitted: false,
      formProcessing: false,
      path,
    }
  }

  return {
    value: fieldState.value as T,
    setValue: (v: T) => fieldState.onChange(v),
    errorMessage: fieldState.error,
    showError: !!fieldState.error,
    formSubmitted: formState?.isSubmitted ?? false,
    formProcessing: formState?.isSubmitting ?? false,
    path,
  }
}
