/**
 * Document list for a collection — always local-first.
 *
 * Uses useLocalCollection for instant, reactive data from local RxDB.
 * The list updates automatically when documents are created, updated, or deleted.
 *
 * The user can customise which fields appear on each card via the gear icon.
 * Selection is persisted per collection in AsyncStorage.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'
import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  DocumentList,
  getCollectionLabel,
  useAdminSchema,
  useMenuModel,
} from '@payload-universal/admin-native'
import { useLocalDB, useLocalCollection, useLocalDBStatus } from '@payload-universal/local-db'

const SUMMARY_FIELDS_KEY_PREFIX = 'card_summary_fields:'

export default function CollectionDocumentsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const menuModel = useMenuModel()
  const schema = useAdminSchema()
  const headerHeight = useHeaderHeight()
  const [searchText, setSearchText] = useState('')

  const label = menuModel ? getCollectionLabel(menuModel, slug, true) : slug
  const schemaMap = schema?.collections[slug]
  const collectionMeta = menuModel?.collections.find((c) => c.slug === slug)
  const useAsTitle = collectionMeta?.useAsTitle

  // Always use local data — reactive, instant updates
  const localDB = useLocalDB()
  const { isReady } = useLocalDBStatus()
  const localResult = useLocalCollection(localDB, slug)

  // Persisted summary field selection
  const [summaryFields, setSummaryFields] = useState<string[]>([])

  useEffect(() => {
    AsyncStorage.getItem(SUMMARY_FIELDS_KEY_PREFIX + slug)
      .then((val) => {
        if (val) setSummaryFields(JSON.parse(val))
      })
      .catch(() => {})
  }, [slug])

  const handleSummaryFieldsChange = useCallback(
    (fields: string[]) => {
      setSummaryFields(fields)
      AsyncStorage.setItem(SUMMARY_FIELDS_KEY_PREFIX + slug, JSON.stringify(fields)).catch(() => {})
    },
    [slug],
  )

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen
        options={{
          title: label,
          headerSearchBarOptions: {
            placeholder: `Search ${label}...`,
            hideWhenScrolling: false,
            autoCapitalize: 'none',
            onChangeText: (e) => setSearchText(e.nativeEvent.text),
            onCancelButtonPress: () => setSearchText(''),
          },
        }}
      />
      <DocumentList
        collection={slug}
        contentInsetTop={headerHeight}
        searchText={searchText}
        schemaMap={schemaMap}
        titleField={useAsTitle}
        searchFields={useAsTitle ? [useAsTitle] : undefined}
        onPress={(doc) =>
          router.push(`/(admin)/collections/${slug}/${doc.id as string}`)
        }
        onCreate={() => router.push(`/(admin)/collections/${slug}/create`)}
        docHref={(doc) => `/(admin)/collections/${slug}/${doc.id as string}`}
        summaryFields={summaryFields}
        onSummaryFieldsChange={handleSummaryFieldsChange}
        localData={{
          docs: localResult.docs as Record<string, unknown>[],
          totalDocs: localResult.totalDocs,
          loading: localResult.loading || !isReady,
          refetch: localResult.refetch,
        }}
      />
    </View>
  )
}
