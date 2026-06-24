/**
 * Animated sync progress bar — shown in the Account screen's Sync Status card
 * during an active sync (hidden when idle, whether at 0% or 100%).
 */
import React, { useEffect, useRef } from 'react'
import { Animated, Text, useColorScheme, View } from 'react-native'

export const SyncProgressBar: React.FC<{
  percent: number
  syncing: boolean
  current: string | null
}> = ({ percent, syncing, current }) => {
  const isDark = useColorScheme() === 'dark'
  const widthAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percent,
      duration: 300,
      useNativeDriver: false,
    }).start()
  }, [percent, widthAnim])

  // Only show during active sync — hide when idle (whether at 0% or 100%)
  if (!syncing) return null

  return (
    <View style={{ marginTop: 12 }}>
      {/* Track */}
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        {/* Fill */}
        <Animated.View
          style={{
            height: '100%',
            borderRadius: 3,
            backgroundColor: syncing ? '#007AFF' : '#34C759',
            width: widthAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp',
            }),
          }}
        />
      </View>

      {/* Label */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: '#8E8E93' }}>
          {current ? `Syncing ${current}...` : syncing ? 'Starting sync...' : 'Sync complete'}
        </Text>
        <Text style={{ fontSize: 11, fontVariant: ['tabular-nums'], color: '#8E8E93' }}>
          {percent}%
        </Text>
      </View>
    </View>
  )
}
