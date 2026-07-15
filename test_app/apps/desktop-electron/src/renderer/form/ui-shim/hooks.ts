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
import { createContext, useCallback, useContext, useMemo } from 'react'
import { useWatch } from 'react-hook-form'
import { useFormEngine } from '../FieldRenderer'

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
  const engine = useFormEngine()
  return { id: engine.docId, collectionSlug: engine.slug }
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
  const engine = useFormEngine()
  const user = useMemo(() => decodeJwtUser(engine.token) as TUser | null, [engine.token])
  return { user, token: engine.token }
}

export function useConfig(): {
  config: {
    serverURL: string
    routes: { admin: string; api: string }
    collections: unknown[]
    globals: unknown[]
  }
} {
  const engine = useFormEngine()
  return useMemo(
    () => ({
      config: {
        serverURL: engine.serverURL,
        routes: { admin: '/admin', api: '/api' },
        collections: [],
        globals: [],
      },
    }),
    [engine.serverURL],
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
