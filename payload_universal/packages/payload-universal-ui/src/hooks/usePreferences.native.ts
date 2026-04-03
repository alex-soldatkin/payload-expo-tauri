/**
 * usePreferences — Native implementation.
 *
 * Wraps AsyncStorage for user preferences, matching @payloadcms/ui API.
 */
let AsyncStorage: any = null
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default
} catch {
  /* not available */
}

export type UsePreferencesReturn = {
  getPreference: <T = unknown>(key: string) => Promise<T | null>
  setPreference: (key: string, value: unknown) => Promise<void>
}

export function usePreferences(): UsePreferencesReturn {
  return {
    getPreference: async <T = unknown>(key: string): Promise<T | null> => {
      if (!AsyncStorage) return null
      try {
        const raw = await AsyncStorage.getItem(`payload_pref_${key}`)
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    },
    setPreference: async (key: string, value: unknown): Promise<void> => {
      if (!AsyncStorage) return
      try {
        await AsyncStorage.setItem(`payload_pref_${key}`, JSON.stringify(value))
      } catch {
        /* ignore */
      }
    },
  }
}
