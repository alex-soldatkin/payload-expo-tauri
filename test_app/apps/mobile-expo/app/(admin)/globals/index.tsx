/**
 * Globals index – lists all visible globals from the menuModel.
 *
 * On tablet, globals are displayed in a responsive multi-column grid.
 */
import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'

import { getGlobalLabel, useMenuModel } from '@payload-universal/admin-native'
import { useResponsive } from '@/hooks/useResponsive'

const GRID_GAP = 8

export default function GlobalsIndexScreen() {
  const router = useRouter()
  const menuModel = useMenuModel()
  const headerHeight = useHeaderHeight()
  const { columns } = useResponsive()

  const visibleGlobals = menuModel?.globals.filter((g) => !g.hidden) ?? []
  const groups = menuModel?.groups ?? []

  const ungrouped = visibleGlobals.filter((g) => !g.group)
  const grouped = groups.map((group) => ({
    name: group,
    globals: visibleGlobals.filter((g) => g.group === group),
  }))

  // Grid helpers – percentage-based flex so cells naturally resize with the container
  const gridRow = columns > 1
    ? { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: GRID_GAP }
    : undefined
  const gridCell = columns > 1
    ? columns >= 3
      ? { flexGrow: 1, flexShrink: 0, flexBasis: '30%' as const, maxWidth: '33.33%' as const }
      : { flexGrow: 1, flexShrink: 0, flexBasis: '46%' as const }
    : undefined

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingTop: headerHeight + 8, paddingBottom: 40, paddingHorizontal: columns > 1 ? 32 : 20 }}
    >
      <View style={gridRow}>
        {ungrouped.map((g) => (
          <View key={g.slug} style={gridCell}>
            <Pressable
              className="mb-2 rounded-2xl bg-surface p-4"
              onPress={() => router.push(`/(admin)/globals/${g.slug}`)}
            >
              <Text className="text-base font-semibold text-ink">
                {getGlobalLabel(menuModel!, g.slug)}
              </Text>
              <Text className="mt-0.5 text-xs text-ink-muted">{g.slug}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {grouped.map(
        (group) =>
          group.globals.length > 0 && (
            <View key={group.name} className="mt-4">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                {group.name}
              </Text>
              <View style={gridRow}>
                {group.globals.map((g) => (
                  <View key={g.slug} style={gridCell}>
                    <Pressable
                      className="mb-2 rounded-2xl bg-surface p-4"
                      onPress={() => router.push(`/(admin)/globals/${g.slug}`)}
                    >
                      <Text className="text-base font-semibold text-ink">
                        {getGlobalLabel(menuModel!, g.slug)}
                      </Text>
                      <Text className="mt-0.5 text-xs text-ink-muted">{g.slug}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
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
