/**
 * useCalendarLegend — source visibility state + the legend chip elements.
 *
 * Source visibility is SEEDED from each source's `hidden` flag (customize-
 * sheet visibility toggles) and then stays LOCAL: legend taps never mutate the
 * injected config. A new `sources` array (config/preset save) re-seeds, so
 * persisted visibility always wins on arrival.
 *
 * Legend chips — one visibility control per source (ON = source visible):
 *  - native tier: SwiftUI Toggle as a tinted toggle-BUTTON
 *    (toggleStyle('button') + tint(source.color)) hosted per-source in a
 *    NativeHost matchContents (hosts size to their SwiftUI content inside the
 *    horizontal legend scroller);
 *  - JS fallback: source-tinted FILLED chip with a lucide Check when ON vs an
 *    OUTLINED chip with the bare colour dot when OFF — the check glyph keeps
 *    the state unambiguous without relying on colour vision.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import type { ListColorPalette } from '../../../hooks/useListColors'
import { hexToRgba } from '../../../kanban/types'
import { NativeHost } from '../../../fields/NativeHost'
import { nativeComponents } from '../../../fields/shared'
import type { CalendarSource } from '../../../scheduling'
import type { CalendarStyles } from '../styles'

// Optional: lucide legend check (pure RN SVG) with a text fallback
let CheckIcon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }> | null =
  null
try {
  const lucide = require('lucide-react-native')
  CheckIcon = lucide.Check ?? null
} catch {
  /* lucide-react-native not available */
}

// Native SwiftUI legend tier — registry Toggle rendered as a tinted toggle-
// BUTTON (toggleStyle('button')). BOTH entries are null-checked; either
// missing ⇒ the JS chip fallback renders (tint is optional sugar on top).
const NativeToggle = nativeComponents.Toggle
const toggleStyleMod = nativeComponents.toggleStyle
const tintMod = nativeComponents.tint

export type UseCalendarLegend = {
  /** Sources with their `hidden` seed honoured and local taps applied. */
  visibleSources: CalendarSource[]
  /** Legend chip elements (native toggle buttons or JS fallback chips). */
  legendChips: React.ReactNode[]
}

export function useCalendarLegend({
  sources,
  styles,
  colors,
  dark,
}: {
  sources: CalendarSource[]
  styles: CalendarStyles
  colors: ListColorPalette
  dark: boolean
}): UseCalendarLegend {
  // ── Source visibility — SEEDED from the configured `hidden` flags
  // (customize-sheet visibility toggles), then local-only: legend taps never
  // mutate the injected config. A new `sources` array (config/preset save)
  // re-seeds, so persisted visibility always wins on arrival ────────────────
  const [hiddenSourceIds, setHiddenSourceIds] = useState<ReadonlySet<string>>(
    () => new Set(sources.filter((s) => s.hidden).map((s) => s.id)),
  )
  useEffect(() => {
    setHiddenSourceIds(new Set(sources.filter((s) => s.hidden).map((s) => s.id)))
  }, [sources])

  const setSourceVisible = useCallback((id: string, visible: boolean) => {
    setHiddenSourceIds((prev) => {
      if (visible === !prev.has(id)) return prev
      const next = new Set(prev)
      if (visible) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const visibleSources = useMemo(
    () => sources.filter((s) => !hiddenSourceIds.has(s.id)),
    [sources, hiddenSourceIds],
  )

  const legendChips = sources.map((source) => {
    const visible = !hiddenSourceIds.has(source.id)
    if (NativeToggle && toggleStyleMod) {
      return (
        <NativeHost key={source.id} matchContents>
          <NativeToggle
            isOn={visible}
            label={source.label}
            onIsOnChange={(isOn: boolean) => setSourceVisible(source.id, isOn)}
            modifiers={[
              toggleStyleMod('button'),
              ...(tintMod ? [tintMod(source.color)] : []),
            ]}
          />
        </NativeHost>
      )
    }
    return (
      <Pressable
        key={source.id}
        onPress={() => setSourceVisible(source.id, !visible)}
        accessibilityRole="button"
        accessibilityState={{ selected: visible }}
        style={({ pressed }) => [
          styles.chip,
          visible
            ? {
                borderColor: hexToRgba(source.color, 0.55),
                backgroundColor: hexToRgba(source.color, dark ? 0.3 : 0.16),
              }
            : { borderColor: colors.border, backgroundColor: 'transparent' },
          pressed && styles.chipPressed,
        ]}
      >
        {visible ? (
          CheckIcon ? (
            <CheckIcon size={12} color={colors.text} strokeWidth={3} />
          ) : (
            <Text style={styles.chipCheckGlyph}>{'✓'}</Text>
          )
        ) : (
          // OFF affordance: outlined chip + FULL-strength colour dot (muted
          // label carries the "off" state) — a dimmed dot was unreadable on
          // the dark glass header.
          <View style={[styles.chipDot, { backgroundColor: source.color }]} />
        )}
        <Text
          style={[styles.chipLabel, !visible && { color: colors.textPlaceholder }]}
          numberOfLines={1}
        >
          {source.label}
        </Text>
      </Pressable>
    )
  })

  return { visibleSources, legendChips }
}
