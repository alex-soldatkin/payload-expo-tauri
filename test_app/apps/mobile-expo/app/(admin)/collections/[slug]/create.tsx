/**
 * Document create screen — always local-first.
 *
 * Inserts the new document into local RxDB immediately (instant),
 * then navigates to the edit screen. The sync engine pushes to the
 * server in the background.
 */
import React from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import {
  DocumentForm,
  getCollectionLabel,
  useAdminSchema,
  useMenuModel,
} from '@payload-universal/admin-native'
import { useLocalDB, useLocalMutations, useLocalDBStatus } from '@payload-universal/local-db'

export default function DocumentCreateScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const schema = useAdminSchema()
  const menuModel = useMenuModel()
  const localDB = useLocalDB()
  const { isReady } = useLocalDBStatus()
  const { create } = useLocalMutations(localDB, slug)

  const collectionLabel = menuModel ? getCollectionLabel(menuModel, slug, false) : slug
  const schemaMap = schema?.collections[slug]

  const handleSubmit = async (data: Record<string, unknown>) => {
    const id = await create(data)
    router.replace(`/(admin)/collections/${slug}/${id}`)
  }

  if (!isReady || !schemaMap) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ title: `New ${collectionLabel}` }} />
        {!isReady ? (
          <ActivityIndicator size="large" />
        ) : (
          <Text className="text-base text-ink-muted">Schema not available</Text>
        )}
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
