/**
 * Globals stack navigator.
 * Provides push/pop navigation: Globals list → Global edit.
 * Uses GlassView for translucent frosted-glass navigation headers.
 */
import React from 'react'
import { StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { GlassView } from 'expo-glass-effect'

function GlassHeaderBackground() {
  return (
    <GlassView
      style={StyleSheet.absoluteFill}
      glassEffectStyle="regular"
      tintColor="rgba(246, 244, 241, 0.7)"
    />
  )
}

export default function GlobalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerBackground: () => <GlassHeaderBackground />,
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
