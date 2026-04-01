/**
 * Collections stack navigator.
 * Provides push/pop navigation: Collections list → Document list → Document edit.
 * Uses translucent frosted-glass navigation headers:
 *   - iOS 26+: GlassView (liquid glass) from expo-glass-effect
 *   - iOS < 26: BlurView from expo-blur
 */
import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { BlurView } from 'expo-blur'

// GlassView is iOS 26+ only — optional import
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

  // Fallback: translucent blur (iOS < 26 and all platforms)
  return (
    <BlurView
      style={StyleSheet.absoluteFill}
      intensity={80}
      tint="systemChromeMaterialLight"
    />
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
