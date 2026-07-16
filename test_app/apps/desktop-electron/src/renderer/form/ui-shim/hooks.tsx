// @payloadcms/ui hook shims (issue #28 phase 2) — the data half of the alias
// that lets ORIGINAL Payload admin components run unmodified on desktop.
// Each hook re-expresses Payload's form context on top of our RHF FormEngine:
//   useField(path)      → useWatch + engine.setValue (paths are runtime form
//                         paths, so sibling reads like 'title' hit the root)
//   useForm().getData() → engine.getValues()
//   useAuth().user      → decoded from the JWT (Payload tokens carry id/email)
//   useRowLabel()       → row scope provided by the registry adapter
// Write-oriented APIs Payload exposes but we can't honor (submit,
// dispatchFields) are no-ops — autosave owns persistence here.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type * as React from 'react'
import { useWatch } from 'react-hook-form'
import { useFormEngine, useFormEngineMaybe } from '../FieldRenderer'
import { getShimNavSink, getShimSession, useDocInfoScope, useSelectionScope } from './scopes'

export function useField<T = unknown>({ path }: { path: string }): {
  value: T | undefined
  setValue: (val: T) => void
  errorMessage?: string
  showError: boolean
  path: string
} {
  const engine = useFormEngine()
  const value = useWatch({ control: engine.control, name: path }) as T | undefined
  const setValue = useCallback(
    (next: T) => {
      engine.setValue(path, next as never, { shouldDirty: true })
      engine.onEdit(path)
    },
    [engine, path],
  )
  const errorMessage = engine.errors[path]
  return { value, setValue, errorMessage, showError: Boolean(errorMessage), path }
}

export function useForm(): {
  getData: () => Record<string, unknown>
  getDataByPath: (path: string) => unknown
  setModified: (modified: boolean) => void
  submit: () => Promise<void>
  disabled: boolean
} {
  const engine = useFormEngine()
  return useMemo(
    () => ({
      getData: () => engine.getValues(),
      getDataByPath: (path: string) => engine.getValues(path),
      setModified: () => {},
      submit: async () => {}, // autosave persists; explicit submit is a no-op
      disabled: false,
    }),
    [engine],
  )
}

export function useDocumentInfo(): { id: string; collectionSlug: string } {
  // Field components run inside the form engine; ACTION components (doc
  // menus, selection bar) get the same identity from the DocInfo scope.
  const engine = useFormEngineMaybe()
  const scope = useDocInfoScope()
  if (engine) return { id: engine.docId, collectionSlug: engine.slug }
  return { id: scope?.docId ?? '', collectionSlug: scope?.slug ?? '' }
}

/** Payload JWTs are unsigned-readable: header.payload.sig with base64url JSON. */
function decodeJwtUser(token: string): { id?: string; email?: string } | null {
  try {
    const body = token.split('.')[1]
    if (!body) return null
    const json = atob(body.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as { id?: string; email?: string }
  } catch {
    return null
  }
}

export function useAuth<TUser = { id?: string; email?: string }>(): {
  user: TUser | null
  token: string
} {
  const engine = useFormEngineMaybe()
  const scope = useDocInfoScope()
  const token = engine?.token ?? scope?.token ?? getShimSession()?.token ?? ''
  const user = useMemo(() => decodeJwtUser(token) as TUser | null, [token])
  return { user, token }
}

export function useConfig(): {
  config: {
    serverURL: string
    routes: { admin: string; api: string }
    collections: unknown[]
    globals: unknown[]
  }
} {
  const engine = useFormEngineMaybe()
  const scope = useDocInfoScope()
  const serverURL = engine?.serverURL ?? scope?.serverURL ?? getShimSession()?.serverURL ?? ''
  return useMemo(
    () => ({
      config: {
        serverURL,
        routes: { admin: '/admin', api: '/api' },
        collections: [],
        globals: [],
      },
    }),
    [serverURL],
  )
}

/** 'general:saveChanges' → 'Save changes'. Best-effort — we ship no i18n table. */
function humanizeKey(key: string): string {
  const leaf = key.split(':').pop()?.split('.').pop() ?? key
  const spaced = leaf.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function useTranslation(): {
  t: (key: string) => string
  i18n: { language: string }
} {
  return { t: humanizeKey, i18n: { language: 'en' } }
}

export function useLocale(): { code: string; label: string } {
  return { code: 'en', label: 'English' }
}

// ---- row-label scope ------------------------------------------------------
// ArrayField invokes registry RowLabels with {data, index}; Payload RowLabel
// components instead take no props and call useRowLabel(). The registry
// adapter (adapters.tsx) bridges the two by mounting this provider per row.

export type RowLabelScope = { data: Record<string, unknown>; rowNumber: number; path: string }

const RowLabelContext = createContext<RowLabelScope>({ data: {}, rowNumber: 0, path: '' })
export const RowLabelScopeProvider = RowLabelContext.Provider

export function useRowLabel<T = Record<string, unknown>>(): {
  data: T
  rowNumber: number
  path: string
} {
  const scope = useContext(RowLabelContext)
  return { data: scope.data as T, rowNumber: scope.rowNumber, path: scope.path }
}

// ---- selection (bulk list actions) -----------------------------------------
// Payload's useSelection over our SelectionBar scope. `selected` mirrors the
// admin's Map shape; `docs` is a desktop extra with the full records.
export function useSelection(): {
  count: number
  totalDocs: number
  selected: Map<string, boolean>
  selectedIDs: string[]
  docs: Record<string, unknown>[]
  setSelection: (id: string) => void
  toggleAll: () => void
  /** Payload's selection-as-query-string ('?where[id][in]=…') for REST calls. */
  getQueryParams: () => string
} {
  const scope = useSelectionScope()
  const selectedIDs = useMemo(
    () => (scope?.docs ?? []).map((d) => String(d.id ?? '')).filter(Boolean),
    [scope?.docs],
  )
  const selected = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const id of selectedIDs) m.set(id, true)
    return m
  }, [selectedIDs])
  return {
    count: scope?.docs.length ?? 0,
    totalDocs: scope?.totalDocs ?? 0,
    selected,
    selectedIDs,
    docs: scope?.docs ?? [],
    setSelection: () => {},
    toggleAll: () => scope?.clear(),
    getQueryParams: () =>
      selectedIDs.length > 0 ? `?where[id][in]=${selectedIDs.join(',')}` : '',
  }
}

