/**
 * API inspector — web admin "API" view parity, presented as a native
 * formSheet (same route pattern as details.tsx).
 *
 *  - REST URL line (tap = Share.share — expo-clipboard is not installed)
 *  - Controls: draft Toggle, depth Stepper (0–10), locale Picker from the
 *    schema's localization config (@expo/ui SwiftUI on iOS, JS fallback
 *    elsewhere)
 *  - Collapsible syntax-tinted JSON tree of fetch(url) with those params
 *    (pure JS, chevron-expandable nodes, monospace, type-colored values)
 *
 * Sections sit in liquid-glass containers (GlassView, guarded) with solid
 * fallbacks; the palette follows the system color scheme.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'

import {
  useAdminSchema,
  useAuth,
  useBaseURL,
  useMenuModel,
} from '@payload-universal/admin-native'

import { JsonNode, darkJson, lightJson } from '@/src/screens/api-inspector/JsonTree'
import { Section } from '@/src/screens/api-inspector/Section'
import {
  MATCH_CONTENTS,
  SHost,
  SPicker,
  SStepper,
  SText,
  SToggle,
  pickerStyleMod,
  tagMod,
} from '@/src/screens/api-inspector/nativeControls'
import { styles } from '@/src/screens/api-inspector/styles'

const renderNullHeaderItem = () => null

/** Fully static — setOptions runs once instead of once per render. */
const SCREEN_OPTIONS = {
  title: 'API',
  headerShown: true,
  headerRight: renderNullHeaderItem,
  headerLeft: renderNullHeaderItem,
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function APIInspectorSheet() {
  const { slug, id } = useLocalSearchParams<{ slug: string; id?: string }>()
  const schema = useAdminSchema()
  const menuModel = useMenuModel()
  const baseURL = useBaseURL()
  const { token } = useAuth()
  const isDark = useColorScheme() === 'dark'
  const jsonPalette = isDark ? darkJson : lightJson

  const collectionMeta = menuModel?.collections.find((c) => c.slug === slug)
  const hasDrafts = collectionMeta?.drafts ?? false

  const localization = useMemo(
    () => (typeof schema?.localization === 'object' ? schema.localization : null),
    [schema],
  )
  const localeCodes = useMemo(
    () => (localization ? localization.locales.map((l) => l.code) : []),
    [localization],
  )
  const hasLocalization = localization != null

  // ── Params ──
  const [draft, setDraft] = useState(false)
  const [depth, setDepth] = useState(1)
  const [locale, setLocale] = useState<string>(localization?.defaultLocale ?? '')

  // STABLE @expo/ui 56: the SwiftUI Stepper is CONTROLLED (value/
  // onValueChange) — the canary's uncontrolled defaultValue/onValueChanged
  // contract (and its onAppear echo-loop workaround) is obsolete. The
  // functional setState below still bails on no-change values, so a native
  // echo of the same value can never re-render.
  const handleDepthChange = useCallback((v: number) => {
    setDepth((prev) => {
      const next = Math.max(0, Math.min(10, Math.round(v)))
      return Number.isFinite(next) ? next : prev
    })
  }, [])

  const handleLocaleChange = useCallback(
    (sel: string | number | null) => {
      if (typeof sel === 'string' && localeCodes.includes(sel)) setLocale(sel)
    },
    [localeCodes],
  )

  // Value-stable native modifier arrays (fresh factory objects every render
  // would re-apply native props on each commit).
  const pickerModifiers = useMemo(
    () => (pickerStyleMod ? [pickerStyleMod('segmented')] : undefined),
    [],
  )
  const localeTagItems = useMemo(
    () => (tagMod ? localeCodes.map((code) => ({ code, mods: [tagMod!(code)] })) : []),
    [localeCodes],
  )

  const url = useMemo(() => {
    const u = new URL(`${baseURL}/api/${slug}/${id ?? ''}`)
    u.searchParams.set('depth', String(depth))
    if (hasDrafts) u.searchParams.set('draft', String(draft))
    if (hasLocalization && locale) u.searchParams.set('locale', locale)
    return u.toString()
  }, [baseURL, slug, id, depth, draft, hasDrafts, hasLocalization, locale])

  // ── Fetch ──
  const [data, setData] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(url, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `JWT ${token}` } : {}),
          },
        })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(`${res.status} ${res.statusText || ''}`.trim())
        }
        setData(json)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Request failed')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [url, token, id])

  const shareURL = useCallback(() => {
    Share.share({ message: url }).catch(() => {})
  }, [url])

  const textColor = isDark ? '#f2f2f7' : '#1f1f1f'
  const mutedColor = '#8E8E93'
  const canUseNativeControls = SHost != null

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1c1c1e' : '#f6f4f1' }]}>
      <Stack.Screen options={SCREEN_OPTIONS} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* ── REST URL ── */}
        <Section isDark={isDark}>
          <Text style={[styles.sectionLabel, { color: mutedColor }]}>REST URL · tap to share</Text>
          <Pressable onPress={shareURL} hitSlop={6}>
            <Text style={[styles.urlText, { color: isDark ? '#79c0ff' : '#0550ae' }]}>{url}</Text>
          </Pressable>
        </Section>

        {/* ── Controls ── */}
        <Section isDark={isDark}>
          {/* Draft toggle (drafts-enabled collections only) */}
          {hasDrafts && (
            <View style={styles.controlRow}>
              {canUseNativeControls && SToggle ? (
                <SHost matchContents={MATCH_CONTENTS} style={styles.hostFill}>
                  <SToggle label="Draft" isOn={draft} onIsOnChange={setDraft} />
                </SHost>
              ) : (
                <>
                  <Text style={[styles.controlLabel, { color: textColor }]}>Draft</Text>
                  <Switch value={draft} onValueChange={setDraft} />
                </>
              )}
            </View>
          )}

          {/* Depth stepper 0..10 — stable Stepper is CONTROLLED; the live
              label still renders in RN (native Stepper has no label text) */}
          <View style={styles.controlRow}>
            <Text style={[styles.controlLabel, { color: textColor }]}>Depth: {depth}</Text>
            {canUseNativeControls && SStepper ? (
              <SHost matchContents={MATCH_CONTENTS} style={styles.hostFill}>
                <SStepper
                  label=""
                  value={depth}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={handleDepthChange}
                />
              </SHost>
            ) : (
              <View style={styles.stepperFallback}>
                <Pressable
                  style={styles.stepBtn}
                  onPress={() => setDepth((d) => Math.max(0, d - 1))}
                >
                  <Text style={[styles.stepBtnText, { color: textColor }]}>−</Text>
                </Pressable>
                <Pressable
                  style={styles.stepBtn}
                  onPress={() => setDepth((d) => Math.min(10, d + 1))}
                >
                  <Text style={[styles.stepBtnText, { color: textColor }]}>+</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Locale picker (schema localization) */}
          {hasLocalization && localeCodes.length > 0 && (
            <View style={styles.controlRow}>
              {canUseNativeControls && SPicker && SText && pickerModifiers && localeTagItems.length > 0 ? (
                <SHost matchContents={MATCH_CONTENTS} style={styles.hostFill}>
                  <SPicker
                    label="Locale"
                    selection={locale}
                    onSelectionChange={handleLocaleChange}
                    modifiers={pickerModifiers}
                  >
                    {localeTagItems.map(({ code, mods }) => (
                      <SText key={code} modifiers={mods}>
                        {code}
                      </SText>
                    ))}
                  </SPicker>
                </SHost>
              ) : (
                <View style={styles.localeChips}>
                  <Text style={[styles.controlLabel, { color: textColor }]}>Locale</Text>
                  <View style={styles.chipRow}>
                    {localeCodes.map((code) => (
                      <Pressable
                        key={code}
                        style={[styles.chip, locale === code && styles.chipActive]}
                        onPress={() => setLocale(code)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: locale === code ? '#fff' : textColor },
                          ]}
                        >
                          {code}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </Section>

        {/* ── Response ── */}
        <Section isDark={isDark} style={styles.jsonSection}>
          <View style={styles.jsonHeader}>
            <Text style={[styles.sectionLabel, { color: mutedColor }]}>Response</Text>
            {loading && <ActivityIndicator size="small" />}
          </View>
          {error && (
            <Text style={[styles.errorText]} numberOfLines={2}>
              {error}
            </Text>
          )}
          {data != null ? (
            <JsonNode name={null} value={data} depth={0} palette={jsonPalette} />
          ) : !loading && !error ? (
            <Text style={[styles.controlLabel, { color: mutedColor }]}>No data</Text>
          ) : null}
        </Section>
      </ScrollView>
    </View>
  )
}
