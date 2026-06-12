/**
 * Global edit screen – renders the DocumentForm for a global's fields.
 *
 * Localization (web admin Localizer parity): when the schema has
 * localization configured, a globe toolbar menu switches the active locale.
 * The DEFAULT locale uses the existing payloadApi load/save path; a
 * NON-default locale loads via REST ?locale=X&fallback-locale=none and
 * saves via REST with ?locale=X (whole-doc write — correct Payload
 * semantics), showing a subtle "es · online" pill near the title.
 */
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Text, useColorScheme, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'

import {
  DocumentForm,
  getGlobalLabel,
  payloadApi,
  useAdminSchema,
  useMenuModel,
  usePayloadNative,
} from '@payload-universal/admin-native'
import { useLocaleEditing } from '@/src/hooks/useLocaleEditing'

// Stable fallback when the global has no data yet. An inline `?? {}` creates
// a NEW object identity on EVERY render — DocumentForm consumes initialData
// via react-hook-form, and unstable identities there can re-trigger state in
// any consumer keyed on it (see the details-sheet 'Maximum update depth
// exceeded' loop, 2026-06-11). Module scope keeps the reference stable.
const EMPTY_DOC: Record<string, unknown> = {}

/** Resolve a locale label that may be a string or an i18n record. */
const localeLabel = (locale: { code: string; label?: string | Record<string, string> }): string => {
  if (typeof locale.label === 'string') return locale.label
  if (locale.label && typeof locale.label === 'object') {
    return locale.label.en ?? Object.values(locale.label)[0] ?? locale.code
  }
  return locale.code
}

export default function GlobalEditScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const headerHeight = useHeaderHeight()
  const { baseURL, auth } = usePayloadNative()
  const schema = useAdminSchema()
  const menuModel = useMenuModel()
  const isDark = useColorScheme() === 'dark'

  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const label = menuModel ? getGlobalLabel(menuModel, slug) : slug
  const schemaMap = schema?.globals[slug]

  // ── Localization ────────────────────────────────────────────────────
  const localization =
    typeof schema?.localization === 'object' ? schema.localization : null
  const {
    activeLocale,
    setActiveLocale,
    isDefaultLocale,
    remoteDoc,
    remoteLoading,
    remoteError,
    saveRemote,
  } = useLocaleEditing({
    enabled: !!localization,
    baseURL,
    token: auth.token,
    slug,
    isGlobal: true,
    defaultLocale: localization?.defaultLocale ?? '',
  })

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const result = await payloadApi.findGlobal({ baseURL, token: auth.token }, slug)
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load global')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [baseURL, auth.token, slug])

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (!isDefaultLocale) {
      await saveRemote(formData)
      Alert.alert('Saved', `${label} (${activeLocale}) updated successfully.`)
      return
    }
    await payloadApi.updateGlobal({ baseURL, token: auth.token }, slug, formData)
    // Refresh
    const updated = await payloadApi.findGlobal({ baseURL, token: auth.token }, slug)
    setData(updated)
    Alert.alert('Saved', `${label} updated successfully.`)
  }

  // Active document for the form: default locale → payloadApi result,
  // non-default → server doc for that locale.
  const formDoc = isDefaultLocale ? data : remoteDoc

  if (loading || (!isDefaultLocale && remoteLoading && !remoteDoc)) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ title: label }} />
        <ActivityIndicator size="large" />
      </View>
    )
  }

  const screenError = error || (!isDefaultLocale ? remoteError : null)
  if (screenError || !schemaMap) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6">
        <Stack.Screen options={{ title: label }} />
        <Text className="text-base text-red-600">{screenError || 'Schema not available'}</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen options={{ title: label }} />

      {/* Locale switcher (Localizer parity) — native toolbar menu on iOS */}
      {Platform.OS === 'ios' && localization && (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="globe" title="Locale">
            {localization.locales.map((l) => (
              <Stack.Toolbar.MenuAction
                key={l.code}
                isOn={activeLocale === l.code}
                onPress={() => setActiveLocale(l.code)}
              >
                {localeLabel(l)}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      )}

      <DocumentForm
        // Remount when the locale changes so initialData re-seeds the form
        key={`${slug}:${activeLocale || 'default'}`}
        schemaMap={schemaMap}
        slug={slug}
        initialData={formDoc ?? EMPTY_DOC}
        onSubmit={handleSubmit}
        submitLabel="Save"
        contentInsetTop={headerHeight}
      />

      {/* Subtle "es · online" pill while editing a non-default locale */}
      {!isDefaultLocale && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: headerHeight + 6,
            right: 16,
            zIndex: 20,
          }}
        >
          <View
            style={{
              backgroundColor: isDark ? 'rgba(10,132,255,0.28)' : 'rgba(0,122,255,0.12)',
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#6db2ff' : '#0a66c2' }}>
              {activeLocale} · online
            </Text>
          </View>
        </View>
      )}
    </View>
  )
}
