/**
 * useLocale — Native implementation.
 *
 * Returns the current locale code. Expandable with full i18n later.
 */

export type UseLocaleReturn = {
  code: string
  label: string
}

export function useLocale(): UseLocaleReturn {
  return { code: 'en', label: 'English' }
}
