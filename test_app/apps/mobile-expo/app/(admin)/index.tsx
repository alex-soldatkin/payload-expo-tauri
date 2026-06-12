/**
 * Dashboard / Home screen – schema-driven overview.
 * Mirrors the web admin dashboard but optimised for mobile.
 *
 * Shows:
 *  - Connection status & schema timestamp
 *  - Collection shortcuts (grouped by admin.group from the menuModel)
 *  - Global shortcuts
 *
 * On tablet, cards are displayed in a responsive multi-column grid.
 */
import React, { useMemo } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import {
  CollectionIcon,
  getCollectionLabel,
  getGlobalLabel,
  useAdminSchema,
  useListColors,
  useMenuModel,
  usePayloadNative,
} from '@payload-universal/admin-native'
import { useLocalDB } from '@payload-universal/local-db'
import { useResponsive } from '@/hooks/useResponsive'
import { useCollectionCounts } from '@/src/hooks/useCollectionCounts'

// Optional: GlassView for liquid glass cards on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

const GRID_GAP = 8

export default function DashboardScreen() {
  const router = useRouter()
  const { refreshSchema, isSchemaLoading, schemaError } = usePayloadNative()
  const schema = useAdminSchema()
  const menuModel = useMenuModel()
  const { columns } = useResponsive()

  const visibleCollections = menuModel?.collections.filter((c) => !c.hidden) ?? []
  const visibleGlobals = menuModel?.globals.filter((g) => !g.hidden) ?? []
  const groups = menuModel?.groups ?? []

  // Live document counts per collection — reactive RxDB count() subscriptions
  const localDB = useLocalDB()
  const collectionSlugs = useMemo(
    () => visibleCollections.map((c) => c.slug),
    // menuModel identity is stable between schema refreshes
    [menuModel],
  )
  const counts = useCollectionCounts(localDB, collectionSlugs)

  // Group collections by admin.group
  const ungrouped = visibleCollections.filter((c) => !c.group)
  const grouped = groups.map((group) => ({
    name: group,
    collections: visibleCollections.filter((c) => c.group === group),
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
      contentContainerStyle={{ paddingBottom: 40, paddingTop: 56, paddingHorizontal: columns > 1 ? 32 : 20, flexGrow: 1 }}
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
        <View className="mt-3 rounded-xl bg-danger-bg px-4 py-3">
          <Text className="text-sm text-danger">{schemaError}</Text>
        </View>
      )}

      {/* Ungrouped collections */}
      {ungrouped.length > 0 && (
        <View className="mt-6">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Collections
          </Text>
          <View style={gridRow}>
            {ungrouped.map((col) => (
              <View key={col.slug} style={gridCell}>
                <CollectionCard
                  slug={col.slug}
                  label={getCollectionLabel(menuModel!, col.slug)}
                  drafts={col.drafts}
                  icon={col.icon}
                  count={counts[col.slug]}
                  onPress={() => router.push(`/(admin)/collections/${col.slug}`)}
                />
              </View>
            ))}
          </View>
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
              <View style={gridRow}>
                {group.collections.map((col) => (
                  <View key={col.slug} style={gridCell}>
                    <CollectionCard
                      slug={col.slug}
                      label={getCollectionLabel(menuModel!, col.slug)}
                      drafts={col.drafts}
                      icon={col.icon}
                      count={counts[col.slug]}
                      onPress={() => router.push(`/(admin)/collections/${col.slug}`)}
                    />
                  </View>
                ))}
              </View>
            </View>
          ),
      )}

      {/* Globals */}
      {visibleGlobals.length > 0 && (
        <View className="mt-6">
          <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Globals
          </Text>
          <View style={gridRow}>
            {visibleGlobals.map((g) => (
              <View key={g.slug} style={gridCell}>
                <GlobalCard
                  slug={g.slug}
                  label={getGlobalLabel(menuModel!, g.slug)}
                  drafts={g.drafts}
                  icon={g.icon}
                  onPress={() => router.push(`/(admin)/globals/${g.slug}`)}
                />
              </View>
            ))}
          </View>
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

/** Settings-style count badge + disclosure chevron (right accessory). */
function RowAccessory({ count }: { count?: number }) {
  // Scheme-aware chevron/badge — rgba(120,120,128,…) is iOS systemGray fill
  // which reads correctly in both schemes; the chevron uses the palette.
  const { colors: c } = useListColors()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {typeof count === 'number' && (
        <View
          style={{
            minWidth: 24,
            alignItems: 'center',
            borderRadius: 12,
            backgroundColor: 'rgba(120,120,128,0.16)',
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#8E8E93', fontVariant: ['tabular-nums'] }}>
            {count}
          </Text>
        </View>
      )}
      <Text style={{ fontSize: 18, color: c.tertiary, fontWeight: '400' }}>›</Text>
    </View>
  )
}

function CollectionCard({
  slug,
  label,
  drafts,
  icon,
  count,
  onPress,
}: {
  slug: string
  label: string
  drafts?: boolean
  icon?: string
  /** Live document count from the local RxDB (undefined while loading). */
  count?: number
  onPress: () => void
}) {
  const content = (
    <>
      <CollectionIcon icon={icon} size={22} color="#8E8E93" />
      <View className="flex-1">
        <Text className="text-base font-semibold text-ink">{label}</Text>
        <View className="mt-1 flex-row gap-2">
          <Text className="text-xs text-ink-muted">{slug}</Text>
          {drafts && (
            <View className="rounded bg-warn-bg px-1.5 py-0.5">
              <Text className="text-[10px] font-semibold text-warn">DRAFTS</Text>
            </View>
          )}
        </View>
      </View>
      <RowAccessory count={count} />
    </>
  )

  if (liquidGlassAvailable && GlassView) {
    return (
      <Pressable onPress={onPress} style={{ marginBottom: 8 }}>
        <GlassView
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 }}
          isInteractive
          glassEffectStyle="regular"
        >
          {content}
        </GlassView>
      </Pressable>
    )
  }

  return (
    <Pressable
      className="mb-2 flex-row items-center gap-3 rounded-2xl bg-surface p-4"
      onPress={onPress}
    >
      {content}
    </Pressable>
  )
}

function GlobalCard({
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
  const content = (
    <>
      <CollectionIcon icon={icon} size={22} color="#8E8E93" />
      <View className="flex-1">
        <Text className="text-base font-semibold text-ink">{label}</Text>
        <View className="mt-1 flex-row gap-2">
          <Text className="text-xs text-ink-muted">{slug}</Text>
          {drafts && (
            <View className="rounded bg-warn-bg px-1.5 py-0.5">
              <Text className="text-[10px] font-semibold text-warn">DRAFTS</Text>
            </View>
          )}
        </View>
      </View>
      <RowAccessory />
    </>
  )

  if (liquidGlassAvailable && GlassView) {
    return (
      <Pressable onPress={onPress} style={{ marginBottom: 8 }}>
        <GlassView
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 }}
          isInteractive
          glassEffectStyle="regular"
        >
          {content}
        </GlassView>
      </Pressable>
    )
  }

  return (
    <Pressable
      className="mb-2 flex-row items-center gap-3 rounded-2xl bg-surface p-4"
      onPress={onPress}
    >
      {content}
    </Pressable>
  )
}
