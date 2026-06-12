import { useCallback, useMemo } from 'react'

import {
  useAdminSchema,
  useAuth as useNativeAuth,
  usePayloadFormContext,
  usePayloadField,
  useFormData,
  usePayloadNative,
  useRowLabelContext,
} from '@payload-universal/admin-native'

// 1. useField
export function useField<Value = any>(props: { path: string }) {
  // usePayloadField requires the RHF control — resolve it from the enclosing
  // form context (DocumentForm's FormProvider). RHF's useController falls
  // back to context when control is undefined, so this stays safe in-form.
  const formContext = usePayloadFormContext()
  const fieldProps = usePayloadField({ control: formContext?.control, name: props.path })
  return {
    value: fieldProps?.value as Value,
    // Always-callable: generated custom components invoke setValue
    // unconditionally (web @payloadcms/ui parity, where setValue is never
    // undefined). No-op outside a form context instead of throwing.
    setValue: (fieldProps?.onChange ?? (() => {})) as (value: unknown) => void,
    errorMessage: fieldProps?.error,
    showError: !!fieldProps?.error,
    initialValue: undefined, // Add if needed
  }
}

// 2. useForm
export function useForm() {
  const context = usePayloadFormContext()
  return {
    submit: context?.submit,
    getData: context?.getValues,
    setModified: context?.setModified, 
  }
}

// 3. useAuth
export function useAuth() {
  const { user } = useNativeAuth()
  // Minimal permissions shim
  return { user, permissions: {} }
}

// 4. useConfig
export function useConfig() {
  const adminSchema = useAdminSchema()
  return {
    config: (adminSchema?.clientConfig || { 
      routes: { api: '/api', admin: '/admin' },
      collections: [],
      globals: [],
      admin: { routes: { browseByFolder: '/folders' } }
    }) as any,
  }
}

// 5. useDocumentInfo
export function useDocumentInfo() {
  const { slug, formData } = useFormData() || {}
  const { auth } = usePayloadNative()
  return {
    collectionSlug: slug,
    globalSlug: undefined,
    // Web parity: @payloadcms/ui types id as number | string (not unknown) —
    // keeps `{id && <Text/>}` a valid ReactNode in custom components.
    id: formData?.id as string | number | undefined,
    preferencesKey: `document-${slug}-${formData?.id}`,
  }
}

// 6. useTranslation
export function useTranslation() {
  const t = useCallback((key: string, options?: any) => {
    // Basic shim: just return the key or the English fallback if it's an object
    return key
  }, [])
  return { t, i18n: { language: 'en' } }
}

// 7. useLocale
export function useLocale() {
  return { code: 'en' }
}

// 8. usePreferences
export function usePreferences() {
  // Simplistic shim, in a real scenario wrap AsyncStorage
  const getPreference = async (key: string) => null
  const setPreference = async (key: string, value: any) => {}
  return { getPreference, setPreference }
}

// 9. useEntityVisibility
export function useEntityVisibility() {
  return {
    visibleEntities: {
      collections: [] as string[],
      globals: [] as string[]
    }
  }
}

// 10. useRowLabel — reads admin-native's RowLabelContext (provided by
// ArrayField around custom RowLabel components from the codegen registry).
// Web parity (@payloadcms/ui): `rowNumber` is the 0-BASED row index —
// ArrayRow/BlockRow pass `rowNumber={rowIndex}`, and consumers render
// `rowNumber + 1` for display. admin-native's context carries a 1-based
// `rowNumber` plus a 0-based `index`; we expose `index` here to match.
// Outside a row the web context defaults to {data:{}, path:'', rowNumber:
// undefined} — mirrored so the hook is safe to call unconditionally.
export type UseRowLabelReturn<T = unknown> = {
  data: T
  path: string
  rowNumber: number | undefined
}

export function useRowLabel<T = unknown>(): UseRowLabelReturn<T> {
  const ctx = useRowLabelContext()
  if (!ctx) return { data: {} as T, path: '', rowNumber: undefined }
  return { data: ctx.data as T, path: ctx.path, rowNumber: ctx.index }
}
