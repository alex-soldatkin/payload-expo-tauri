import React from 'react'
import { Text } from 'react-native'

import {
  CheckCircle2,
  CloudCheck,
  CloudOff,
  Info,
  RotateCcw,
  Save,
  Trash2,
  XCircle,
} from '../deps'
import { ACCENT, styles } from '../styles'
import type { ToastIcon, ToastType } from '../types'

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

export function ToastIcon_({
  type,
  icon,
}: {
  type: ToastType
  icon?: ToastIcon
}) {
  const color = ACCENT[type]
  const size = 22

  // Pick icon component based on semantic hint, then fall back to type
  const resolved = icon ?? type
  let IconComponent: React.ComponentType<any> | null = null

  switch (resolved) {
    case 'sync':
    case 'success':
      IconComponent = CloudCheck ?? CheckCircle2
      break
    case 'syncError':
      IconComponent = CloudOff ?? XCircle
      break
    case 'save':
    case 'publish':
      IconComponent = Save ?? CheckCircle2
      break
    case 'delete':
      IconComponent = Trash2 ?? Info
      break
    case 'undo':
      IconComponent = RotateCcw ?? Info
      break
    case 'error':
      IconComponent = XCircle ?? null
      break
    case 'info':
      IconComponent = Info ?? null
      break
    default:
      IconComponent = CheckCircle2
  }

  if (IconComponent) {
    return <IconComponent size={size} color={color} strokeWidth={2} />
  }

  // Unicode fallback when lucide isn't available
  const fallbackChar = type === 'error' ? '✕' : type === 'success' ? '✓' : 'ℹ'
  return <Text style={[styles.fallbackIcon, { color }]}>{fallbackChar}</Text>
}
