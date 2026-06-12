/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './global.css',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Tokens resolve through CSS variables. On web the light/dark values
        // come from global.css (:root + prefers-color-scheme). On native the
        // variables are provided at runtime by ThemeVarsProvider in
        // app/_layout.tsx via NativeWind vars(), keyed off useListColors so
        // they flip live with RN Appearance (incl. the stored user override).
        ink: {
          DEFAULT: 'var(--color-ink)',
          muted: 'var(--color-ink-muted)',
        },
        paper: 'var(--color-paper)',
        surface: 'var(--color-surface)',
        // Input/card borders (useListColors `border`).
        line: 'var(--color-line)',
        // Error text/background (useListColors `error` / `errorBackground`).
        danger: {
          DEFAULT: 'var(--color-danger)',
          bg: 'var(--color-danger-bg)',
        },
        // Warning text/background (useListColors `warning` / `warningBackground`).
        warn: {
          DEFAULT: 'var(--color-warn)',
          bg: 'var(--color-warn-bg)',
        },
      },
    },
  },
  plugins: [],
}
