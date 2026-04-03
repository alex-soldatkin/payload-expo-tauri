/**
 * Collections index – lists all visible collections from the menuModel,
 * grouped by admin.group just like the web admin sidebar.
 *
 * On tablet, collections are displayed in a responsive multi-column grid.
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
import { useResponsive } from '@/hooks/useResponsive'

const GRID_GAP = 8

export default function CollectionsIndexScreen() {
  const router = useRouter()
  const menuModel = useMenuModel()
  const headerHeight = useHeaderHeight()
  const scrollY = useHeaderScrollY()
  const { columns } = useResponsive()

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

  // Grid helpers – on phone (columns === 1), styles are undefined → normal stacking
  const gridRow = columns > 1
    ? { flexDirection: 'row' as const, flexWrap: 'wrap' as const, margin: -(GRID_GAP / 2) }
    : undefined
  const gridCell = columns > 1
    ? { width: `${100 / columns}%` as any, padding: GRID_GAP / 2 }
    : undefined

  return (
    <Animated.ScrollView
      style={{ flex: 1, backgroundColor: '#f6f4f1' }}
      contentContainerStyle={{ paddingTop: headerHeight + 8, paddingBottom: 40, paddingHorizontal: columns > 1 ? 32 : 20, flexGrow: 1 }}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
    >
      {/* Ungrouped */}
      <View style={gridRow}>
        {ungrouped.map((col) => (
          <View key={col.slug} style={gridCell}>
            <Pressable
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
          </View>
        ))}
      </View>

      {/* Grouped */}
      {grouped.map(
        (group) =>
          group.collections.length > 0 && (
            <View key={group.name} className="mt-4">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                {group.name}
              </Text>
              <View style={gridRow}>
                {group.collections.map((col) => (
                  <View key={col.slug} style={gridCell}>
                    <Pressable
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
                  </View>
                ))}
              </View>
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
