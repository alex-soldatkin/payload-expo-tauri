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
import { ActivityIndicator, Alert, Animated, Platform, Pressable, Text, useColorScheme, useWindowDimensions, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import type { SFSymbol } from 'sf-symbols-typescript'
import { useHeaderHeight } from "expo-router/react-navigation"
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
  useCustomComponentRegistry,
  useEditActionHandlers,
  useListColors,
  useMenuModel,
  useToast,
  VersionsBottomSheet,
  type DocumentFormHandle,
} from '@payload-universal/admin-native'
import { useLocalDB, useLocalDocument, useLocalMutations, useLocalDBStatus, useValidatedMutations } from '@payload-universal/local-db'
import { useHeaderScrollY } from '@/components/HeaderScrollContext'
import { useAutosave } from '@/src/hooks/useAutosave'
import { useLocaleEditing } from '@/src/hooks/useLocaleEditing'
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard'

/** Resolve a locale label that may be a string or an i18n record. */
const localeLabel = (locale: { code: string; label?: string | Record<string, string> }): string => {
  if (typeof locale.label === 'string') return locale.label
  if (locale.label && typeof locale.label === 'object') {
    return locale.label.en ?? Object.values(locale.label)[0] ?? locale.code
  }
  return locale.code
}

const formatTime = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/**
 * Stack.Toolbar is an experimental expo-router API (unstable_headerRightItems
 * → react-native-screens bar button items). Guard at runtime so the screen
 * falls back to the always-available `headerRight` path when the API is
 * missing (older expo-router) instead of silently rendering no save button.
 */
