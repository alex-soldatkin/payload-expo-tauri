/**
 * Globals stack navigator.
 * Provides push/pop navigation: Globals list → Global edit.
 * Uses translucent frosted-glass navigation headers:
 *   - iOS 26+: GlassView (liquid glass) from expo-glass-effect
 *   - iOS < 26: BlurView from expo-blur
 */
import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { BlurView } from 'expo-blur'

let GlassView: React.ComponentType<{
  style?: any
  glassEffectStyle?: string
  tintColor?: string
}> | null = null

try {
  const mod = require('expo-glass-effect')
  GlassView = mod.GlassView
} catch {
  // expo-glass-effect not available
}

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

  return (
    <BlurView
      style={StyleSheet.absoluteFill}
      intensity={80}
      tint="systemChromeMaterialLight"
    />
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
