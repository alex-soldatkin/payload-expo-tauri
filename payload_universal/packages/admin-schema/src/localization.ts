import type { SanitizedConfig } from 'payload'

import type { AdminLocale, AdminLocalization } from './types'

/** Extract a serializable localization config from the sanitized config. */
export const buildLocalization = (config: SanitizedConfig): AdminLocalization => {
  const localization = config.localization
  if (!localization) {
    return false
  }

  const locales: AdminLocale[] = (localization.locales ?? []).map((locale) => {
    if (typeof locale === 'string') {
      return { code: locale }
    }
    const label = (locale as { label?: unknown }).label
    return {
      code: locale.code,
      ...(label && typeof label !== 'function'
        ? { label: label as string | Record<string, string> }
        : {}),
      ...(locale.rtl ? { rtl: true } : {}),
      ...(typeof locale.fallbackLocale === 'string'
        ? { fallbackLocale: locale.fallbackLocale }
        : {}),
    }
  })

  return {
    locales,
    defaultLocale: localization.defaultLocale,
    ...(typeof (localization as { fallback?: boolean }).fallback === 'boolean'
      ? { fallback: (localization as { fallback?: boolean }).fallback }
      : {}),
  }
}
