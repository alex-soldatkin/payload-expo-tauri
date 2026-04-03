import { useCallback, useMemo } from 'react'

import {
  useAdminSchema,
  useAuth as useNativeAuth,
  usePayloadFormContext,
  usePayloadField,
  useFormData,
  usePayloadNative,
} from '@payload-universal/admin-native'

// 1. useField
export function useField<Value = any>(props: { path: string }) {
  const fieldProps = usePayloadField({ name: props.path })
  return {
    value: fieldProps?.value as Value,
    setValue: fieldProps?.onChange,
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
    id: formData?.id,
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
