/**
 * Document create screen — local-first for regular collections.
 *
 * Inserts the new document into local RxDB immediately (instant),
 * then navigates to the edit screen. The sync engine pushes to the
 * server in the background.
 *
 * Save affordances live in the native header via `headerRight` — NOT
 * Stack.Toolbar. This route is presented as a modal/form sheet and the
 * experimental Stack.Toolbar (unstable_headerRightItems) pipeline is not
 * reliable inside sheet headers; `headerLeft`/`headerRight` always render
 * (the Cancel button on the left proves the header item path works).
 * DocumentForm itself renders NO submit button — saving is only possible
 * through the form ref, so the header buttons are the single save path:
 *
 *   - drafts collections (Pages, Posts): dual "Save Draft" / "Publish"
 *   - everything else: "Create"
 *
 * Auth-enabled collections (users): Payload requires email + password on
 * create and hashes the password server-side — the local-first sync path
 * cannot create auth users, so those creates go straight through the REST
 * API (correctness over local-first) and are then pulled into the local DB.
 */
import React, { useMemo, useRef, useState } from 'react'

import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useHeaderHeight } from "expo-router/react-navigation"

import {
  DocumentForm,
  extractRootFields,
  getCollectionLabel,
  PayloadAPIError,
  useAdminSchema,
  useAuth,
  useBaseURL,
  useListColors,
  useMenuModel,
  type DocumentFormHandle,
} from '@payload-universal/admin-native'
import { useLocalDB, useLocalDBStatus, useValidatedMutations } from '@payload-universal/local-db'

const MIN_PASSWORD_LENGTH = 8

