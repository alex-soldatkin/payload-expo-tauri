/**
 * useTranslation — Native implementation.
 *
 * Minimal shim that provides a translation function and i18n object.
 * Returns the key as-is for now (expandable with full i18n later).
 */

export type UseTranslationReturn = {
  t: (key: string, options?: Record<string, unknown>) => string
  i18n: { language: string }
}

export function useTranslation(): UseTranslationReturn {
  return {
    t: (key: string) => {
      // Strip namespace prefix if present (e.g. 'general:save' -> 'save')
      const parts = key.split(':')
      return parts[parts.length - 1]
    },
    i18n: { language: 'en' },
  }
}

/**
 * getTranslation — matches @payloadcms/translations.
 *
 * Resolves a label that may be a string or a Record<language, string>.
 */
export function getTranslation(
  label: string | Record<string, string> | undefined,
  i18n?: { language: string },
): string {
  if (!label) return ''
  if (typeof label === 'string') return label
  const lang = i18n?.language ?? 'en'
  return label[lang] ?? label.en ?? Object.values(label)[0] ?? ''
}
