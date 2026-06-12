/**
 * Details sheet — editable sidebar fields (admin.position: 'sidebar')
 * in a native iOS formSheet with grab handle and multiple detents.
 *
 * Renders a full DocumentForm with only the sidebar fields, connected
 * to the local RxDB database for instant saves. Changes sync to the
 * server in the background via the replication layer.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard'

import {
  DocumentForm,
  type DocumentFormHandle,
  extractRootFields,
  useAdminSchema,
} from '@payload-universal/admin-native'
import {
  useLocalDB,
  useLocalDocument,
  useValidatedMutations,
} from '@payload-universal/local-db'

// Stable fallback when the doc has no data yet. An inline `?? {}` creates a
// NEW object identity on EVERY render — DocumentForm consumes initialData via
// react-hook-form, and unstable identities there fed the 'Maximum update
// depth exceeded' loop when this sheet opened (2026-06-11). Module scope keeps
// the reference stable across renders AND remounts.
const EMPTY_DOC: Record<string, unknown> = {}

export default function DetailsSheet() {
  const { slug, id } = useLocalSearchParams<{ slug: string; id?: string }>()
  const router = useRouter()
  const schema = useAdminSchema()
  const localDB = useLocalDB()
  const formRef = useRef<DocumentFormHandle>(null)

  // Warn before dismissing the sheet (swipe-down / tap outside) with unsaved
  // edits; default dismissal preserved when clean.
  const [formDirty, setFormDirty] = useState(false)
  useUnsavedChangesGuard(formDirty)

  // Schema
  const schemaMap = schema?.collections?.[slug]
  const rootFields = useMemo(
    () => (schemaMap ? extractRootFields(schemaMap, slug) : []),
    [schemaMap, slug],
  )

  // Reactive document data from local RxDB
  const { doc, loading } = useLocalDocument(localDB, slug, id ?? '')

  // Validated mutations for saving
  const { update: validatedUpdate, errors: validationErrors, clearFieldError } =
    useValidatedMutations(localDB, slug, rootFields)

  // Save handler — writes to local DB, sync pushes to server
  const handleSubmit = useCallback(
    async (data: Record<string, unknown>, options?: { status?: 'draft' | 'published' }) => {
      if (!id) return
      const writeData = options?.status ? { ...data, _status: options.status } : data
      const result = await validatedUpdate(id, writeData, (doc as Record<string, unknown>) ?? undefined)
      // `=== false` (not `!`): non-strict tsconfig does not narrow the
      // boolean-literal discriminant of this union on truthiness checks.
      if (result.success === false) {
        const count = Object.keys(result.errors).length
        throw new Error(`${count} field${count !== 1 ? 's' : ''} failed validation`)
      }
    },
    [id, doc, validatedUpdate],
  )

  if (!schemaMap) {
    return <View style={styles.container} />
  }

  // Mount the form only once the local doc has resolved — like [id].tsx.
  // Mounting with `{}` would seed react-hook-form's defaultValues with an
  // empty doc (RHF captures defaultValues at mount only), so the sidebar
  // fields would render empty even after the doc arrives.
  if (loading) {
    return (
      <View style={[styles.container, styles.loading]}>
        <Stack.Screen
          options={{
            title: 'Details',
            headerShown: true,
            headerRight: () => null,
            headerLeft: () => null,
          }}
        />
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Details',
          headerShown: true,
          headerRight: () => null,
          headerLeft: () => null,
        }}
      />

      <DocumentForm
        ref={formRef}
        schemaMap={schemaMap}
        slug={slug}
        initialData={(doc as Record<string, unknown>) ?? EMPTY_DOC}
        onSubmit={handleSubmit}
        errors={validationErrors}
        onFieldEdit={clearFieldError}
        submitLabel="Save"
        sidebarOnly
        // Convention: forms mounted in unsized sheet containers (formSheet)
        // must NOT use the native SwiftUI Form — a zero-height Form swallows
        // all touches.
        nativeForm={false}
        onDirtyChange={setFormDirty}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { alignItems: 'center', justifyContent: 'center' },
})
