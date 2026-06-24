import React from 'react'
import { Text, View } from 'react-native'

import { formatTime } from '../utils'

type AutosaveState = {
  status: 'idle' | 'saving' | 'error' | string
  lastSavedAt?: Date | null
}

/**
 * Locale + autosave status pills — subtle overlay near the title/status row.
 * Renders only when off the default locale or autosave is active.
 */
export const EditStatusPills: React.FC<{
  isDark: boolean
  isDefaultLocale: boolean
  activeLocale: string
  autosave: AutosaveState
  headerHeight: number
}> = ({ isDark, isDefaultLocale, activeLocale, autosave, headerHeight }) => {
  if (isDefaultLocale && autosave.status === 'idle') return null

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: headerHeight + 6,
        right: 16,
        zIndex: 20,
        flexDirection: 'row',
        gap: 6,
      }}
    >
      {!isDefaultLocale && (
        <View
          style={{
            backgroundColor: isDark ? 'rgba(10,132,255,0.28)' : 'rgba(0,122,255,0.12)',
            borderRadius: 10,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#6db2ff' : '#0a66c2' }}>
            {activeLocale} · online
          </Text>
        </View>
      )}
      {autosave.status !== 'idle' && (
        <View
          style={{
            backgroundColor: isDark ? 'rgba(120,120,128,0.32)' : 'rgba(120,120,128,0.14)',
            borderRadius: 10,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '500', color: isDark ? '#aeaeb2' : '#6b7280' }}>
            {autosave.status === 'saving'
              ? 'Saving…'
              : autosave.status === 'error'
                ? 'Autosave failed'
                : autosave.lastSavedAt
                  ? `Saved · ${formatTime(autosave.lastSavedAt)}`
                  : 'Saved'}
          </Text>
        </View>
      )}
    </View>
  )
}
