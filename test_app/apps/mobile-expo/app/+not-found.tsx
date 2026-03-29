import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

export default function NotFoundScreen() {
  const router = useRouter()

  return (
    <View className="flex-1 items-center justify-center bg-paper px-6">
      <Text className="text-xl font-bold text-ink">Page not found</Text>
      <Text className="mt-2 text-sm text-ink-muted">
        This screen doesn't exist.
      </Text>
      <Pressable
        className="mt-6 rounded-xl bg-black px-6 py-3"
        onPress={() => router.replace('/')}
      >
        <Text className="text-sm font-semibold text-white">Go home</Text>
      </Pressable>
    </View>
  )
}
