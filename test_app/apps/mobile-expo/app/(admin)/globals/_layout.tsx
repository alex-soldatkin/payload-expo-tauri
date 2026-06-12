/**
 * Globals stack navigator.
 * Uses a progressive blur overlay that fades in on scroll,
 * otherwise falls back to a standard frosted headerBackground.
 */
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useListColors } from '@payload-universal/admin-native'
import {
  ProgressiveBlurHeader,
  HeaderBackgroundFallback,
  hasProgressiveBlur,
} from '@/components/ProgressiveBlurHeader'
import {
  HeaderScrollProvider,
  useHeaderScrollY,
} from '@/components/HeaderScrollContext'

const NAV_BAR_HEIGHT = 44

function GlobalsStack() {
  const insets = useSafeAreaInsets()
  const headerHeight = insets.top + NAV_BAR_HEIGHT
  const scrollY = useHeaderScrollY()
  // Palette-driven tint — must match the scheme-aware header background so
  // toolbar icons are never white-on-white in either scheme.
  const { colors: c } = useListColors()

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerTransparent: true,
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          ...(hasProgressiveBlur
            ? {}
            : { headerBackground: () => <HeaderBackgroundFallback /> }),
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Globals' }} />
        <Stack.Screen name="[slug]" options={{ title: 'Edit Global' }} />
      </Stack>
      <ProgressiveBlurHeader headerHeight={headerHeight} scrollY={scrollY} />
    </View>
  )
}

export default function GlobalsLayout() {
  return (
    <HeaderScrollProvider>
      <GlobalsStack />
    </HeaderScrollProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
