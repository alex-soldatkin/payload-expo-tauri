/**
 * Collections index – lists all visible collections from the menuModel,
 * grouped by admin.group just like the web admin sidebar.
 */
import React, { useMemo } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'

import {
  CollectionIcon,
  getCollectionLabel,
  useMenuModel,
} from '@payload-universal/admin-native'

import { useHeaderScrollY } from '@/components/HeaderScrollContext'

export default function CollectionsIndexScreen() {
  const router = useRouter()
  const menuModel = useMenuModel()
  const headerHeight = useHeaderHeight()
  const scrollY = useHeaderScrollY()

  const scrollHandler = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true },
      ),
    [scrollY],
  )

  const visibleCollections = menuModel?.collections.filter((c) => !c.hidden) ?? []
  const groups = menuModel?.groups ?? []

  const ungrouped = visibleCollections.filter((c) => !c.group)
  const grouped = groups.map((group) => ({
    name: group,
    collections: visibleCollections.filter((c) => c.group === group),
  }))

  return (
    <Animated.ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingTop: headerHeight + 8 }}
      contentContainerClassName="px-5 pb-10"
      onScroll={scrollHandler}
      scrollEventThrottle={16}
    >
      {/* Ungrouped */}
      {ungrouped.map((col) => (
        <Pressable
          key={col.slug}
          className="mb-2 flex-row items-center gap-3 rounded-2xl bg-surface p-4"
          onPress={() => router.push(`/(admin)/collections/${col.slug}`)}
        >
          <CollectionIcon icon={col.icon} size={22} color="#555" />
          <View>
            <Text className="text-base font-semibold text-ink">
              {getCollectionLabel(menuModel!, col.slug)}
            </Text>
            <Text className="mt-0.5 text-xs text-ink-muted">{col.slug}</Text>
          </View>
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
                  className="mb-2 flex-row items-center gap-3 rounded-2xl bg-surface p-4"
                  onPress={() => router.push(`/(admin)/collections/${col.slug}`)}
                >
                  <CollectionIcon icon={col.icon} size={22} color="#555" />
                  <View>
                    <Text className="text-base font-semibold text-ink">
                      {getCollectionLabel(menuModel!, col.slug)}
                    </Text>
                    <Text className="mt-0.5 text-xs text-ink-muted">{col.slug}</Text>
                  </View>
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
    </Animated.ScrollView>
  )
}
