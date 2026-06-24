import React, { useContext } from 'react'

import type { DiffTheme } from './types'

// ---------------------------------------------------------------------------
// Shared theme context (one StyleSheet for the whole diff tree)
// ---------------------------------------------------------------------------

export const DiffThemeContext = React.createContext<DiffTheme | null>(null)

export const useDiffTheme = (): DiffTheme => {
  const ctx = useContext(DiffThemeContext)
  if (!ctx) throw new Error('VersionDiff sub-components must render inside VersionDiff')
  return ctx
}
