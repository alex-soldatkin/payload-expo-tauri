/**
 * Dark-mode aware colour palette for the document list surfaces
 * (DocumentList, FilterBottomSheet, FilterChips).
 *
 * The static `defaultTheme` is light-only; this hook returns the matching
 * palette for the active system colour scheme (via `useColorScheme()` —
 * never hardcode 'light'). The shape mirrors `defaultTheme.colors` plus a
 * few derived tokens so styles can swap palettes 1:1.
 */
import { useMemo } from 'react'
import { useColorScheme } from 'react-native'

import { defaultTheme } from '../theme'

export type ListColorPalette = Record<keyof typeof defaultTheme.colors, string> & {
  /** Subtle pressed-state overlay. */
  pressed: string
  /** Hairline separators (replaces hardcoded rgba-black values). */
  hairline: string
  /** Chevrons / tertiary glyphs. */
  tertiary: string
  /** Card surface (row cards when liquid glass is unavailable). */
  card: string
}

const lightColors: ListColorPalette = {
  ...defaultTheme.colors,
  pressed: 'rgba(0,0,0,0.06)',
  hairline: 'rgba(0,0,0,0.12)',
  tertiary: 'rgba(0,0,0,0.22)',
  card: defaultTheme.colors.surface,
}

// Dark counterparts aligned with the Payload web admin dark palette
// (near-black background, white primary) and iOS system grays.
const darkColors: ListColorPalette = {
  background: '#141414',
  surface: '#1e1e1e',
  text: '#f2f2f2',
  textMuted: '#9d9d9d',
  textPlaceholder: '#6f6f6f',
  border: '#3a3a3c',
  borderFocused: '#ffffff',
  primary: '#ffffff',
  primaryText: '#141414',
  error: '#ff6b66',
  errorBackground: '#2d1413',
  success: '#4ade80',
  successBackground: '#11291a',
  warning: '#fbbf24',
  warningBackground: '#2d2410',
  destructive: '#ff6b66',
  separator: '#2e2e30',
  pressed: 'rgba(255,255,255,0.08)',
  hairline: 'rgba(255,255,255,0.14)',
  tertiary: 'rgba(255,255,255,0.28)',
  card: '#1e1e1e',
}

export const useListColors = (): { dark: boolean; colors: ListColorPalette } => {
  const scheme = useColorScheme()
  const dark = scheme === 'dark'
  return useMemo(() => ({ dark, colors: dark ? darkColors : lightColors }), [dark])
}
