/**
 * Document create screen – presented as a modal.
 * Uses the same DocumentForm but with empty initial data.
 */
import React from 'react'
import { Alert, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import {
  DocumentForm,
  getCollectionLabel,
  payloadApi,
  useAdminSchema,
  useMenuModel,
  usePayloadNative,
} from '@payload-universal/admin-native'

export default function DocumentCreateScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const { baseURL, auth } = usePayloadNative()
  const schema = useAdminSchema()
  const menuModel = useMenuModel()

  const collectionLabel = menuModel ? getCollectionLabel(menuModel, slug, false) : slug
  const schemaMap = schema?.collections[slug]

  const handleSubmit = async (data: Record<string, unknown>) => {
    const created = await payloadApi.create({ baseURL, token: auth.token }, slug, data)
    Alert.alert('Created', `New ${collectionLabel} created successfully.`)
    // Navigate to the edit screen for the new document
    router.replace(`/(admin)/collections/${slug}/${(created as Record<string, unknown>).id}`)
  }

  if (!schemaMap) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ title: `New ${collectionLabel}` }} />
        <Text className="text-base text-ink-muted">Schema not available</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen
        options={{
          title: `New ${collectionLabel}`,
          headerLeft: () => (
            <Text
              style={{ color: '#1f1f1f', fontSize: 15 }}
              onPress={() => router.back()}
            >
              Cancel
            </Text>
          ),
        }}
      />
      <DocumentForm
        schemaMap={schemaMap}
        slug={slug}
        initialData={{}}
        onSubmit={handleSubmit}
        submitLabel="Create"
      />
    </View>
  )
}