// ---- modal ------------------------------------------------------------------
// Payload proxies @faceless-ui/modal: string-keyed open state shared between
// useModal() and <Modal slug>. A module store keeps it context-free (actions
// mount modals as siblings of their buttons).
const openModals = new Set<string>()
const modalSubs = new Set<() => void>()
const notifyModals = () => {
  for (const cb of modalSubs) cb()
}

export function useModal(): {
  openModal: (slug: string) => void
  closeModal: (slug: string) => void
  toggleModal: (slug: string) => void
  isModalOpen: (slug: string) => boolean
  closeAllModals: () => void
} {
  const [, bump] = useState(0)
  useEffect(() => {
    const cb = () => bump((x) => x + 1)
    modalSubs.add(cb)
    return () => {
      modalSubs.delete(cb)
    }
  }, [])
  return {
    openModal: (slug) => {
      openModals.add(slug)
      notifyModals()
    },
    closeModal: (slug) => {
      openModals.delete(slug)
      notifyModals()
    },
    toggleModal: (slug) => {
      if (openModals.has(slug)) openModals.delete(slug)
      else openModals.add(slug)
      notifyModals()
    },
    isModalOpen: (slug) => openModals.has(slug),
    closeAllModals: () => {
      openModals.clear()
      notifyModals()
    },
  }
}

// ---- document drawer ---------------------------------------------------------
// Payload opens a nested editor drawer; on desktop the same intent is an
// editor TAB. useDocumentDrawer(...) → [Drawer, Toggler, { openDrawer, ... }].
export function useDocumentDrawer({
  collectionSlug,
  id,
}: {
  collectionSlug: string
  id?: string | number
}): [
  React.ComponentType<{ children?: React.ReactNode }>,
  React.ComponentType<{ children?: React.ReactNode; className?: string }>,
  { openDrawer: () => void; closeDrawer: () => void; isDrawerOpen: boolean },
] {
  const openDrawer = useCallback(() => {
    const sink = getShimNavSink()
    if (!sink) return
    if (id != null) sink.openEditor(collectionSlug, String(id))
    else sink.openList(collectionSlug)
  }, [collectionSlug, id])

  const Drawer = useMemo(
    () =>
      function ShimDocumentDrawer() {
        return null // the tab IS the drawer on desktop
      },
    [],
  )
  const Toggler = useMemo(
    () =>
      function ShimDocumentDrawerToggler({
        children,
        className,
      }: {
        children?: React.ReactNode
        className?: string
      }) {
        return (
          <button type="button" className={className} onClick={openDrawer}>
            {children}
          </button>
        )
      },
    [openDrawer],
  )
  return [Drawer, Toggler, { openDrawer, closeDrawer: () => {}, isDrawerOpen: false }]
}

// ---- form fields selector -----------------------------------------------------
// Payload's useFormFields(([fields, dispatch]) => ...) — a selector over the
// admin form's field map. Re-expressed over RHF: `fields` is a lazy proxy
// where fields[path] yields { value } from the live form values.
export function useFormFields<T>(
  selector: (args: [Record<string, { value: unknown }>, () => void]) => T,
): T {
  const engine = useFormEngine()
  // Subscribe to all values so the selector re-runs on any change.
  useWatch({ control: engine.control })
  const fieldsProxy = new Proxy(
    {},
    {
      get: (_t, prop: string) => ({ value: engine.getValues(prop) }),
      has: () => true,
    },
  ) as Record<string, { value: unknown }>
  return selector([fieldsProxy, () => {}])
}

/** Payload's useAllFormFields — [fields, dispatchFields] over the whole form. */
export function useAllFormFields(): [Record<string, { value: unknown }>, () => void] {
  const engine = useFormEngine()
  useWatch({ control: engine.control })
  const fieldsProxy = new Proxy(
    {},
    {
      get: (_t, prop: string) => ({ value: engine.getValues(prop) }),
      has: () => true,
    },
  ) as Record<string, { value: unknown }>
  return [fieldsProxy, () => {}]
}

/** List-view query context — desktop lists are local-first; minimal surface. */
export function useListQuery(): {
  data: { docs: Record<string, unknown>[]; totalDocs: number }
  refineListData: () => void
} {
  const scope = useSelectionScope()
  return {
    data: { docs: scope?.docs ?? [], totalDocs: scope?.totalDocs ?? 0 },
    refineListData: () => {},
  }
}

/** Table column controls — resetting maps onto the desktop's own
 *  gear-icon column config when the selection scope provides it. */
export function useTableColumns(): {
  columns: unknown[]
  setActiveColumns: () => void
  resetColumns: () => Promise<void>
  resetColumnsState: () => Promise<void>
} {
  const scope = useSelectionScope()
  const reset = async () => {
    scope?.resetColumns?.()
  }
  return { columns: [], setActiveColumns: () => {}, resetColumns: reset, resetColumnsState: reset }
}
