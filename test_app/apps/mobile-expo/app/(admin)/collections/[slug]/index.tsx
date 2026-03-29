/**
 * Document list for a collection.
 * Uses the DocumentList component from admin-native with:
 *  - Native iOS search bar integrated into the navigation header
 *  - Schema-driven field filters via bottom sheet
 *  - Active filter chip indicators
 */
import React, { useState } from 'react'
import { View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'

import {
  DocumentList,
  getCollectionLabel,
  useAdminSchema,
  useMenuModel,
} from '@payload-universal/admin-native'

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
      />
    </View>
  )
}
