/**
 * Relationship inline-create — wires RelationshipField's `onRequestCreate`
 * injection point (render-callback injection; packages never import
 * expo-router) to an app-level create sheet.
 *
 * Two pieces:
 *
 * 1. `RelationshipFieldWithInlineCreate` — a thin wrapper registered over
 *    `fieldRegistry.relationship` at module load. It reads the app-level
 *    context and injects `onRequestCreate`; when no provider is mounted the
 *    prop stays undefined and the field hides its "Create new" row (exactly
 *    the pre-existing behavior).
 *
 * 2. `RelationshipInlineCreateProvider` — mounted once at the app root. It
 *    hosts the package BottomSheet with a DocumentForm (nativeForm={false} —
 *    convention: forms in unsized sheet containers must not use the native
 *    SwiftUI Form) backed by useValidatedMutations. On successful create the
 *    new doc id is emitted back through the requesting field's onChange,
 *    respecting hasMany / polymorphic value shapes.
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native'

import {
  BottomSheet,
  DocumentForm,
  type DocumentFormHandle,
  extractRootFields,
  fieldRegistry,
  getCollectionLabel,
  RelationshipField,
  type RelationshipFieldProps,
  useAdminSchema,
  useMenuModel,
} from '@payload-universal/admin-native'
import { useLocalDB, useValidatedMutations } from '@payload-universal/local-db'

// ---------------------------------------------------------------------------
// Context — requestCreate(relationTo, onCreated)
// ---------------------------------------------------------------------------

type RequestCreateFn = (relationTo: string, onCreated: (newId: string) => void) => void

const InlineCreateContext = createContext<RequestCreateFn | null>(null)

// ---------------------------------------------------------------------------
// Field wrapper — registered over fieldRegistry.relationship
// ---------------------------------------------------------------------------

const RelationshipFieldWithInlineCreate: React.FC<RelationshipFieldProps> = (props) => {
  const requestCreate = useContext(InlineCreateContext)
  const { field, value, onChange } = props

  const handleRequestCreate = useMemo(() => {
    if (!requestCreate) return undefined
    return (relationTo: string) => {
      requestCreate(relationTo, (newId: string) => {
        const collections = Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo]
        const isPoly = collections.length > 1
        const entry = isPoly ? { relationTo, value: newId } : newId
        if (field.hasMany) {
          const current = Array.isArray(value) ? value : []
          onChange([...current, entry])
        } else {
          onChange(entry)
        }
      })
    }
  }, [requestCreate, field, value, onChange])

  return <RelationshipField {...props} onRequestCreate={handleRequestCreate} />
}

// Register at module load — every DocumentForm rendered after this import
// resolves relationship fields through the wrapper. Without a mounted
// provider the wrapper is a transparent pass-through.
fieldRegistry.relationship = RelationshipFieldWithInlineCreate

// ---------------------------------------------------------------------------
// Inline create form (inside the sheet)
// ---------------------------------------------------------------------------

const InlineCreateForm: React.FC<{
  relationTo: string
  onCreated: (id: string) => void
  onCancel: () => void
}> = ({ relationTo, onCreated, onCancel }) => {
  const schema = useAdminSchema()
  const menuModel = useMenuModel()
  const localDB = useLocalDB()
  const formRef = useRef<DocumentFormHandle>(null)
  const isDark = useColorScheme() === 'dark'

  const schemaMap = schema?.collections?.[relationTo]
  const rootFields = useMemo(
    () => (schemaMap ? extractRootFields(schemaMap, relationTo) : []),
    [schemaMap, relationTo],
  )
  const hasDrafts = menuModel?.collections.find((c) => c.slug === relationTo)?.drafts ?? false
  const label = menuModel ? getCollectionLabel(menuModel, relationTo, false) : relationTo

  const { create, errors, clearFieldError } = useValidatedMutations(localDB, relationTo, rootFields)

  const handleSubmit = useCallback(
    async (data: Record<string, unknown>, options?: { status?: 'draft' | 'published' }) => {
      const writeData = options?.status
        ? { ...data, _status: options.status }
        : hasDrafts
          ? { ...data, _status: 'draft' }
          : data
      const result = await create(writeData)
      // `=== false` (not `!`): the app tsconfig is non-strict, where truthiness
      // checks do not narrow the boolean-literal discriminant of this union.
      if (result.success === false) {
        const count = Object.keys(result.errors).length
        throw new Error(`${count} field${count !== 1 ? 's' : ''} failed validation`)
      }
      if (result.id) onCreated(result.id)
    },
    [create, hasDrafts, onCreated],
  )

  if (!schemaMap) {
    return (
      <View style={styles.missing}>
        <Text style={[styles.missingText, isDark && styles.textDark]}>
          Schema not available for {relationTo}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={[styles.title, isDark && styles.textDark]} numberOfLines={1}>
          New {label}
        </Text>
        <Pressable onPress={() => formRef.current?.submit()} hitSlop={10}>
          <Text style={styles.create}>Create</Text>
        </Pressable>
      </View>

      {/* nativeForm MUST stay false: the sheet is an unsized container and a
          zero-height SwiftUI Form swallows touches. */}
      <DocumentForm
        ref={formRef}
        schemaMap={schemaMap}
        slug={relationTo}
        initialData={{}}
        onSubmit={handleSubmit}
        errors={errors}
        onFieldEdit={clearFieldError}
        submitLabel="Create"
        nativeForm={false}
      />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Provider — mounted once at the app root
// ---------------------------------------------------------------------------

type PendingCreate = { relationTo: string; onCreated: (id: string) => void }

export const RelationshipInlineCreateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [pending, setPending] = useState<PendingCreate | null>(null)

  const requestCreate = useCallback<RequestCreateFn>((relationTo, onCreated) => {
    setPending({ relationTo, onCreated })
  }, [])

  const close = useCallback(() => setPending(null), [])

  return (
    <InlineCreateContext.Provider value={requestCreate}>
      {children}
      <BottomSheet visible={pending !== null} onClose={close} detents={['large']}>
        {pending ? (
          <InlineCreateForm
            relationTo={pending.relationTo}
            onCancel={close}
            onCreated={(id) => {
              pending.onCreated(id)
              setPending(null)
            }}
          />
        ) : null}
      </BottomSheet>
    </InlineCreateContext.Provider>
  )
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    gap: 12,
  },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#1f1f1f' },
  textDark: { color: '#f2f2f7' },
  cancel: { fontSize: 16, color: '#8E8E93' },
  create: { fontSize: 16, fontWeight: '600', color: '#007AFF' },
  missing: { padding: 24, alignItems: 'center' },
  missingText: { fontSize: 14, color: '#1f1f1f' },
})
