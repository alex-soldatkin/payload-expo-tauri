/**
 * Document list for a collection — always local-first.
 *
 * - Header icons: ⚙ Settings, ▽ Filter, + Create
 * - Swipe left to delete (with confirmation)
 * - Shake to undo the last delete
 * - Link.Preview (long-press peek) rendered inside Expo Router tree
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import { Link, Stack, useLocalSearchParams, useRouter, useIsPreview } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Filter, Plus, Settings } from 'lucide-react-native'
import { DeviceMotion } from 'expo-sensors'

import {
  DocumentList,
  getCollectionLabel,
  useAdminSchema,
  useMenuModel,
  useToast,
} from '@payload-universal/admin-native'
import { useLocalDB, useLocalCollection, useLocalDBStatus, useLocalMutations } from '@payload-universal/local-db'

const SUMMARY_FIELDS_KEY_PREFIX = 'card_summary_fields:'
const SHAKE_THRESHOLD = 1.5 // acceleration magnitude to trigger undo

export default function CollectionDocumentsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const menuModel = useMenuModel()
  const schema = useAdminSchema()
  const headerHeight = useHeaderHeight()
  const toast = useToast()
  const isPreview = useIsPreview()
  const [searchText, setSearchText] = useState('')

  const label = menuModel ? getCollectionLabel(menuModel, slug, true) : slug
  const schemaMap = schema?.collections[slug]
  const collectionMeta = menuModel?.collections.find((c) => c.slug === slug)
  const useAsTitle = collectionMeta?.useAsTitle

  // Always use local data — reactive, instant updates
  const localDB = useLocalDB()
  const { isReady } = useLocalDBStatus()
  const localResult = useLocalCollection(localDB, slug)
  const { remove } = useLocalMutations(localDB, slug)

  // Persisted summary field selection
  const [summaryFields, setSummaryFields] = useState<string[]>([])
  const [summaryPickerOpen, setSummaryPickerOpen] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

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

  // --- Swipe to delete + shake to undo ---
  const lastDeletedRef = useRef<{ id: string; data: Record<string, unknown> } | null>(null)

  const handleDelete = useCallback(
    async (doc: Record<string, unknown>) => {
      const id = String(doc.id)
      // Stash the doc data for undo
      lastDeletedRef.current = { id, data: { ...doc } }
      await remove(id)
      toast.showToast('Deleted — shake to undo', { type: 'info', duration: 4000 })
    },
    [remove, toast],
  )

  // Shake to undo: listen for device motion and detect shake gesture
  useEffect(() => {
    if (isPreview) return

    let lastShake = 0
    const sub = DeviceMotion.addListener(({ acceleration }) => {
      if (!acceleration) return
      const mag = Math.sqrt(
        (acceleration.x ?? 0) ** 2 +
        (acceleration.y ?? 0) ** 2 +
        (acceleration.z ?? 0) ** 2,
      )
      const now = Date.now()
      if (mag > SHAKE_THRESHOLD && now - lastShake > 2000) {
        lastShake = now
        const deleted = lastDeletedRef.current
        if (deleted) {
          lastDeletedRef.current = null
          // Re-insert the deleted document
          const col = localDB?.collections[slug]
          if (col) {
            const { _deleted, _rev, _meta, _attachments, _locallyModified, ...cleanData } = deleted.data as any
            col.upsert({
              ...cleanData,
              id: deleted.id,
              _deleted: false,
              _locallyModified: true,
              updatedAt: new Date().toISOString(),
            } as any).then(() => {
              toast.showToast('Undo successful', { type: 'success', duration: 2000 })
            }).catch(() => {
              toast.showToast('Undo failed', { type: 'error' })
            })
          }
        }
      }
    })

    DeviceMotion.setUpdateInterval(100)

    return () => sub.remove()
  }, [isPreview, localDB, slug, toast])

  // Link.Preview row renderer
  const renderRow = useCallback(
    ({ item, rowContent, onPress }: { item: Record<string, unknown>; rowContent: React.ReactElement; onPress: () => void }) => {
      const href = `/(admin)/collections/${slug}/${item.id as string}`
      return (
        <Link href={href as any} push>
          <Link.Trigger>{rowContent}</Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction icon="doc.text" onPress={onPress}>
              Open
            </Link.MenuAction>
          </Link.Menu>
        </Link>
      )
    },
    [slug],
  )

  return (
    <View className="flex-1 bg-paper">
      {!isPreview && (
        <Stack.Screen
          options={{
            title: label,
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginRight: 4 }}>
                <Pressable onPress={() => setSummaryPickerOpen(true)} hitSlop={8}>
                  <Settings size={22} color="#1f1f1f" />
                </Pressable>
                <Pressable onPress={() => setFilterSheetOpen(true)} hitSlop={8}>
                  <Filter size={22} color="#1f1f1f" />
                </Pressable>
                <Pressable onPress={() => router.push(`/(admin)/collections/${slug}/create`)} hitSlop={8}>
                  <Plus size={22} color="#1f1f1f" />
                </Pressable>
              </View>
            ),
            headerSearchBarOptions: {
              placeholder: `Search ${label}...`,
              hideWhenScrolling: false,
              autoCapitalize: 'none',
              onChangeText: (e) => setSearchText(e.nativeEvent.text),
              onCancelButtonPress: () => setSearchText(''),
            },
          }}
        />
      )}
      <DocumentList
        collection={slug}
        searchText={searchText}
        schemaMap={schemaMap}
        titleField={useAsTitle}
        searchFields={useAsTitle ? [useAsTitle] : undefined}
        onPress={(doc) => {
          if (!isPreview) router.push(`/(admin)/collections/${slug}/${doc.id as string}`)
        }}
        onDelete={handleDelete}
        renderRow={renderRow}
        summaryFields={summaryFields}
        onSummaryFieldsChange={handleSummaryFieldsChange}
        summaryPickerOpen={summaryPickerOpen}
        onSummaryPickerClose={() => setSummaryPickerOpen(false)}
        filterSheetOpen={filterSheetOpen}
        onFilterSheetClose={() => setFilterSheetOpen(false)}
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
