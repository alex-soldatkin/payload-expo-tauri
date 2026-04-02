/**
 * Collections stack navigator.
 * Provides push/pop navigation: Collections list → Document list → Document edit.
 *
 * Uses a progressive blur header overlay that fades in as the user scrolls.
 * Each screen connects its scroll events to the shared HeaderScrollContext
 * so the blur transitions smoothly from transparent → frosted.
 */
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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

function CollectionsStack() {
  const insets = useSafeAreaInsets()
  const headerHeight = insets.top + NAV_BAR_HEIGHT
  const scrollY = useHeaderScrollY()

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerTransparent: true,
          headerTintColor: '#1f1f1f',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackTitleVisible: false,
          headerShadowVisible: false,
          ...(hasProgressiveBlur
            ? {}
            : { headerBackground: () => <HeaderBackgroundFallback /> }),
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Collections' }} />
        <Stack.Screen name="[slug]/index" options={{ title: 'Documents' }} />
        <Stack.Screen name="[slug]/[id]" options={{ title: 'Edit' }} />
        <Stack.Screen
          name="[slug]/create"
          options={{
            title: 'Create',
            presentation: 'modal',
            headerBackground: () => <HeaderBackgroundFallback />,
          }}
        />
      </Stack>
      <ProgressiveBlurHeader headerHeight={headerHeight} scrollY={scrollY} />
    </View>
  )
}

export default function CollectionsLayout() {
  return (
    <HeaderScrollProvider>
      <CollectionsStack />
    </HeaderScrollProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
