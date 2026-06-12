/**
 * App-level user preferences — appearance (color scheme) and admin language.
 *
 * Persisted in AsyncStorage and applied on boot from app/_layout.tsx.
 * The Account screen renders the pickers that write these values.
 *
 * NOTE on admin language: the app has no i18n/getTranslation pipeline yet —
 * the value is persisted for future use (and so the schema endpoint could be
 * re-fetched with ?language=). When i18n lands, read it via
 * `getStoredAdminLanguage()`.
 */
import { colorScheme } from 'nativewind'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const APPEARANCE_KEY = 'app_appearance'
export const ADMIN_LANGUAGE_KEY = 'admin_language'

export type AppearancePreference = 'system' | 'light' | 'dark'
export type AdminLanguage = 'en' | 'es'

export const APPEARANCE_OPTIONS: AppearancePreference[] = ['system', 'light', 'dark']
export const ADMIN_LANGUAGE_OPTIONS: AdminLanguage[] = ['en', 'es']

/** Apply a color-scheme preference to the running app. */
export const applyAppearance = (pref: AppearancePreference): void => {
  // NativeWind's colorScheme.set accepts 'system' | 'light' | 'dark' and
  // proxies to RN Appearance.setColorScheme (null for 'system'). Driving it
  // through NativeWind keeps a single switch for BOTH theming systems:
  //  - RN useColorScheme() → useListColors palettes + ThemeVarsProvider
  //    (the runtime source of the bg-paper/text-ink/… Tailwind tokens)
  //  - css-interop's internal observable used by dark: variants
  colorScheme.set(pref)
}

/** Persist + apply an appearance preference. */
export const setAppearancePreference = async (pref: AppearancePreference): Promise<void> => {
  applyAppearance(pref)
  try {
    await AsyncStorage.setItem(APPEARANCE_KEY, pref)
  } catch {
    /* persistence is best-effort */
  }
}

/** Read the stored appearance preference (defaults to 'system'). */
export const getStoredAppearance = async (): Promise<AppearancePreference> => {
  try {
    const val = await AsyncStorage.getItem(APPEARANCE_KEY)
    if (val === 'light' || val === 'dark' || val === 'system') return val
  } catch {
    /* ignore */
  }
  return 'system'
}

/** Apply the persisted appearance on app boot. */
export const applyStoredAppearance = async (): Promise<void> => {
  applyAppearance(await getStoredAppearance())
}

/** Persist the admin language preference. */
export const setAdminLanguage = async (lang: AdminLanguage): Promise<void> => {
  try {
    await AsyncStorage.setItem(ADMIN_LANGUAGE_KEY, lang)
  } catch {
    /* best-effort */
  }
}

/** Read the stored admin language (defaults to 'en'). */
export const getStoredAdminLanguage = async (): Promise<AdminLanguage> => {
  try {
    const val = await AsyncStorage.getItem(ADMIN_LANGUAGE_KEY)
    if (val === 'en' || val === 'es') return val
  } catch {
    /* ignore */
  }
  return 'en'
}
