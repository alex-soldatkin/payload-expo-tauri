/**
 * Shared helpers for the picker-based fields (select, radio, relationship,
 * upload). INTERNAL to fields/pickers — external consumers must import the
 * field components from fields/pickers.tsx only.
 *
 * Contains:
 *   - guarded optional deps (expo-glass-effect, lucide-react-native, local-db)
 *   - usePickerPalette: dark-mode aware color tokens (follows useColorScheme)
 *   - docDisplayTitle / resolveAssetURL / formatFileSize helpers
 *   - whereToMangoSelector: object-form Payload Where → RxDB mango selector
 *   - useDebouncedValue
 *   - JS fallback option lists (chips + radio rows) shared by select/radio
 */
import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native'

import { defaultTheme as t } from '../../theme'

// ---------------------------------------------------------------------------
// Optional dependencies (guarded — must not crash in Expo Go)
// ---------------------------------------------------------------------------

/** Liquid glass (iOS 26+). `available` is false everywhere else. */
export const glass: {
  GlassView: React.ComponentType<any> | null
  available: boolean
} = (() => {
  try {
    const mod = require('expo-glass-effect')
    return {
      GlassView: mod.GlassView ?? null,
      available: mod.isLiquidGlassAvailable?.() ?? false,
    }
  } catch {
    return { GlassView: null, available: false }
  }
})()

/** lucide-react-native icon set (null when not installed). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lucide: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> | null = (() => {
  try {
    return require('lucide-react-native')
  } catch {
    return null
  }
})()

/** Renders a lucide icon by name, or nothing when lucide is unavailable. */
export const LucideIcon: React.FC<{ name: string; size?: number; color?: string }> = ({
  name, size = 18, color = t.colors.textMuted,
}) => {
  const Icon = lucide?.[name]
  return Icon ? <Icon size={size} color={color} /> : null
}

let _useLocalDB: (() => any) | null = null
try {
  _useLocalDB = require('@payload-universal/local-db').useLocalDB
} catch { /* local-db not available */ }

/**
 * Optional local-db access. The conditional call is module-constant so the
 * hook order is stable across renders (same pattern as richtext.tsx).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useOptionalLocalDB = (): any => (_useLocalDB ? _useLocalDB() : null)

// ---------------------------------------------------------------------------
// Dark-mode aware palette (convention: never hardcode 'light')
// ---------------------------------------------------------------------------

export type PickerPalette = {
  dark: boolean
  text: string
  textMuted: string
  placeholder: string
  surface: string
  surfaceAlt: string
  border: string
  separator: string
  primary: string
  primaryText: string
  destructive: string
}

export const usePickerPalette = (): PickerPalette => {
  const dark = useColorScheme() === 'dark'
  return dark
    ? {
        dark,
        text: '#f2f2f7',
        textMuted: '#a1a1a6',
        placeholder: '#7c7c80',
        surface: '#1c1c1e',
        surfaceAlt: 'rgba(255,255,255,0.10)',
        border: '#3a3a3c',
        separator: '#38383a',
        primary: '#ffffff',
        primaryText: '#000000',
        destructive: '#ff453a',
      }
    : {
        dark,
        text: t.colors.text,
        textMuted: t.colors.textMuted,
        placeholder: t.colors.textPlaceholder,
        surface: t.colors.surface,
        surfaceAlt: '#f0efed',
        border: t.colors.border,
        separator: t.colors.separator,
        primary: t.colors.primary,
        primaryText: t.colors.primaryText,
        destructive: t.colors.destructive,
      }
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/** Resolve a document's display title (useAsTitle → title/name/email/id). */
export const docDisplayTitle = (doc: Record<string, unknown>, useAsTitle?: string): string => {
  if (useAsTitle && doc[useAsTitle] != null) return String(doc[useAsTitle])
  return String(doc.title ?? doc.name ?? doc.filename ?? doc.email ?? doc.id ?? '')
}

