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
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Platform, Pressable, Text, useColorScheme, useWindowDimensions, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useHeaderHeight } from "expo-router/react-navigation"

import {
  DocumentForm,
  extractRootFields,
  getCollectionLabel,
  getDocumentTitle,
  useAdminSchema,
  useBaseURL,
  useAuth,
  useCustomComponentRegistry,
  useEditActionHandlers,
  useListColors,
  useMenuModel,
  VersionsBottomSheet,
  type DocumentFormHandle,
} from '@payload-universal/admin-native'
import { useLocalDB, useLocalDocument, useLocalMutations, useLocalDBStatus, useValidatedMutations } from '@payload-universal/local-db'
import { useHeaderScrollY } from '@/components/HeaderScrollContext'
import { useAutosave } from '@/src/hooks/useAutosave'
import { useLocaleEditing } from '@/src/hooks/useLocaleEditing'
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard'
import { DocumentEditToolbar } from '@/src/screens/document-edit/components/DocumentEditToolbar'
import { DocumentHeaderRight } from '@/src/screens/document-edit/components/DocumentHeaderRight'
import { EditStatusPills } from '@/src/screens/document-edit/components/EditStatusPills'
import { useDocumentActions } from '@/src/screens/document-edit/hooks/useDocumentActions'
import type { DocumentToolbarProps } from '@/src/screens/document-edit/types'
import { hasStackToolbar } from '@/src/screens/document-edit/utils'

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

  const formRef = useRef<DocumentFormHandle>(null)
  const isDark = useColorScheme() === 'dark'
  // Theme-aware JS palette — explicit tints for header/toolbar buttons so
  // they stay visible in BOTH color schemes (never inherit a header tint
  // that may mismatch the current background while theming is in flux).
  const { colors: pc } = useListColors()
  // iOS native header toolbar only when the experimental API exists;
  // otherwise (and on Android) the headerRight fallback below renders.
  const useNativeHeaderToolbar = Platform.OS === 'ios' && hasStackToolbar

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
    create: validatedCreate,
    errors: validationErrors,
    clearFieldError,
  } = useValidatedMutations(localDB, slug, rootFields)

  // Feature flags from collection config
  const hasDrafts = collectionMeta?.drafts ?? false
  const hasVersions = collectionMeta?.versions ?? false

  // ── Localization (web admin Localizer parity) ─────────────────────────
  // Default locale: local-first RxDB (unchanged). Non-default locale: load
  // and save the WHOLE doc via REST with ?locale=X (bypasses RxDB — the
  // local DB only models the default locale).
  const localization =
    typeof schema?.localization === 'object' ? schema.localization : null
  const {
    activeLocale,
    setActiveLocale,
    isDefaultLocale,
    remoteDoc,
    remoteLoading,
    remoteError,
    saveRemote,
  } = useLocaleEditing({
    enabled: !!localization,
    baseURL,
    token,
    slug,
    docId: id,
    defaultLocale: localization?.defaultLocale ?? '',
    draft: hasDrafts,
  })

  // Active document for the form
  const formDoc = isDefaultLocale ? ((doc as Record<string, unknown>) ?? null) : remoteDoc
  const docStatus = formDoc?._status as string | undefined

  // ── Autosave (versions.drafts.autosave — e.g. Pages, interval 1500ms) ──
  // The autosave config rides on the serialized client config (the menu
  // model doesn't carry it). Only active on the default locale (local
  // mutation path) and while the doc is not published — locally we can't
  // model "draft version of a published doc", so autosaving a published doc
  // would silently unpublish it.
  const clientCollection = useMemo(() => {
    const collections = (schema?.clientConfig as unknown as {
      collections?: Array<{
        slug?: string
        versions?: { drafts?: false | { autosave?: false | { interval?: number } } }
      }>
    } | undefined)?.collections
    return collections?.find((c) => c.slug === slug)
  }, [schema, slug])
  const draftsConfig = clientCollection?.versions?.drafts
  const autosaveCfg = draftsConfig && typeof draftsConfig === 'object' ? draftsConfig.autosave : undefined
  const autosaveInterval =
    autosaveCfg && typeof autosaveCfg === 'object' && typeof autosaveCfg.interval === 'number'
      ? autosaveCfg.interval
      : 800

  const handleAutosave = useCallback(
    async (data: Record<string, unknown>) => {
      const result = await validatedUpdate(
        id,
        { ...data, _status: 'draft' },
        (doc as Record<string, unknown>) ?? undefined,
      )
      if (!result.success) throw new Error('Autosave validation failed')
    },
    [validatedUpdate, id, doc],
  )

  const autosave = useAutosave({
    enabled: Boolean(autosaveCfg) && isDefaultLocale && !loading && !!doc && docStatus !== 'published',
    intervalMs: autosaveInterval,
    formRef,
    onSave: handleAutosave,
  })

  // Custom edit actions from the admin schema + action handler registry
  const editActions = collectionMeta?.editActions ?? []
  const editHandlers = useEditActionHandlers(slug)
  // Transpiled custom components — provide labels extracted from web components
  const componentRegistry = useCustomComponentRegistry()
  const editActionEntries = componentRegistry?.editActions?.[slug] ?? []
  // Component label takes precedence over metadata label
  const resolvedEditActions = useMemo(
    () =>
      editActions.map((action, i) => ({
        ...action,
        label: editActionEntries[i]?.label ?? action.label,
      })),
    [editActions, editActionEntries],
  )

  // Versions bottom sheet state
  const [versionsVisible, setVersionsVisible] = useState(false)
  // Wide layouts swap the toolbar sidebar button for DocumentForm's edge tab.
  const { width: windowWidth } = useWindowDimensions()
  // Drives the toolbar Save button: enabled/blue only with unsaved edits.
  const [formDirty, setFormDirty] = useState(false)
  // Warn before leaving (back swipe/button) with unsaved edits; intentional
  // post-delete/duplicate navigation bypasses via allowLeave().
  const { allowLeave } = useUnsavedChangesGuard(formDirty)

  // API config for direct server calls (versions are server-side only)
  const apiConfig = useMemo(() => ({ baseURL, token }), [baseURL, token])

  // Local-first document actions (submit / delete / duplicate / restore)
  const { handleSubmit, handleDelete, handleDuplicate, handleVersionRestore } =
    useDocumentActions({
      slug,
      id,
      doc,
      collectionLabel,
      useAsTitle,
      hasDrafts,
      isDefaultLocale,
      router,
      localDB,
      remove,
      saveRemote,
      validatedUpdate,
      validatedCreate,
      allowLeave,
    })

  const title = formDoc ? getDocumentTitle(formDoc, useAsTitle) : 'Loading...'

  if (!isReady || loading || (!isDefaultLocale && remoteLoading && !remoteDoc)) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ title: collectionLabel }} />
        <ActivityIndicator size="large" />
      </View>
    )
  }

  const screenError = error || (!isDefaultLocale ? remoteError : null)
  if (screenError || !schemaMap) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-6">
        <Stack.Screen options={{ title: collectionLabel }} />
        <Text className="text-base text-red-600">{screenError || 'Schema not available'}</Text>
        {!isDefaultLocale && localization && (
          <Pressable
            className="mt-4 rounded-xl bg-black px-6 py-3"
            onPress={() => setActiveLocale(localization.defaultLocale)}
          >
            <Text className="text-sm font-semibold text-white">
              Back to {localization.defaultLocale}
            </Text>
          </Pressable>
        )}
        <Pressable className="mt-4 rounded-xl bg-black px-6 py-3" onPress={() => router.back()}>
          <Text className="text-sm font-semibold text-white">Go Back</Text>
        </Pressable>
      </View>
    )
  }

  // Shared props for both header toolbar surfaces (native Stack.Toolbar +
  // headerRight fallback).
  const toolbarProps: DocumentToolbarProps = {
    pc,
    hasVersions,
    hasDrafts,
    docStatus,
    resolvedEditActions,
    editHandlers,
    doc,
    slug,
    id,
    localDB,
    baseURL,
    token,
    localization,
    activeLocale,
    setActiveLocale,
    formDirty,
    formRef,
    router,
    windowWidth,
    onViewVersions: () => setVersionsVisible(true),
    onDuplicate: handleDuplicate,
    onDelete: handleDelete,
  }

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen
        options={{
          title: title,
          ...(!useNativeHeaderToolbar ? {
            headerRight: () => <DocumentHeaderRight {...toolbarProps} />,
          } : {}),
        }}
      />
      {useNativeHeaderToolbar && <DocumentEditToolbar {...toolbarProps} />}

      <DocumentForm
        // Remount when the locale changes so initialData re-seeds the form
        key={`${id}:${activeLocale || 'default'}`}
        ref={formRef}
        schemaMap={schemaMap}
        slug={slug}
        initialData={formDoc ?? {}}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        errors={isDefaultLocale ? validationErrors : undefined}
        onFieldEdit={clearFieldError}
        submitLabel={hasDrafts ? undefined : 'Update'}
        draftStatus={hasDrafts ? ((docStatus as 'draft' | 'published') ?? 'draft') : undefined}
        contentInsetTop={headerHeight}
        onScroll={editScrollHandler}
        scrollEventThrottle={16}
        onOpenDetails={() => router.push(`/collections/${slug}/details?id=${id}`)}
        onDirtyChange={setFormDirty}
      />

      <EditStatusPills
        isDark={isDark}
        isDefaultLocale={isDefaultLocale}
        activeLocale={activeLocale}
        autosave={autosave}
        headerHeight={headerHeight}
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
