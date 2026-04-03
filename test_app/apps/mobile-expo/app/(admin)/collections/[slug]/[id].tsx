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
 *    option under the (...) native menu. Versions are fetched from the server
 *    directly (not local-first) and can be compared and restored.
 */
import React, { useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Animated, Platform, Pressable, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useHeaderHeight } from '@react-navigation/elements'
import { Save } from 'lucide-react-native'

import {
  DocumentActionsMenu,
  DocumentForm,
  extractRootFields,
  getCollectionLabel,
  getDocumentTitle,
  useAdminSchema,
  useBaseURL,
  useAuth,
  useMenuModel,
  VersionsBottomSheet,
} from '@payload-universal/admin-native'
import { useLocalDB, useLocalDocument, useLocalMutations, useLocalDBStatus, useValidatedMutations } from '@payload-universal/local-db'
import { useHeaderScrollY } from '@/components/HeaderScrollContext'

export default function DocumentEditScreen() {
  const { slug, id } = useLocalSearchParams<{ slug: string; id: string }>()
  const router = useRouter()
  const headerHeight = useHeaderHeight()
  const headerScrollY = useHeaderScrollY()
  const editScrollHandler = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: headerScrollY } } }],
        { useNativeDriver: true },
      ),
    [headerScrollY],
  )
  const schema = useAdminSchema()
  const menuModel = useMenuModel()
  const localDB = useLocalDB()
  const { isReady } = useLocalDBStatus()
  const baseURL = useBaseURL()
  const { token } = useAuth()

  const formRef = useRef<{ submit: () => void; submitWithStatus: (s: 'draft' | 'published') => void }>(null)

  // Reactive local document — updates instantly when RxDB data changes
  const { doc, loading, error } = useLocalDocument(localDB, slug, id)
  const { remove } = useLocalMutations(localDB, slug)

  // Collection metadata from the menu model
  const collectionMeta = menuModel?.collections.find((c) => c.slug === slug)
  const collectionLabel = menuModel ? getCollectionLabel(menuModel, slug, false) : slug
  const schemaMap = schema?.collections[slug]
  const useAsTitle = collectionMeta?.useAsTitle

  // Extract root fields from schema for client-side validation
  const rootFields = useMemo(
    () => (schemaMap ? extractRootFields(schemaMap, slug) : []),
    [schemaMap, slug],
  )

  // Validated mutations: hooks + validation run locally BEFORE writing to RxDB
  const {
    update: validatedUpdate,
    errors: validationErrors,
    clearFieldError,
  } = useValidatedMutations(localDB, slug, rootFields)

  // Feature flags from collection config
  const hasDrafts = collectionMeta?.drafts ?? false
  const hasVersions = collectionMeta?.versions ?? false

  // Versions bottom sheet state
  const [versionsVisible, setVersionsVisible] = useState(false)

  // API config for direct server calls (versions are server-side only)
  const apiConfig = useMemo(() => ({ baseURL, token }), [baseURL, token])

  const handleSubmit = async (data: Record<string, unknown>, options?: { status?: 'draft' | 'published' }) => {
    // Merge status into the data for the local DB write
    const writeData = options?.status
      ? { ...data, _status: options.status }
      : data
    const result = await validatedUpdate(id, writeData, (doc as Record<string, unknown>) ?? undefined)
    if (!result.success) {
      // Throw so DocumentForm can display the error banner and toast.
      // The field-level errors are already in validationErrors state.
      const count = Object.keys(result.errors).length
      const err = new Error(`${count} field${count !== 1 ? 's' : ''} failed validation`)
      throw err
    }
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
          ...(Platform.OS !== 'ios' ? {
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 4 }}>
                {(hasVersions || hasDrafts) && (
                  <DocumentActionsMenu
                    hasVersions={hasVersions}
                    hasDrafts={hasDrafts}
                    currentStatus={docStatus}
                    onViewVersions={() => setVersionsVisible(true)}
                    onSaveDraft={() => formRef.current?.submitWithStatus('draft')}
                    onPublish={() => formRef.current?.submitWithStatus('published')}
                    onUnpublish={() => formRef.current?.submitWithStatus('draft')}
                  />
                )}
                <Pressable
                  onPress={() => {
                    if (hasDrafts) {
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
          } : {}),
        }}
      />
      {Platform.OS === 'ios' && (
        <Stack.Toolbar placement="right">
          {(hasVersions || hasDrafts) && (
            <Stack.Toolbar.Menu icon="ellipsis.circle" title="Actions">
              {hasVersions && (
                <Stack.Toolbar.MenuAction
                  icon="clock.arrow.circlepath"
                  onPress={() => setVersionsVisible(true)}
                >
                  Versions
                </Stack.Toolbar.MenuAction>
              )}
              {hasDrafts && docStatus !== 'published' && (
                <Stack.Toolbar.MenuAction
                  icon="arrow.up.doc"
                  onPress={() => formRef.current?.submitWithStatus('published')}
                >
                  Publish
                </Stack.Toolbar.MenuAction>
              )}
              {hasDrafts && docStatus === 'published' && (
                <Stack.Toolbar.MenuAction
                  icon="arrow.down.doc"
                  onPress={() => formRef.current?.submitWithStatus('draft')}
                >
                  Unpublish
                </Stack.Toolbar.MenuAction>
              )}
            </Stack.Toolbar.Menu>
          )}
          <Stack.Toolbar.Button
            icon="square.and.arrow.down"
            onPress={() => {
              if (hasDrafts) {
                const status = (docStatus === 'published' ? 'published' : 'draft') as 'draft' | 'published'
                formRef.current?.submitWithStatus(status)
              } else {
                formRef.current?.submit()
              }
            }}
          />
        </Stack.Toolbar>
      )}

      <DocumentForm
        ref={formRef}
        schemaMap={schemaMap}
        slug={slug}
        initialData={(doc as Record<string, unknown>) ?? {}}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        errors={validationErrors}
        onFieldEdit={clearFieldError}
        submitLabel={hasDrafts ? undefined : 'Update'}
        draftStatus={hasDrafts ? ((docStatus as 'draft' | 'published') ?? 'draft') : undefined}
        contentInsetTop={headerHeight}
        onScroll={editScrollHandler}
        scrollEventThrottle={16}
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
