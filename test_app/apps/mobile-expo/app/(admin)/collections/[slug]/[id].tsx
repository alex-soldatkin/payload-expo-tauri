/**
 * Document edit screen — always local-first.
 *
 * Reads from local RxDB (reactive — updates instantly when data changes).
 * Writes go to local DB first (instant), sync pushes to server in background.
 *
 * Supports:
 *  - Draft / Publish: when the collection has `versions.drafts` enabled,
 *    shows dual Save Draft / Publish buttons and a status pill.
 *  - Versions: when the collection has `versions` enabled, shows a versions
 *    option under the (...) menu. Versions are fetched from the server
 *    directly (not local-first) and can be compared and restored.
 */
import React, { useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'
import { MoreHorizontal, Save } from 'lucide-react-native'

import {
  DocumentActionsMenu,
  DocumentForm,
  getCollectionLabel,
  getDocumentTitle,
  useAdminSchema,
  useBaseURL,
  useAuth,
  useMenuModel,
  VersionsBottomSheet,
} from '@payload-universal/admin-native'
import { useLocalDB, useLocalDocument, useLocalMutations, useLocalDBStatus } from '@payload-universal/local-db'

export default function DocumentEditScreen() {
  const { slug, id } = useLocalSearchParams<{ slug: string; id: string }>()
  const router = useRouter()
  const headerHeight = useHeaderHeight()
  const schema = useAdminSchema()
  const menuModel = useMenuModel()
  const localDB = useLocalDB()
  const { isReady } = useLocalDBStatus()
  const baseURL = useBaseURL()
  const { token } = useAuth()

  const formRef = useRef<{ submit: () => void; submitWithStatus: (s: 'draft' | 'published') => void }>(null)

  // Reactive local document — updates instantly when RxDB data changes
  const { doc, loading, error } = useLocalDocument(localDB, slug, id)
  const { update, remove } = useLocalMutations(localDB, slug)

  // Collection metadata from the menu model
  const collectionMeta = menuModel?.collections.find((c) => c.slug === slug)
  const collectionLabel = menuModel ? getCollectionLabel(menuModel, slug, false) : slug
  const schemaMap = schema?.collections[slug]
  const useAsTitle = collectionMeta?.useAsTitle

  // Feature flags from collection config
  const hasDrafts = collectionMeta?.drafts ?? false
  const hasVersions = collectionMeta?.versions ?? false

  // Bottom sheet state
  const [actionsMenuVisible, setActionsMenuVisible] = useState(false)
  const [versionsVisible, setVersionsVisible] = useState(false)

  // API config for direct server calls (versions are server-side only)
  const apiConfig = useMemo(() => ({ baseURL, token }), [baseURL, token])

  const handleSubmit = async (data: Record<string, unknown>, options?: { status?: 'draft' | 'published' }) => {
    // Merge status into the data for the local DB write
    const writeData = options?.status
      ? { ...data, _status: options.status }
      : data
    await update(id, writeData)
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete',
      `Are you sure you want to delete this ${collectionLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(id)
              router.back()
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed')
            }
          },
        },
      ],
    )
  }

  // After a version restore, trigger an immediate pull to pick up the
  // restored data from the server into the local DB.
  const handleVersionRestore = () => {
    localDB?.pullNow(slug)
  }

  const title = doc ? getDocumentTitle(doc as Record<string, unknown>, useAsTitle) : 'Loading...'
  const docStatus = (doc as Record<string, unknown> | null)?._status as string | undefined

  if (!isReady || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ title: collectionLabel }} />
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (error || !schemaMap) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6">
        <Stack.Screen options={{ title: collectionLabel }} />
        <Text className="text-base text-red-600">{error || 'Schema not available'}</Text>
        <Pressable className="mt-4 rounded-xl bg-black px-6 py-3" onPress={() => router.back()}>
          <Text className="text-sm font-semibold text-white">Go Back</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen
        options={{
          title: title,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 4 }}>
              {/* Actions menu (versions, draft/publish actions) */}
              {(hasVersions || hasDrafts) && (
                <Pressable onPress={() => setActionsMenuVisible(true)} hitSlop={8}>
                  <MoreHorizontal size={22} color="#1f1f1f" />
                </Pressable>
              )}
              {/* Save button */}
              <Pressable
                onPress={() => {
                  if (hasDrafts) {
                    // Default save action: preserve current status
                    const status = (docStatus === 'published' ? 'published' : 'draft') as 'draft' | 'published'
                    formRef.current?.submitWithStatus(status)
                  } else {
                    formRef.current?.submit()
                  }
                }}
                hitSlop={8}
              >
                <Save size={22} color="#1f1f1f" />
              </Pressable>
            </View>
          ),
        }}
      />

      <DocumentForm
        ref={formRef}
        schemaMap={schemaMap}
        slug={slug}
        initialData={(doc as Record<string, unknown>) ?? {}}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        submitLabel={hasDrafts ? undefined : 'Update'}
        draftStatus={hasDrafts ? ((docStatus as 'draft' | 'published') ?? 'draft') : undefined}
        contentInsetTop={headerHeight}
      />

      {/* Actions menu bottom sheet */}
      <DocumentActionsMenu
        visible={actionsMenuVisible}
        onClose={() => setActionsMenuVisible(false)}
        hasVersions={hasVersions}
        hasDrafts={hasDrafts}
        currentStatus={docStatus}
        onViewVersions={() => {
          setActionsMenuVisible(false)
          // Small delay to let the actions menu dismiss before opening versions
          setTimeout(() => setVersionsVisible(true), 300)
        }}
        onSaveDraft={() => {
          formRef.current?.submitWithStatus('draft')
          setActionsMenuVisible(false)
        }}
        onPublish={() => {
          formRef.current?.submitWithStatus('published')
          setActionsMenuVisible(false)
        }}
        onUnpublish={() => {
          formRef.current?.submitWithStatus('draft')
          setActionsMenuVisible(false)
        }}
      />

      {/* Versions bottom sheet */}
      {hasVersions && (
        <VersionsBottomSheet
          visible={versionsVisible}
          onClose={() => setVersionsVisible(false)}
          slug={slug}
          documentId={id}
          apiConfig={apiConfig}
          schemaMap={schemaMap}
          onRestore={handleVersionRestore}
        />
      )}
    </View>
  )
}
