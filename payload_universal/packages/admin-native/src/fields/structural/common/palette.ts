import { useMemo } from 'react'
import { useColorScheme } from 'react-native'

import { defaultTheme as t } from '../../../theme'

// ---------------------------------------------------------------------------
// Dark-mode-aware palette — follows the system appearance.
// The static theme tokens are light-only; structural surfaces resolve their
// colour-bearing styles through this hook instead (never hardcode 'light').
// ---------------------------------------------------------------------------

export type StructuralPalette = {
  isDark: boolean
  text: string
  textMuted: string
  textFaint: string
  separator: string
  /** Subtle card surface used when liquid glass is unavailable. */
  cardBg: string
  cardBorder: string
  pillBarBg: string
  pillActiveBg: string
  primary: string
  destructive: string
  inputBg: string
}

export const usePalette = (): StructuralPalette => {
  const isDark = useColorScheme() === 'dark'
  return useMemo(() => isDark
    ? {
        isDark,
        text: '#f2f2f7',
        textMuted: 'rgba(235,235,245,0.6)',
        textFaint: 'rgba(235,235,245,0.35)',
        separator: 'rgba(84,84,88,0.65)',
        cardBg: 'rgba(255,255,255,0.06)',
        cardBorder: 'rgba(255,255,255,0.12)',
        pillBarBg: 'rgba(118,118,128,0.24)',
        pillActiveBg: '#636366',
        primary: '#ffffff',
        destructive: '#ff453a',
        inputBg: 'rgba(118,118,128,0.18)',
      }
    : {
        isDark,
        text: t.colors.text,
        textMuted: t.colors.textMuted,
        textFaint: t.colors.textPlaceholder,
        separator: t.colors.separator,
        cardBg: 'rgba(0,0,0,0.03)',
        cardBorder: 'rgba(0,0,0,0.08)',
        pillBarBg: 'rgba(0,0,0,0.05)',
        pillActiveBg: '#ffffff',
        primary: t.colors.primary,
        destructive: t.colors.destructive,
        inputBg: 'rgba(118,118,128,0.12)',
      }, [isDark])
}
