// Ambient scopes + app sinks for passthrough ACTION components (buttons and
// modals from listMenuItems / editMenuItems). Unlike field components, actions
// render OUTSIDE the form engine — in the selection bar and doc menus — so the
// document/selection context they expect from Payload's admin arrives via
// these providers, and app-level effects (navigation, toasts) via sinks the
// workspace registers at mount.
import { createContext, useContext } from 'react'

// ---- document scope (doc menus, context menus) -----------------------------
export type DocInfoScope = {
  slug: string
  docId: string | null
  serverURL?: string
  token?: string
}

const DocInfoContext = createContext<DocInfoScope | null>(null)
export const DocInfoScopeProvider = DocInfoContext.Provider
export const useDocInfoScope = () => useContext(DocInfoContext)

// ---- selection scope (bulk list actions) -----------------------------------
export type SelectionScope = {
  slug: string
  docs: Record<string, unknown>[]
  totalDocs: number
  clear: () => void
}

const SelectionContext = createContext<SelectionScope | null>(null)
export const SelectionScopeProvider = SelectionContext.Provider
export const useSelectionScope = () => useContext(SelectionContext)

// ---- app sinks --------------------------------------------------------------
// Registered once by the workspace; passthrough components reach them through
// useRouter (next/navigation alias), useDocumentDrawer and toast.
// Session identity (server + JWT) registered by the workspace — the fallback
// for shim hooks running outside both a form and an explicit scope.
type ShimSession = { serverURL: string; token: string }
let session: ShimSession | null = null
export const setShimSession = (next: ShimSession | null): void => {
  session = next
}
export const getShimSession = (): ShimSession | null => session

type NavSink = {
  openEditor: (slug: string, docId: string) => void
  openList: (slug: string) => void
}
let navSink: NavSink | null = null
export const setShimNavSink = (sink: NavSink | null): void => {
  navSink = sink
}
export const getShimNavSink = (): NavSink | null => navSink

export type ToastSink = (message: string, opts?: { type?: 'success' | 'error' | 'info' }) => void
let toastSink: ToastSink | null = null
export const setShimToastSink = (sink: ToastSink | null): void => {
  toastSink = sink
}

/** Payload re-exports sonner's `toast` from @payloadcms/ui — same surface. */
export const toast = Object.assign(
  (message: string, _opts?: unknown) => toastSink?.(message),
  {
    success: (message: string, _opts?: unknown) => toastSink?.(message, { type: 'success' }),
    error: (message: string, _opts?: unknown) => toastSink?.(message, { type: 'error' }),
    info: (message: string, _opts?: unknown) => toastSink?.(message, { type: 'info' }),
    warning: (message: string, _opts?: unknown) => toastSink?.(message, { type: 'info' }),
    /** sonner's persistent-progress toasts: shown as plain infos here. */
    loading: (message: string, _opts?: unknown) => {
      toastSink?.(message, { type: 'info' })
      return message
    },
    dismiss: (_id?: unknown) => {},
  },
)

/**
 * Parse a web-admin URL (as passed to router.push / Link href) into a
 * workspace navigation: /admin/collections/{slug}/{id} opens the editor,
 * /admin/collections/{slug} the list. Returns false when unparseable.
 */
export function navigateAdminURL(url: string): boolean {
  const m = /\/collections\/([^/?#]+)(?:\/([^/?#]+))?/.exec(url)
  if (!m || !navSink) return false
  const [, slug, id] = m
  if (id && id !== 'create') navSink.openEditor(slug, id)
  else navSink.openList(slug)
  return true
}
