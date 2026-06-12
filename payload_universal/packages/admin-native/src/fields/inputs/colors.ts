/**
 * Dark-mode-safe palette for input fields.
 *
 * The static theme tokens are light-only; this hook resolves the tokens the
 * input fields use against the system color scheme (never hardcode 'light' —
 * follow useColorScheme()). Light values come straight from the theme
 * tokens; dark values mirror the iOS system palette equivalents.
 */
import { useColorScheme } from 'react-native'

import { defaultTheme as t } from '../../theme'

export type InputColors = {
  text: string
  textMuted: string
  textPlaceholder: string
  separator: string
  border: string
  surface: string
  /** Subtle fill for chips / gutters (iOS systemFill equivalent). */
  fill: string
  error: string
  success: string
  /** Interactive accent for inline text buttons (Add / Format). */
  accent: string
  isDark: boolean
}

const lightColors: InputColors = {
  text: t.colors.text,
  textMuted: t.colors.textMuted,
  textPlaceholder: t.colors.textPlaceholder,
  separator: t.colors.separator,
  border: t.colors.border,
  surface: t.colors.surface,
  fill: 'rgba(120,120,128,0.12)',
  error: t.colors.error,
  success: t.colors.success,
  accent: '#007aff',
  isDark: false,
}

const darkColors: InputColors = {
  text: '#f2f2f2',
  textMuted: '#9b9ba1',
  textPlaceholder: '#6e6e73',
  separator: '#3a3a3c',
  border: '#3a3a3c',
  surface: '#1c1c1e',
  fill: 'rgba(120,120,128,0.28)',
  error: '#ff453a',
  success: '#32d74b',
  accent: '#0a84ff',
  isDark: true,
}

export const useInputColors = (): InputColors =>
  useColorScheme() === 'dark' ? darkColors : lightColors
