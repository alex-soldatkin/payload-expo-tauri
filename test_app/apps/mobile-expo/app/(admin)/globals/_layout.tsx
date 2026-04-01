/**
 * Globals stack navigator.
 * Uses translucent frosted navigation headers with graceful fallbacks.
 */
import React from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'

let GlassView: React.ComponentType<{
  style?: any
  glassEffectStyle?: string
  tintColor?: string
}> | null = null

try {
  const mod = require('expo-glass-effect')
  GlassView = mod.GlassView
} catch { /* not available */ }

let BlurView: React.ComponentType<{
  style?: any
  intensity?: number
  tint?: string
}> | null = null

try {
  const mod = require('expo-blur')
  if (mod.BlurView) BlurView = mod.BlurView
} catch { /* not available */ }

function HeaderBackground() {
  if (GlassView && Platform.OS === 'ios' && parseInt(Platform.Version as string, 10) >= 26) {
    return (
      <GlassView
        style={StyleSheet.absoluteFill}
        glassEffectStyle="regular"
        tintColor="rgba(246, 244, 241, 0.7)"
      />
    )
  }

  if (BlurView) {
    try {
      return (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={80}
          tint="systemChromeMaterialLight"
        />
      )
    } catch { /* fall through */ }
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.translucentHeader]} />
  )
}

export default function GlobalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerBackground: () => <HeaderBackground />,
        headerTintColor: '#1f1f1f',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerBackTitleVisible: false,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Globals' }} />
      <Stack.Screen name="[slug]" options={{ title: 'Edit Global' }} />
    </Stack>
  )
}

const styles = StyleSheet.create({
  translucentHeader: {
    backgroundColor: 'rgba(246, 244, 241, 0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
})
