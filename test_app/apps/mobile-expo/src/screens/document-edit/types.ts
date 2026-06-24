import type { RefObject } from 'react'
import type { useRouter } from 'expo-router'

import type { DocumentFormHandle } from '@payload-universal/admin-native'

type Router = ReturnType<typeof useRouter>

/** A custom edit action resolved with its display label. */
export type ResolvedEditAction = {
  key: string
  label: string
  icon?: string
  destructive?: boolean
}

/** Edit-action handler registry keyed by action key. */
export type EditHandlers = Record<
  string,
  (ctx: {
    collectionSlug: string
    documentId: string
    doc: Record<string, unknown>
    localDB: unknown
    baseURL: string
    token: string | null
  }) => void
>

export type Localization = {
  defaultLocale: string
  locales: Array<{ code: string; label?: string | Record<string, string> }>
}

/** Theme palette pulled from useListColors. */
export type PaletteColors = {
  text: string
  textMuted: string
  primary: string
}

/**
 * Shared props for the document-edit header toolbar surfaces (the native
 * Stack.Toolbar and the headerRight fallback). Bundles the document context,
 * feature flags, action handlers, and the form ref/router used by both.
 */
export type DocumentToolbarProps = {
  pc: PaletteColors
  hasVersions: boolean
  hasDrafts: boolean
  docStatus: string | undefined
  resolvedEditActions: ResolvedEditAction[]
  editHandlers: EditHandlers
  doc: unknown
  slug: string
  id: string
  localDB: unknown
  baseURL: string
  token: string | null
  localization: Localization | null
  activeLocale: string
  setActiveLocale: (code: string) => void
  formDirty: boolean
  formRef: RefObject<DocumentFormHandle | null>
  router: Router
  windowWidth: number
  onViewVersions: () => void
  onDuplicate: () => void
  onDelete: () => void
}
