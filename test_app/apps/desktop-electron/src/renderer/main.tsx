import { createRoot } from 'react-dom/client'
import './styles/base.css'
import './styles/shell.css'
import './styles/views.css'
import './styles/form.css'
import './styles/badges.css'
import './styles/responsive.css'
import { App } from './App'
import { applyTheme, type ThemeChoice } from './lib/theme'

// Apply the persisted theme before first paint so there's no dark→light flash.
// Absent/'system' leaves data-theme off, so prefers-color-scheme drives it.
window.payloadDesktop
  .getSettings()
  .then((s) => applyTheme((s.theme as ThemeChoice) ?? 'system'))
  .catch(() => {})

const container = document.getElementById('root')!
createRoot(container).render(<App />)
