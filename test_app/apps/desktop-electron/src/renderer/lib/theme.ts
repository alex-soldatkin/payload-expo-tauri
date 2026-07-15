// Explicit theme override. 'system' follows the OS via prefers-color-scheme;
// 'light'/'dark' pin it. Persisted under settings.theme and applied by toggling
// data-theme on <html> (see base.css for the token blocks keyed off it).

export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_CHOICES: ThemeChoice[] = ['system', 'light', 'dark']

/** Set (or clear, for 'system') the data-theme attribute on the document root. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
}
