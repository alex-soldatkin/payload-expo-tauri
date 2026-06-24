import { Stack } from 'expo-router'

/** Resolve a locale label that may be a string or an i18n record. */
export const localeLabel = (locale: { code: string; label?: string | Record<string, string> }): string => {
  if (typeof locale.label === 'string') return locale.label
  if (locale.label && typeof locale.label === 'object') {
    return locale.label.en ?? Object.values(locale.label)[0] ?? locale.code
  }
  return locale.code
}

export const formatTime = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/**
 * Stack.Toolbar is an experimental expo-router API (unstable_headerRightItems
 * → react-native-screens bar button items). Guard at runtime so the screen
 * falls back to the always-available `headerRight` path when the API is
 * missing (older expo-router) instead of silently rendering no save button.
 */
export const hasStackToolbar =
  typeof (Stack as { Toolbar?: unknown }).Toolbar === 'function' &&
  Boolean((Stack as { Toolbar?: { Button?: unknown } }).Toolbar?.Button)