const hasStackToolbar =
  typeof (Stack as { Toolbar?: unknown }).Toolbar === 'function' &&
  Boolean((Stack as { Toolbar?: { Button?: unknown } }).Toolbar?.Button)

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

  const toast = useToast()

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

  const handleSubmit = async (data: Record<string, unknown>, options?: { status?: 'draft' | 'published' }) => {
    // Non-default locale: whole-doc REST PATCH with ?locale=X (correct
    // Payload semantics — localized fields write only the active locale).
    if (!isDefaultLocale) {
      await saveRemote(data, options)
      return
    }
    // Merge status into the data for the local DB write
    const writeData = options?.status
      ? { ...data, _status: options.status }
      : data
    const result = await validatedUpdate(id, writeData, (doc as Record<string, unknown>) ?? undefined)
    // `=== false` (not `!`): non-strict tsconfig does not narrow the
    // boolean-literal discriminant of this union on truthiness checks.
    if (result.success === false) {
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
              allowLeave()
              router.back()
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed')
            }
          },
        },
      ],
    )
  }

  // Generic Duplicate — works for every collection (generalizes the old
  // posts-specific handler): clone the doc, strip the id and internal/RxDB
  // bookkeeping fields, reset _status to draft (when drafts are enabled),
  // insert through the validated local-first pipeline, then open the copy.
  const handleDuplicate = async () => {
    if (!doc) return
    const {
      id: _id,
      _rev,
      _meta,
      _attachments,
      _deleted,
      _locallyModified,
      _status,
      createdAt,
      updatedAt,
      ...rest
    } = doc as Record<string, unknown>

    const data: Record<string, unknown> = { ...rest }
    // Make the copy distinguishable in lists (and dodge obvious unique
    // collisions on the common `slug` pattern) — best-effort, like web admin
    if (useAsTitle && typeof data[useAsTitle] === 'string' && data[useAsTitle]) {
      data[useAsTitle] = `${data[useAsTitle]} (Copy)`
    }
    if (typeof data.slug === 'string' && data.slug) {
      data.slug = `${data.slug}-copy`
    }
    if (hasDrafts) data._status = 'draft'

    const result = await validatedCreate(data)
    // `=== false` (not `!`): non-strict tsconfig does not narrow the
    // boolean-literal discriminant of this union on truthiness checks.
    if (result.success === false) {
      const count = Object.keys(result.errors).length
      Alert.alert('Duplicate failed', `${count} field${count !== 1 ? 's' : ''} failed validation`)
      return
    }
    toast.showToast(hasDrafts ? 'Duplicated as draft' : 'Duplicated', { type: 'success', icon: 'success' })
    if (result.id) {
      allowLeave()
      router.push(`/(admin)/collections/${slug}/${result.id}`)
    }
  }

  // After a version restore, trigger an immediate pull to pick up the
  // restored data from the server into the local DB.
  const handleVersionRestore = () => {
    localDB?.pullNow(slug)
  }

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

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen
        options={{
          title: title,
          ...(!useNativeHeaderToolbar ? {
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 4 }}>
                <DocumentActionsMenu
                  hasVersions={hasVersions}
                  hasDrafts={hasDrafts}
                  currentStatus={docStatus}
                  onViewVersions={() => setVersionsVisible(true)}
                  onSaveDraft={() => formRef.current?.submitWithStatus('draft')}
                  onPublish={() => formRef.current?.submitWithStatus('published')}
                  onUnpublish={() => formRef.current?.submitWithStatus('draft')}
                  extraActions={[
                    // Generic document actions — every collection
                    {
                      label: 'Duplicate',
                      icon: 'plus.square.on.square',
                      onPress: handleDuplicate,
                    },
                    {
                      label: 'Delete',
                      icon: 'trash',
                      destructive: true,
                      onPress: handleDelete,
                    },
                    ...resolvedEditActions.map((action) => ({
                      label: action.label,
                      icon: action.icon,
                      destructive: action.destructive,
                      onPress: () => {
                        const handler = editHandlers[action.key]
                        if (handler && doc) {
                          handler({
                            collectionSlug: slug,
                            documentId: id,
                            doc: doc as Record<string, unknown>,
                            localDB,
                            baseURL,
                            token,
                          })
                        }
                      },
                    })),
                    // API inspector (web admin parity)
                    {
                      label: 'API',
                      icon: 'curlybraces',
                      onPress: () => router.push(`/collections/${slug}/api?id=${id}`),
                    },
                    // Locale switcher (Localizer parity)
                    ...(localization
                      ? localization.locales.map((l) => ({
                          label: `${activeLocale === l.code ? '✓ ' : ''}Locale: ${localeLabel(l)}`,
                          icon: 'globe',
                          onPress: () => setActiveLocale(l.code),
                        }))
                      : []),
                  ]}
                />
                <Pressable
                  disabled={!formDirty}
                  onPress={() => {
                    if (hasDrafts) {
                      const status = (docStatus === 'published' ? 'published' : 'draft') as 'draft' | 'published'
                      formRef.current?.submitWithStatus(status)
                    } else {
                      formRef.current?.submit()
                    }
                  }}
                  hitSlop={8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: formDirty ? 1 : 0.45 }}
                >
                  <Save size={22} color={formDirty ? pc.primary : pc.textMuted} />
                  <Text style={{ color: formDirty ? pc.primary : pc.textMuted, fontSize: 15, fontWeight: '600' }}>Save</Text>
                </Pressable>
              </View>
            ),
          } : {}),
        }}
      />
      {useNativeHeaderToolbar && (
        <Stack.Toolbar placement="right">
          {/* Always rendered: the API inspector entry exists for every collection.
              Explicit tintColor on every item: header items must stay visible
              in both color schemes (no reliance on inherited header tint). */}
          <Stack.Toolbar.Menu icon="ellipsis.circle" title="Actions" tintColor={pc.text}>
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
              {/* Generic document actions — every collection */}
              <Stack.Toolbar.MenuAction
                icon="plus.square.on.square"
                onPress={handleDuplicate}
              >
                Duplicate
              </Stack.Toolbar.MenuAction>
              <Stack.Toolbar.MenuAction
                icon="trash"
                destructive
                onPress={handleDelete}
              >
                Delete
              </Stack.Toolbar.MenuAction>
              {/* Custom edit actions from Payload config */}
              {resolvedEditActions.map((action) => (
                <Stack.Toolbar.MenuAction
                  key={action.key}
                  icon={(action.icon || 'bolt') as SFSymbol}
                  onPress={() => {
                    const handler = editHandlers[action.key]
                    if (handler && doc) {
                      handler({
                        collectionSlug: slug,
                        documentId: id,
                        doc: doc as Record<string, unknown>,
                        localDB,
                        baseURL,
                        token,
                      })
                    }
                  }}
                >
                  {action.label}
                </Stack.Toolbar.MenuAction>
              ))}
              {/* API inspector — web admin "API" view parity (formSheet) */}
              <Stack.Toolbar.MenuAction
                icon="curlybraces"
                onPress={() => router.push(`/collections/${slug}/api?id=${id}`)}
              >
                API
              </Stack.Toolbar.MenuAction>
            </Stack.Toolbar.Menu>
          {/* Locale switcher (Localizer parity) — only when localization is configured */}
          {localization && (
            <Stack.Toolbar.Menu icon="globe" title="Locale" tintColor={pc.text}>
              {localization.locales.map((l) => (
                <Stack.Toolbar.MenuAction
                  key={l.code}
                  isOn={activeLocale === l.code}
                  onPress={() => setActiveLocale(l.code)}
                >
                  {localeLabel(l)}
                </Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
          )}
          {/* Sidebar details — opens/dismisses the formSheet. Wide layouts
              (iPad) get DocumentForm's Notes-style edge tab instead, so the
              toolbar button only renders on phone-width windows. */}
          {windowWidth < 768 && (
            <Stack.Toolbar.Button
              icon="sidebar.right"
              tintColor={pc.text}
              onPress={() => router.push(`/collections/${slug}/details?id=${id}`)}
            />
          )}
          {/* Save — large checkmark icon, dirty-state driven (iOS convention):
              blue + enabled while the form has unsaved edits, gray + disabled
              otherwise. Explicit tint per scheme so it can never vanish. */}
          <Stack.Toolbar.Button
            icon="checkmark.circle.fill"
            variant="done"
            disabled={!formDirty}
            tintColor={formDirty ? pc.primary : pc.textMuted}
            accessibilityLabel="Save"
            onPress={() => {
              if (hasDrafts) {
                const status = (docStatus === 'published' ? 'published' : 'draft') as 'draft' | 'published'
                formRef.current?.submitWithStatus(status)
              } else {
                formRef.current?.submit()
              }
            }}
          >
            Save
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      )}

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

      {/* Locale + autosave status pills — subtle overlay near the title/status row */}
      {(!isDefaultLocale || autosave.status !== 'idle') && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: headerHeight + 6,
            right: 16,
            zIndex: 20,
            flexDirection: 'row',
            gap: 6,
          }}
        >
          {!isDefaultLocale && (
            <View
              style={{
                backgroundColor: isDark ? 'rgba(10,132,255,0.28)' : 'rgba(0,122,255,0.12)',
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#6db2ff' : '#0a66c2' }}>
                {activeLocale} · online
              </Text>
            </View>
          )}
          {autosave.status !== 'idle' && (
            <View
              style={{
                backgroundColor: isDark ? 'rgba(120,120,128,0.32)' : 'rgba(120,120,128,0.14)',
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '500', color: isDark ? '#aeaeb2' : '#6b7280' }}>
                {autosave.status === 'saving'
                  ? 'Saving…'
                  : autosave.status === 'error'
                    ? 'Autosave failed'
                    : autosave.lastSavedAt
                      ? `Saved · ${formatTime(autosave.lastSavedAt)}`
                      : 'Saved'}
              </Text>
            </View>
          )}
        </View>
      )}

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
