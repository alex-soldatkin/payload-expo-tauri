/**
 * Global edit screen – renders the DocumentForm for a global's fields.
 */
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Text, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'

import {
  DocumentForm,
  getGlobalLabel,
  payloadApi,
  useAdminSchema,
  useMenuModel,
  usePayloadNative,
} from '@payload-universal/admin-native'

export default function GlobalEditScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const headerHeight = useHeaderHeight()
  const { baseURL, auth } = usePayloadNative()
  const schema = useAdminSchema()
  const menuModel = useMenuModel()

  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const label = menuModel ? getGlobalLabel(menuModel, slug) : slug
  const schemaMap = schema?.globals[slug]

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const result = await payloadApi.findGlobal({ baseURL, token: auth.token }, slug)
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load global')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [baseURL, auth.token, slug])

  const handleSubmit = async (formData: Record<string, unknown>) => {
    await payloadApi.updateGlobal({ baseURL, token: auth.token }, slug, formData)
    // Refresh
    const updated = await payloadApi.findGlobal({ baseURL, token: auth.token }, slug)
    setData(updated)
    Alert.alert('Saved', `${label} updated successfully.`)
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ title: label }} />
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (error || !schemaMap) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6">
        <Stack.Screen options={{ title: label }} />
        <Text className="text-base text-red-600">{error || 'Schema not available'}</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen options={{ title: label }} />
      <DocumentForm
        schemaMap={schemaMap}
        slug={slug}
        initialData={data ?? {}}
        onSubmit={handleSubmit}
        submitLabel="Save"
        contentInsetTop={headerHeight}
      />
    </View>
  )
}
