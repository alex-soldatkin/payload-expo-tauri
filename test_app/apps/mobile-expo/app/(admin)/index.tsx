/**
 * Dashboard / Home screen – schema-driven overview.
 * Mirrors the web admin dashboard but optimised for mobile.
 *
 * Shows:
 *  - Connection status & schema timestamp
 *  - Collection shortcuts (grouped by admin.group from the menuModel)
 *  - Global shortcuts
 */
import React from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import {
  CollectionIcon,
  getCollectionLabel,
  getGlobalLabel,
  useAdminSchema,
  useMenuModel,
  usePayloadNative,
} from '@payload-universal/admin-native'

export default function DashboardScreen() {
  const router = useRouter()
  const { refreshSchema, isSchemaLoading, schemaError } = usePayloadNative()
  const schema = useAdminSchema()
  const menuModel = useMenuModel()

  const visibleCollections = menuModel?.collections.filter((c) => !c.hidden) ?? []
  const visibleGlobals = menuModel?.globals.filter((g) => !g.hidden) ?? []
  const groups = menuModel?.groups ?? []

  // Group collections by admin.group
  const ungrouped = visibleCollections.filter((c) => !c.group)
  const grouped = groups.map((group) => ({
    name: group,
    collections: visibleCollections.filter((c) => c.group === group),
  }))

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="px-5 pb-10 pt-14"
      refreshControl={
        <RefreshControl refreshing={isSchemaLoading} onRefresh={refreshSchema} />
      }
    >
      {/* Header */}
      <Text className="text-2xl font-bold text-ink">Dashboard</Text>
      {schema?.generatedAt && (
        <Text className="mt-1 text-xs text-ink-muted">
          Schema: {new Date(schema.generatedAt).toLocaleString()}
        </Text>
      )}

      {schemaError && (
        <View className="mt-3 rounded-xl bg-red-50 px-4 py-3">
          <Text className="text-sm text-red-700">{schemaError}</Text>
        </View>
      )}

      {/* Ungrouped collections */}
      {ungrouped.length > 0 && (
        <View className="mt-6">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Collections
          </Text>
          {ungrouped.map((col) => (
            <CollectionCard
              key={col.slug}
              slug={col.slug}
              label={getCollectionLabel(menuModel!, col.slug)}
              drafts={col.drafts}
              icon={col.icon}
              onPress={() => router.push(`/(admin)/collections/${col.slug}`)}
            />
          ))}
        </View>
      )}

      {/* Grouped collections */}
      {grouped.map(
        (group) =>
          group.collections.length > 0 && (
            <View key={group.name} className="mt-6">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                {group.name}
              </Text>
              {group.collections.map((col) => (
                <CollectionCard
                  key={col.slug}
                  slug={col.slug}
                  label={getCollectionLabel(menuModel!, col.slug)}
                  drafts={col.drafts}
                  icon={col.icon}
                  onPress={() => router.push(`/(admin)/collections/${col.slug}`)}
                />
              ))}
            </View>
          ),
      )}

      {/* Globals */}
      {visibleGlobals.length > 0 && (
        <View className="mt-6">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Globals
          </Text>
          {visibleGlobals.map((g) => (
            <Pressable
              key={g.slug}
              className="mb-2 rounded-2xl bg-surface p-4"
              onPress={() => router.push(`/(admin)/globals/${g.slug}`)}
            >
              <Text className="text-base font-semibold text-ink">
                {getGlobalLabel(menuModel!, g.slug)}
              </Text>
              {g.drafts && (
                <Text className="mt-1 text-xs text-ink-muted">Drafts enabled</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {/* Summary */}
      {schema && (
        <View className="mt-8 rounded-2xl bg-surface p-4">
          <Text className="text-sm font-semibold text-ink">Schema Summary</Text>
          <Text className="mt-1 text-xs text-ink-muted">
            {Object.keys(schema.collections).length} collections
            {' · '}
            {Object.keys(schema.globals).length} globals
            {menuModel?.groups.length ? ` · ${menuModel.groups.length} groups` : ''}
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

function CollectionCard({
  slug,
  label,
  drafts,
  icon,
  onPress,
}: {
  slug: string
  label: string
  drafts?: boolean
  icon?: string
  onPress: () => void
}) {
  return (
    <Pressable
      className="mb-2 flex-row items-center gap-3 rounded-2xl bg-surface p-4"
      onPress={onPress}
    >
      <CollectionIcon icon={icon} size={22} color="#555" />
      <View className="flex-1">
        <Text className="text-base font-semibold text-ink">{label}</Text>
        <View className="mt-1 flex-row gap-2">
          <Text className="text-xs text-ink-muted">{slug}</Text>
          {drafts && (
            <View className="rounded bg-yellow-100 px-1.5 py-0.5">
              <Text className="text-[10px] font-semibold text-yellow-800">DRAFTS</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  )
}
