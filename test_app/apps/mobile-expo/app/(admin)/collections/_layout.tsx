/**
 * Collections stack navigator.
 * Provides push/pop navigation: Collections list → Document list → Document edit.
 * Uses translucent frosted navigation headers:
 *   - iOS 26+: GlassView (liquid glass) from expo-glass-effect
 *   - iOS < 26 / fallback: Semi-transparent background (no native blur module needed)
 *   - After dev client rebuild with expo-blur: BlurView for proper blur
 */
import React from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'

// GlassView (iOS 26+ liquid glass) — optional
let GlassView: React.ComponentType<{
  style?: any
  glassEffectStyle?: string
  tintColor?: string
}> | null = null

try {
  const mod = require('expo-glass-effect')
  GlassView = mod.GlassView
} catch { /* not available */ }

// BlurView (expo-blur) — optional, needs native rebuild after install
let BlurView: React.ComponentType<{
  style?: any
  intensity?: number
  tint?: string
}> | null = null

try {
  const mod = require('expo-blur')
  // Test if the native view is actually registered
  if (mod.BlurView) BlurView = mod.BlurView
} catch { /* not available */ }

function HeaderBackground() {
  // iOS 26+ liquid glass
  if (GlassView && Platform.OS === 'ios' && parseInt(Platform.Version as string, 10) >= 26) {
    return (
      <GlassView
        style={StyleSheet.absoluteFill}
        glassEffectStyle="regular"
        tintColor="rgba(246, 244, 241, 0.7)"
      />
    )
  }

  // expo-blur available (dev client rebuilt with it)
  if (BlurView) {
    try {
      return (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={80}
          tint="systemChromeMaterialLight"
        />
      )
    } catch { /* native view not registered — fall through */ }
  }

  // Pure RN fallback — translucent background, no native blur needed
  return (
    <View style={[StyleSheet.absoluteFill, styles.translucentHeader]} />
  )
}

export default function CollectionsLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Collections' }} />
      <Stack.Screen name="[slug]/index" options={{ title: 'Documents' }} />
      <Stack.Screen name="[slug]/[id]" options={{ title: 'Edit' }} />
      <Stack.Screen
        name="[slug]/create"
        options={{ title: 'Create', presentation: 'modal' }}
      />
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
