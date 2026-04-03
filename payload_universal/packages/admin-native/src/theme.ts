/**
 * Default theme tokens for admin-native components.
 * Aligned with the Payload admin palette and the Expo app's Tailwind config.
 */
export const defaultTheme = {
  colors: {
    background: '#f6f4f1',
    surface: '#ffffff',
    text: '#1f1f1f',
    textMuted: '#666666',
    textPlaceholder: '#999999',
    border: '#e5e5e5',
    borderFocused: '#000000',
    primary: '#000000',
    primaryText: '#ffffff',
    error: '#dc2626',
    errorBackground: '#fef2f2',
    success: '#16a34a',
    successBackground: '#f0fdf4',
    warning: '#ca8a04',
    warningBackground: '#fefce8',
    destructive: '#dc2626',
    separator: '#e0e0e0',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
  },
} as const

export type Theme = typeof defaultTheme
