/**
 * Hooks barrel export — native implementations.
 */
export { useField } from './useField.native'
export type { UseFieldOptions, UseFieldReturn } from './useField.native'

export { useForm } from './useForm.native'
export type { UseFormReturn } from './useForm.native'

export { useAuth } from './useAuth.native'
export type { UseAuthReturn } from './useAuth.native'

export { useConfig } from './useConfig.native'
export type { UseConfigReturn } from './useConfig.native'

export { useDocumentInfo } from './useDocumentInfo.native'
export type { UseDocumentInfoReturn } from './useDocumentInfo.native'

export { useTranslation, getTranslation } from './useTranslation.native'
export type { UseTranslationReturn } from './useTranslation.native'

export { useLocale } from './useLocale.native'
export type { UseLocaleReturn } from './useLocale.native'

export { usePreferences } from './usePreferences.native'
export type { UsePreferencesReturn } from './usePreferences.native'

export { useEntityVisibility } from './useEntityVisibility.native'
export type { UseEntityVisibilityReturn } from './useEntityVisibility.native'

// Stubs for hooks that have no native equivalent yet
export const useOperation = () => ({ operation: 'update' as const })
export const useNav = () => ({ navOpen: false, setNavOpen: () => {} })
export const useEditDepth = () => 0
export const useFormFields = () => ({})
export const useFormSubmitted = () => false
export const useFormProcessing = () => false
export const useFormModified = () => false
