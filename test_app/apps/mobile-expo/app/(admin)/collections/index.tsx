/**
 * Collections index – lists all visible collections from the menuModel,
 * grouped by admin.group just like the web admin sidebar.
 */
import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'

import {
  getCollectionLabel,
  useMenuModel,
} from '@payload-universal/admin-native'

export default function CollectionsIndexScreen() {
  const router = useRouter()
  const menuModel = useMenuModel()
  const headerHeight = useHeaderHeight()

  const visibleCollections = menuModel?.collections.filter((c) => !c.hidden) ?? []
  const groups = menuModel?.groups ?? []

  const ungrouped = visibleCollections.filter((c) => !c.group)
  const grouped = groups.map((group) => ({
    name: group,
    collections: visibleCollections.filter((c) => c.group === group),
  }))

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingTop: headerHeight + 8 }}
      contentContainerClassName="px-5 pb-10"
    >
      {/* Ungrouped */}
      {ungrouped.map((col) => (
        <Pressable
          key={col.slug}
          className="mb-2 rounded-2xl bg-surface p-4"
          onPress={() => router.push(`/(admin)/collections/${col.slug}`)}
        >
          <Text className="text-base font-semibold text-ink">
            {getCollectionLabel(menuModel!, col.slug)}
          </Text>
          <Text className="mt-0.5 text-xs text-ink-muted">{col.slug}</Text>
        </Pressable>
      ))}

      {/* Grouped */}
      {grouped.map(
        (group) =>
          group.collections.length > 0 && (
            <View key={group.name} className="mt-4">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                {group.name}
              </Text>
              {group.collections.map((col) => (
                <Pressable
                  key={col.slug}
                  className="mb-2 rounded-2xl bg-surface p-4"
                  onPress={() => router.push(`/(admin)/collections/${col.slug}`)}
                >
                  <Text className="text-base font-semibold text-ink">
                    {getCollectionLabel(menuModel!, col.slug)}
                  </Text>
                  <Text className="mt-0.5 text-xs text-ink-muted">{col.slug}</Text>
                </Pressable>
              ))}
            </View>
          ),
      )}

      {visibleCollections.length === 0 && (
        <View className="items-center justify-center py-20">
          <Text className="text-base text-ink-muted">No collections available</Text>
        </View>
      )}
    </ScrollView>
  )
}
