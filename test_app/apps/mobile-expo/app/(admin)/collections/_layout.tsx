/**
 * Collections stack navigator.
 * Provides push/pop navigation: Collections list -> Document list -> Document edit.
 * Uses a progressive blur overlay at the top of the screen that fades from
 * full blur behind the navigation bar to fully transparent below it.
 */
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ProgressiveBlurHeader } from '../../../components/ProgressiveBlurHeader'

const NAV_BAR_HEIGHT = 44

export default function CollectionsLayout() {
  const insets = useSafeAreaInsets()
  const headerHeight = insets.top + NAV_BAR_HEIGHT

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerTransparent: true,
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
      <ProgressiveBlurHeader headerHeight={headerHeight} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
