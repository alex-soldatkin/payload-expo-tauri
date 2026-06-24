import { Alert } from 'react-native'
import type { useRouter } from 'expo-router'

import { useToast } from '@payload-universal/admin-native'

type Router = ReturnType<typeof useRouter>

type ValidatedResult =
  | { success: true; id?: string }
  | { success: false; errors: Record<string, unknown> }

/** Local-first document actions (submit / delete / duplicate / restore). */
export type DocumentActions = {
  handleSubmit: (
    data: Record<string, unknown>,
    options?: { status?: 'draft' | 'published' },
  ) => Promise<void>
  handleDelete: () => void
  handleDuplicate: () => Promise<void>
  handleVersionRestore: () => void
}

/**
 * Wires the document-edit screen's mutating actions to the validated
 * local-first pipeline + locale REST save. Purely lifts the handler closures
 * out of the screen body — no behavior change.
 */
export function useDocumentActions(args: {
  slug: string
  id: string
  doc: unknown
  collectionLabel: string
  useAsTitle: string | undefined
  hasDrafts: boolean
  isDefaultLocale: boolean
  router: Router
  localDB: { pullNow?: (slug: string) => void } | null | undefined
  remove: (id: string) => Promise<unknown>
  saveRemote: (
    data: Record<string, unknown>,
    options?: { status?: 'draft' | 'published' },
  ) => Promise<unknown>
  validatedUpdate: (
    id: string,
    data: Record<string, unknown>,
    prev?: Record<string, unknown>,
  ) => Promise<ValidatedResult>
  validatedCreate: (data: Record<string, unknown>) => Promise<ValidatedResult>
  allowLeave: () => void
}): DocumentActions {
  const {
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
  } = args
  const toast = useToast()

  const handleSubmit = async (
    data: Record<string, unknown>,
    options?: { status?: 'draft' | 'published' },
  ) => {
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
    localDB?.pullNow?.(slug)
  }

  return { handleSubmit, handleDelete, handleDuplicate, handleVersionRestore }
}
