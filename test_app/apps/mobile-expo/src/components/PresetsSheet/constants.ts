import type { ViewPresetAccessMode } from '@/src/hooks/useViewPresets'

export const DESTRUCTIVE_RED = '#FF3B30'

export const ACCESS_MODES: Array<{ value: ViewPresetAccessMode; label: string }> = [
  { value: 'onlyMe', label: 'Only Me' },
  { value: 'specificUsers', label: 'Specific Users' },
  { value: 'everyone', label: 'Everyone' },
]