/** Resolve a possibly-relative asset URL against the Payload base URL. */
export const resolveAssetURL = (baseURL: string, url: unknown): string | null => {
  if (typeof url !== 'string' || url.length === 0) return null
  if (/^https?:\/\//.test(url)) return url
  return `${baseURL.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

/** Human-readable file size (web admin parity). */
export const formatFileSize = (bytes: unknown): string | null => {
  const n = typeof bytes === 'number' ? bytes : Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** Debounce a changing value (used for server-side search). */
export const useDebouncedValue = <T,>(value: T, delayMs = 300): T => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

/** Merge multiple Payload Where clauses into one (skips empties). */
export const mergeWhere = (
  ...clauses: Array<Record<string, unknown> | undefined | null>
): Record<string, unknown> | undefined => {
  const present = clauses.filter((c): c is Record<string, unknown> => c != null && Object.keys(c).length > 0)
  if (present.length === 0) return undefined
  if (present.length === 1) return present[0]
  return { and: present }
}

// ---------------------------------------------------------------------------
// Payload Where (object form) → RxDB mango selector
// ---------------------------------------------------------------------------

const PAYLOAD_OP_TO_MANGO: Record<string, string> = {
  equals: '$eq',
  not_equals: '$ne',
  greater_than: '$gt',
  greater_than_equal: '$gte',
  less_than: '$lt',
  less_than_equal: '$lte',
  in: '$in',
  not_in: '$nin',
  exists: '$exists',
}

/**
 * Convert a simple object-form Where clause to a mango selector.
 * Returns null when ANY clause is unsupported (and/or/like/near/...) so the
 * caller can skip the local prefilter entirely rather than show docs the
 * server-side filter would exclude.
 */
export const whereToMangoSelector = (
  where: Record<string, unknown> | undefined,
): Record<string, unknown> | null => {
  if (!where) return {}
  const selector: Record<string, unknown> = {}
  for (const [field, condition] of Object.entries(where)) {
    if (field === 'and' || field === 'or') return null
    if (typeof condition !== 'object' || condition === null) return null
    const ops: Record<string, unknown> = {}
    for (const [op, val] of Object.entries(condition as Record<string, unknown>)) {
      const mangoOp = PAYLOAD_OP_TO_MANGO[op]
      if (!mangoOp) return null
      // `in` may serialize as a comma string in Payload — normalize to array
      ops[mangoOp] = (mangoOp === '$in' || mangoOp === '$nin') && typeof val === 'string'
        ? val.split(',')
        : val
    }
    selector[field] = ops
  }
  return selector
}

// ---------------------------------------------------------------------------
// JS fallback option pickers (shared by select + radio)
// ---------------------------------------------------------------------------

export type NormalizedOption = { label: string; value: string }

/** Wrap-row of toggle chips — pure JS, dark-mode aware. */
export const OptionChipList: React.FC<{
  options: NormalizedOption[]
  selected: string | null
  onChange: (v: string | null) => void
  disabled?: boolean
  /** When false, tapping the active chip does NOT clear it. */
  clearable?: boolean
}> = ({ options, selected, onChange, disabled, clearable = true }) => {
  const palette = usePickerPalette()
  return (
    <View style={sharedStyles.chipContainer}>
      {options.map((opt) => {
        const isOn = selected === opt.value
        return (
          <Pressable
            key={opt.value}
            style={[
              sharedStyles.chip,
              { borderColor: palette.border, backgroundColor: palette.surface },
              isOn && { backgroundColor: palette.primary, borderColor: palette.primary },
            ]}
            onPress={() => {
              if (disabled) return
              if (isOn) { if (clearable) onChange(null); return }
              onChange(opt.value)
            }}
            disabled={disabled}
          >
            <Text style={[sharedStyles.chipText, { color: isOn ? palette.primaryText : palette.text }]}>
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Vertical radio rows with a circular indicator — pure JS, dark-mode aware. */
export const RadioOptionRows: React.FC<{
  options: NormalizedOption[]
  selected: string | null
  onChange: (v: string | null) => void
  disabled?: boolean
}> = ({ options, selected, onChange, disabled }) => {
  const palette = usePickerPalette()
  return (
    <View>
      {options.map((opt) => {
        const isOn = selected === opt.value
        return (
          <Pressable
            key={opt.value}
            style={sharedStyles.radioRow}
            onPress={() => !disabled && onChange(opt.value)}
            disabled={disabled}
          >
            <View style={[sharedStyles.radioOuter, { borderColor: isOn ? palette.primary : palette.border }]}>
              {isOn && <View style={[sharedStyles.radioInner, { backgroundColor: palette.primary }]} />}
            </View>
            <Text style={[sharedStyles.radioLabel, { color: palette.text }]}>{opt.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * Chip with liquid glass treatment on iOS 26+ (GlassView container around a
 * JS Pressable — never the glassEffect modifier on a gesture-owning control).
 * Falls back to a plain bordered chip elsewhere.
 */
export const GlassChip: React.FC<{
  label: string
  selected?: boolean
  disabled?: boolean
  onPress?: () => void
  trailing?: React.ReactNode
  palette: PickerPalette
}> = ({ label, selected, disabled, onPress, trailing, palette }) => {
  const inner = (
    <Pressable
      style={sharedStyles.glassChipInner}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
    >
      <Text style={[sharedStyles.chipText, { color: selected ? palette.primaryText : palette.text }]}>
        {label}
      </Text>
      {trailing}
    </Pressable>
  )

  if (glass.available && glass.GlassView && !selected) {
    const GlassView = glass.GlassView
    return (
      <GlassView style={sharedStyles.glassChip} glassEffectStyle="regular" isInteractive={false}>
        {inner}
      </GlassView>
    )
  }

  return (
    <View
      style={[
        sharedStyles.glassChip,
        { borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
        selected && { backgroundColor: palette.primary, borderColor: palette.primary },
      ]}
    >
      {inner}
    </View>
  )
}

export const sharedStyles = StyleSheet.create({
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs },
  chip: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: t.fontSize.sm, fontWeight: '500' },

  glassChip: { borderRadius: 20, overflow: 'hidden' },
  glassChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
  },

  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.sm + 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontSize: t.fontSize.md, flexShrink: 1 },

  sheetTitle: { fontSize: t.fontSize.lg, fontWeight: '700', marginBottom: t.spacing.md },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { fontSize: t.fontSize.md, flex: 1 },
  emptyText: { textAlign: 'center', paddingVertical: t.spacing.xl, fontSize: t.fontSize.sm },
})