export default function DocumentCreateScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  // Theme-aware JS palette (dark/light) — explicit colors for header buttons
  // so they stay visible in BOTH color schemes regardless of header tint.
  const { colors: pc } = useListColors()
  const headerHeight = useHeaderHeight()
  const schema = useAdminSchema()
  const menuModel = useMenuModel()
  const localDB = useLocalDB()
  const { isReady } = useLocalDBStatus()
  const baseURL = useBaseURL()
  const { token } = useAuth()

  const formRef = useRef<DocumentFormHandle>(null)

  const collectionMeta = menuModel?.collections.find((c) => c.slug === slug)
  const collectionLabel = menuModel ? getCollectionLabel(menuModel, slug, false) : slug
  const schemaMap = schema?.collections[slug]
  const hasDrafts = collectionMeta?.drafts ?? false

  // Auth-enabled collection (e.g. users)? The client config keeps the
  // sanitized `auth` object on auth collections; the serialized field schema
  // has NO password field (Payload keeps it server-side), so the password
  // inputs below are rendered by this screen, outside DocumentForm.
  const isAuthCreate = useMemo(() => {
    const collections = (schema?.clientConfig as unknown as {
      collections?: Array<{ slug?: string; auth?: { disableLocalStrategy?: unknown } }>
    } | undefined)?.collections
    const clientCollection = collections?.find((c) => c.slug === slug)
    return Boolean(clientCollection?.auth) && !clientCollection?.auth?.disableLocalStrategy
  }, [schema, slug])

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  // Dirty-state gating for the header create/save buttons (iOS convention:
  // disabled/gray until there is something to save). Auth password input
  // counts as dirty since it lives outside DocumentForm.
  const [formDirty, setFormDirty] = useState(false)
  // Warn before dismissing the sheet (swipe-down/Cancel) with unsaved edits;
  // post-create navigation bypasses via allowLeave().
  const { allowLeave } = useUnsavedChangesGuard(formDirty || (password.length > 0))

  // Extract root fields from schema for client-side validation
  const rootFields = useMemo(
    () => (schemaMap ? extractRootFields(schemaMap, slug) : []),
    [schemaMap, slug],
  )

  // Validated mutations: hooks + validation run locally BEFORE writing to RxDB
  const {
    create: validatedCreate,
    errors: validationErrors,
    clearFieldError,
  } = useValidatedMutations(localDB, slug, rootFields)

  const handleSubmit = async (data: Record<string, unknown>, options?: { status?: 'draft' | 'published' }) => {
    // Merge status into the data for the write
    const writeData = options?.status
      ? { ...data, _status: options.status }
      : hasDrafts
        ? { ...data, _status: 'draft' }  // Default to draft for draft-enabled collections
        : data

    if (isAuthCreate) {
      // Client-side password checks (min length + match) before hitting the API.
      if (password.length < MIN_PASSWORD_LENGTH) {
        const msg = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
        setPasswordError(msg)
        throw new Error(msg)
      }
      if (password !== confirmPassword) {
        const msg = 'Passwords do not match'
        setPasswordError(msg)
        throw new Error(msg)
      }
      setPasswordError(null)

      // Auth creates go through the REST API directly: Payload hashes the
      // password server-side (local-first sync cannot create auth users).
      // Correctness over local-first here.
      const res = await fetch(`${baseURL}/api/${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `JWT ${token}` } : {}),
        },
        body: JSON.stringify({ ...writeData, password }),
      })
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok) {
        // PayloadAPIError lets DocumentForm parse field-level validation
        // errors from the response body (e.g. duplicate email).
        const message =
          (body as { errors?: Array<{ message?: string }> }).errors?.[0]?.message ||
          `Create failed (${res.status})`
        throw new PayloadAPIError(message, res.status, body)
      }
      const newId = (body as { doc?: { id?: string | number } }).doc?.id
      // Pull the freshly created doc into the local DB so the edit screen
      // (which reads local-first) can find it.
      try {
        await localDB?.pullNow(slug)
      } catch {
        /* best-effort — sync will catch up */
      }
      if (newId !== undefined && newId !== null) {
        allowLeave()
        router.replace(`/(admin)/collections/${slug}/${newId}`)
      } else {
        allowLeave()
        router.back()
      }
      return
    }

    const result = await validatedCreate(writeData)
    // `=== false` (not `!`): non-strict tsconfig does not narrow the
    // boolean-literal discriminant of this union on truthiness checks.
    if (result.success === false) {
      // Throw so DocumentForm can display the error banner and toast
      const count = Object.keys(result.errors).length
      throw new Error(`${count} field${count !== 1 ? 's' : ''} failed validation`)
    }
    allowLeave()
    router.replace(`/(admin)/collections/${slug}/${result.id}`)
  }

  if (!isReady || !schemaMap) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ title: `New ${collectionLabel}` }} />
        {!isReady ? (
          <ActivityIndicator size="large" />
        ) : (
          <Text className="text-base text-ink-muted">Schema not available</Text>
        )}
      </View>
    )
  }

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen
        options={{
          title: `New ${collectionLabel}`,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={{ color: pc.text, fontSize: 15 }}>Cancel</Text>
            </Pressable>
          ),
          // Save affordances — headerRight (works inside modal/form sheets;
          // Stack.Toolbar does not). Explicit palette colors: visible in
          // both light and dark headers.
          headerRight: () => {
            const canSave = formDirty || (isAuthCreate && password.length > 0)
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, opacity: canSave ? 1 : 0.45 }}>
                {hasDrafts ? (
                  <>
                    <Pressable disabled={!canSave} onPress={() => formRef.current?.submitWithStatus('draft')} hitSlop={8}>
                      <Text style={{ color: canSave ? pc.text : pc.textMuted, fontSize: 15 }}>Save Draft</Text>
                    </Pressable>
                    <Pressable disabled={!canSave} onPress={() => formRef.current?.submitWithStatus('published')} hitSlop={8}>
                      <Text style={{ color: canSave ? pc.primary : pc.textMuted, fontSize: 15, fontWeight: '600' }}>Publish</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable disabled={!canSave} onPress={() => formRef.current?.submit()} hitSlop={8}>
                    <Text style={{ color: canSave ? pc.primary : pc.textMuted, fontSize: 15, fontWeight: '600' }}>Create</Text>
                  </Pressable>
                )}
              </View>
            )
          },
        }}
      />
      {isAuthCreate && (
        <View style={{ paddingHorizontal: 16, paddingTop: headerHeight + 12, gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: pc.textMuted }}>Password</Text>
          <TextInput
            value={password}
            onChangeText={(v) => {
              setPassword(v)
              if (passwordError) setPasswordError(null)
            }}
            placeholder={`Password (min ${MIN_PASSWORD_LENGTH} characters)`}
            placeholderTextColor={pc.textPlaceholder}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            style={{
              borderWidth: 1,
              borderColor: passwordError ? pc.error : pc.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 15,
              color: pc.text,
              backgroundColor: pc.surface,
            }}
          />
          <TextInput
            value={confirmPassword}
            onChangeText={(v) => {
              setConfirmPassword(v)
              if (passwordError) setPasswordError(null)
            }}
            placeholder="Confirm password"
            placeholderTextColor={pc.textPlaceholder}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            style={{
              borderWidth: 1,
              borderColor: passwordError ? pc.error : pc.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 15,
              color: pc.text,
              backgroundColor: pc.surface,
            }}
          />
          {passwordError && (
            <Text style={{ color: pc.error, fontSize: 13 }}>{passwordError}</Text>
          )}
        </View>
      )}
      <DocumentForm
        ref={formRef}
        schemaMap={schemaMap}
        slug={slug}
        initialData={{}}
        onSubmit={handleSubmit}
        errors={validationErrors}
        onFieldEdit={clearFieldError}
        submitLabel={hasDrafts ? undefined : 'Create'}
        draftStatus={hasDrafts ? 'draft' : undefined}
        onDirtyChange={setFormDirty}
      />
    </View>
  )
}
