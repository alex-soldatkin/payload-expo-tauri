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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
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

// ── Optional native modules (guarded — graceful fallback tiers) ──────────
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

// App screens MAY import @expo/ui/swift-ui directly (tab layout precedent).
// Modifiers are factory calls imported from '@expo/ui/swift-ui/modifiers'.
let SHost: any = null
let SPicker: any = null
let SStepper: any = null
let SToggle: any = null
let SText: any = null
let pickerStyleMod: ((style: string) => any) | null = null
let tagMod: ((tag: string) => any) | null = null
if (Platform.OS === 'ios') {
  try {
    const ui = require('@expo/ui/swift-ui')
    const mods = require('@expo/ui/swift-ui/modifiers')
    SHost = ui.Host
    SPicker = ui.Picker
    SStepper = ui.Stepper
    SToggle = ui.Toggle
    SText = ui.Text
    pickerStyleMod = mods.pickerStyle
    tagMod = mods.tag
  } catch {
    /* @expo/ui not available */
  }
}

// ---------------------------------------------------------------------------
// Stable identities for native-bound props.
//
// Every value handed to a SwiftUI host/control must be referentially AND
// value stable across renders. Per-render-fresh objects re-apply native props
// on each commit, which re-arms SwiftUI body re-evaluation + `.onAppear`
// echo events mid-update — the render-loop class documented for the details
// sheet (memory-bank 008, Phase 25 item 2: DatePicker onAppear echo +
// `selection={new Date()}` re-arming the cycle).
// ---------------------------------------------------------------------------

const MATCH_CONTENTS = { vertical: true }

const renderNullHeaderItem = () => null

/** Fully static — setOptions runs once instead of once per render. */
const SCREEN_OPTIONS = {
  title: 'API',
  headerShown: true,
  headerRight: renderNullHeaderItem,
  headerLeft: renderNullHeaderItem,
}

// ---------------------------------------------------------------------------
// JSON tree — pure JS, chevron-expandable, monospace, type-colored values
// ---------------------------------------------------------------------------

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

type JsonPalette = {
  key: string
  string: string
  number: string
  boolean: string
  null: string
  punct: string
  chevron: string
}

const lightJson: JsonPalette = {
  key: '#0550ae',
  string: '#a3262c',
  number: '#6f42c1',
  boolean: '#bc4c00',
  null: '#8E8E93',
  punct: '#6e7781',
  chevron: '#8E8E93',
}

const darkJson: JsonPalette = {
  key: '#79c0ff',
  string: '#ffa198',
  number: '#d2a8ff',
  boolean: '#ffab70',
  null: '#8E8E93',
  punct: '#8b949e',
  chevron: '#8E8E93',
}

const leafColor = (value: unknown, p: JsonPalette): string => {
  if (value === null) return p.null
  switch (typeof value) {
    case 'string':
      return p.string
    case 'number':
      return p.number
    case 'boolean':
      return p.boolean
    default:
      return p.punct
  }
}

const leafText = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}

const JsonNode: React.FC<{
  name: string | null
  value: unknown
  depth: number
  palette: JsonPalette
}> = ({ name, value, depth, palette }) => {
  // Root + first level start expanded; deeper nodes start collapsed.
  const [expanded, setExpanded] = useState(depth < 2)

  const isArray = Array.isArray(value)
  const isObject = value !== null && typeof value === 'object'

  const keyLabel = name !== null ? (
    <Text style={[jsonStyles.mono, { color: palette.key }]}>
      {JSON.stringify(name)}
      <Text style={{ color: palette.punct }}>: </Text>
    </Text>
  ) : null

  if (!isObject) {
    return (
      <View style={[jsonStyles.row, { paddingLeft: depth * 14 }]}>
        <Text style={jsonStyles.mono} numberOfLines={3}>
          {keyLabel}
          <Text style={[jsonStyles.mono, { color: leafColor(value, palette) }]}>
            {leafText(value)}
          </Text>
        </Text>
      </View>
    )
  }

  const entries: Array<[string | null, unknown]> = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>)
  const summary = isArray
    ? `[${entries.length}]`
    : `{${entries.length} ${entries.length === 1 ? 'key' : 'keys'}}`

  return (
    <View>
      <Pressable
        style={[jsonStyles.row, { paddingLeft: depth * 14 }]}
        onPress={() => setExpanded((e) => !e)}
        hitSlop={4}
      >
        <Text style={[jsonStyles.chevron, { color: palette.chevron }]}>
          {expanded ? '▾' : '▸'}
        </Text>
        <Text style={jsonStyles.mono} numberOfLines={1}>
          {keyLabel}
          <Text style={[jsonStyles.mono, { color: palette.punct }]}>
            {expanded ? (isArray ? '[' : '{') : summary}
          </Text>
        </Text>
      </Pressable>
      {expanded && (
        <>
          {entries.map(([k, v], i) => (
            <JsonNode key={`${k}-${i}`} name={k} value={v} depth={depth + 1} palette={palette} />
          ))}
          <View style={[jsonStyles.row, { paddingLeft: depth * 14 }]}>
            <Text style={[jsonStyles.mono, { color: palette.punct }]}>
              {isArray ? ']' : '}'}
            </Text>
          </View>
        </>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Glass section wrapper (graceful tiers).
//
// Top-level component with a STABLE type: when this was a useCallback-built
// component inside the screen, every color-scheme flip produced a new
// component type → React remounted all three sections → the SwiftUI hosts
// (Toggle/Stepper/Picker) were recreated → their `.onAppear` echoes fired
// setState again. A stable type only re-renders; it never remounts.
// ---------------------------------------------------------------------------

const Section: React.FC<{
  isDark: boolean
  children: React.ReactNode
  style?: any
}> = ({ isDark, children, style }) =>
  liquidGlassAvailable && GlassView ? (
    <GlassView style={[styles.section, style]} glassEffectStyle="regular">
      {children}
    </GlassView>
  ) : (
    <View
      style={[
        styles.section,
        { backgroundColor: isDark ? 'rgba(44,44,46,0.9)' : 'rgba(255,255,255,0.92)' },
        style,
      ]}
    >
      {children}
    </View>
  )

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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 12 },

  section: {
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  urlText: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 17,
  },

  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    minHeight: 36,
  },
  controlLabel: { fontSize: 15 },
  hostFill: { flex: 1 },

  stepperFallback: { flexDirection: 'row', gap: 8 },
  stepBtn: {
    width: 36,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(120,120,128,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 18, fontWeight: '600' },

  localeChips: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(120,120,128,0.16)',
  },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { fontSize: 13, fontWeight: '600' },

  jsonSection: { paddingVertical: 12 },
  jsonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: { color: '#FF3B30', fontSize: 13, marginBottom: 6 },
})

const jsonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 1,
  },
  mono: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 18,
  },
  chevron: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 18,
    width: 14,
  },
})
