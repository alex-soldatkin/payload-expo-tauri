/**
 * Globals index – lists all visible globals from the menuModel.
 */
import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'

import { getGlobalLabel, useMenuModel } from '@payload-universal/admin-native'

export default function GlobalsIndexScreen() {
  const router = useRouter()
  const menuModel = useMenuModel()
  const headerHeight = useHeaderHeight()

  const visibleGlobals = menuModel?.globals.filter((g) => !g.hidden) ?? []
  const groups = menuModel?.groups ?? []

  const ungrouped = visibleGlobals.filter((g) => !g.group)
  const grouped = groups.map((group) => ({
    name: group,
    globals: visibleGlobals.filter((g) => g.group === group),
  }))

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingTop: headerHeight + 8 }}
      contentContainerClassName="px-5 pb-10"
    >
      {ungrouped.map((g) => (
        <Pressable
          key={g.slug}
          className="mb-2 rounded-2xl bg-surface p-4"
          onPress={() => router.push(`/(admin)/globals/${g.slug}`)}
        >
          <Text className="text-base font-semibold text-ink">
            {getGlobalLabel(menuModel!, g.slug)}
          </Text>
          <Text className="mt-0.5 text-xs text-ink-muted">{g.slug}</Text>
        </Pressable>
      ))}

      {grouped.map(
        (group) =>
          group.globals.length > 0 && (
            <View key={group.name} className="mt-4">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                {group.name}
              </Text>
              {group.globals.map((g) => (
                <Pressable
                  key={g.slug}
                  className="mb-2 rounded-2xl bg-surface p-4"
                  onPress={() => router.push(`/(admin)/globals/${g.slug}`)}
                >
                  <Text className="text-base font-semibold text-ink">
                    {getGlobalLabel(menuModel!, g.slug)}
                  </Text>
                  <Text className="mt-0.5 text-xs text-ink-muted">{g.slug}</Text>
                </Pressable>
              ))}
            </View>
          ),
      )}

      {visibleGlobals.length === 0 && (
        <View className="items-center justify-center py-20">
          <Text className="text-base text-ink-muted">No globals configured</Text>
        </View>
      )}
    </ScrollView>
  )
}
