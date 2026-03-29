/**
 * Document edit screen – renders the full DocumentForm driven by the admin schema.
 *
 * Replaces the web admin's edit view. Popovers become bottom sheets,
 * field groups become collapsible sections, and tabs use a segmented control.
 */
import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'
import { Save } from 'lucide-react-native'

import {
  DocumentForm,
  getCollectionLabel,
  getDocumentTitle,
  payloadApi,
  useAdminSchema,
  useMenuModel,
  usePayloadNative,
} from '@payload-universal/admin-native'

export default function DocumentEditScreen() {
  const { slug, id } = useLocalSearchParams<{ slug: string; id: string }>()
  const router = useRouter()
  const headerHeight = useHeaderHeight()
  const { baseURL, auth } = usePayloadNative()
  const schema = useAdminSchema()
  const menuModel = useMenuModel()

  const formRef = useRef<{ submit: () => void }>(null)
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const collectionLabel = menuModel ? getCollectionLabel(menuModel, slug, false) : slug
  const schemaMap = schema?.collections[slug]
  const useAsTitle = menuModel?.collections.find((c) => c.slug === slug)?.useAsTitle

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const result = await payloadApi.findByID(
          { baseURL, token: auth.token },
          slug,
          id,
          { depth: 0 },
        )
        setDoc(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [baseURL, auth.token, slug, id])

  const handleSubmit = async (data: Record<string, unknown>) => {
    await payloadApi.update({ baseURL, token: auth.token }, slug, id, data)
    // Refresh doc
    const updated = await payloadApi.findByID({ baseURL, token: auth.token }, slug, id, { depth: 0 })
    setDoc(updated)
    Alert.alert('Saved', `${collectionLabel} updated successfully.`)
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
              await payloadApi.deleteDoc({ baseURL, token: auth.token }, slug, id)
              router.back()
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed')
            }
          },
        },
      ],
    )
  }

  const title = doc ? getDocumentTitle(doc, useAsTitle) : 'Loading...'

  if (loading) {
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
        initialData={doc ?? {}}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        submitLabel="Update"
        contentInsetTop={headerHeight}
      />
    </View>
  )
}
