/**
 * Document edit screen — always local-first.
 *
 * Reads from local RxDB (reactive — updates instantly when data changes).
 * Writes go to local DB first (instant), sync pushes to server in background.
 */
import React, { useRef } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'
import { Save } from 'lucide-react-native'

import {
  DocumentForm,
  getCollectionLabel,
  getDocumentTitle,
  useAdminSchema,
  useMenuModel,
} from '@payload-universal/admin-native'
import { useLocalDB, useLocalDocument, useLocalMutations, useLocalDBStatus } from '@payload-universal/local-db'

export default function DocumentEditScreen() {
  const { slug, id } = useLocalSearchParams<{ slug: string; id: string }>()
  const router = useRouter()
  const headerHeight = useHeaderHeight()
  const schema = useAdminSchema()
  const menuModel = useMenuModel()
  const localDB = useLocalDB()
  const { isReady } = useLocalDBStatus()

  const formRef = useRef<{ submit: () => void }>(null)

  // Reactive local document — updates instantly when RxDB data changes
  const { doc, loading, error } = useLocalDocument(localDB, slug, id)
  const { update, remove } = useLocalMutations(localDB, slug)

  const collectionLabel = menuModel ? getCollectionLabel(menuModel, slug, false) : slug
  const schemaMap = schema?.collections[slug]
  const useAsTitle = menuModel?.collections.find((c) => c.slug === slug)?.useAsTitle

  const handleSubmit = async (data: Record<string, unknown>) => {
    await update(id, data)
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete',
      `Are you sure you want to delete this ${collectionLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(id)
              router.back()
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed')
            }
          },
        },
      ],
    )
  }

  const title = doc ? getDocumentTitle(doc as Record<string, unknown>, useAsTitle) : 'Loading...'

  if (!isReady || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ title: collectionLabel }} />
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (error || !schemaMap) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6">
        <Stack.Screen options={{ title: collectionLabel }} />
        <Text className="text-base text-red-600">{error || 'Schema not available'}</Text>
        <Pressable className="mt-4 rounded-xl bg-black px-6 py-3" onPress={() => router.back()}>
          <Text className="text-sm font-semibold text-white">Go Back</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen
        options={{
          title: title,
          headerRight: () => (
            <Pressable onPress={() => formRef.current?.submit()} style={{ marginRight: 4 }}>
              <Save size={22} color="#1f1f1f" />
            </Pressable>
          ),
        }}
      />
      <DocumentForm
        ref={formRef}
        schemaMap={schemaMap}
        slug={slug}
        initialData={(doc as Record<string, unknown>) ?? {}}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        submitLabel="Update"
        contentInsetTop={headerHeight}
      />
    </View>
  )
}
