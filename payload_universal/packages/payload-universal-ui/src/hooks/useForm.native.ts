/**
 * useForm — Native implementation.
 *
 * Wraps admin-native's usePayloadFormContext to match
 * the @payloadcms/ui useForm return signature.
 */
import { usePayloadFormContext } from '@payload-universal/admin-native/form'

export type UseFormReturn = {
  submit: () => Promise<void>
  getData: () => Record<string, unknown>
  setModified: (modified: boolean) => void
  formState: {
    isSubmitting: boolean
    isSubmitted: boolean
    isDirty: boolean
  }
}

export function useForm(): UseFormReturn {
  const formContext = usePayloadFormContext()

  if (!formContext) {
    return {
      submit: async () => {},
      getData: () => ({}),
      setModified: () => {},
      formState: {
        isSubmitting: false,
        isSubmitted: false,
        isDirty: false,
      },
    }
  }

  const { handleSubmit, getValues, formState } = formContext

  return {
    submit: async () => {
      await handleSubmit((data: Record<string, unknown>) => data)()
    },
    getData: () => getValues(),
    setModified: () => {},
    formState: {
      isSubmitting: formState.isSubmitting,
      isSubmitted: formState.isSubmitted,
      isDirty: formState.isDirty,
    },
  }
}
