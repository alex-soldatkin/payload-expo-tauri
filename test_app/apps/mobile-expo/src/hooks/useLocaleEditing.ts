/**
 * useLocaleEditing — Localizer parity for edit screens.
 *
 * Payload's web admin Localizer switches the WHOLE document view to another
 * locale. Mobile mirrors that:
 *
 *   - DEFAULT locale: untouched — local-first RxDB remains the data source
 *     and save path (callers keep their existing handlers).
 *   - NON-default locale: this hook loads the document straight from the
 *     Payload REST API with `?locale=X&fallback-locale=none` and saves via
 *     REST PATCH `?locale=X` — bypassing RxDB entirely (the local DB only
 *     models the default locale). Whole-doc PATCH with the locale param is
 *     correct Payload semantics: non-localized fields write through,
 *     localized fields write only the active locale.
 *
 * Callers show a subtle "es · online" pill while a non-default locale is
 * active (the doc is being edited live against the server).
 */
import { useCallback, useEffect, useState } from 'react'

type UseLocaleEditingArgs = {
  /** Whether localization is configured at all (schema.localization truthy). */
  enabled: boolean
  baseURL: string
  token: string | null
  /** Collection slug, or global slug when `isGlobal` is true. */
  slug: string
  /** Document id (collections only — omit for globals). */
  docId?: string
  /** Treat `slug` as a global (`/api/globals/{slug}`). */
  isGlobal?: boolean
  /** The schema's default locale code. */
  defaultLocale: string
  /** Append `draft=true` (drafts-enabled collections — loads newest draft). */
  draft?: boolean
}

export type UseLocaleEditingResult = {
  /** Currently active locale code (starts at the default locale). */
  activeLocale: string
  setActiveLocale: (locale: string) => void
  /** True when editing the default locale (local-first path). */
  isDefaultLocale: boolean
  /** Server doc for the active NON-default locale (null while loading / default). */
  remoteDoc: Record<string, unknown> | null
  remoteLoading: boolean
  remoteError: string | null
  /** PATCH the doc against the active non-default locale. Throws on failure. */
  saveRemote: (data: Record<string, unknown>, options?: { status?: 'draft' | 'published' }) => Promise<void>
}

const buildHeaders = (token: string | null): Record<string, string> => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...(token ? { Authorization: `JWT ${token}` } : {}),
})

export function useLocaleEditing({
  enabled,
  baseURL,
  token,
  slug,
  docId,
  isGlobal = false,
  defaultLocale,
  draft = false,
}: UseLocaleEditingArgs): UseLocaleEditingResult {
  const [activeLocale, setActiveLocale] = useState(defaultLocale)
  const [remoteDoc, setRemoteDoc] = useState<Record<string, unknown> | null>(null)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)

  const isDefaultLocale = !enabled || activeLocale === defaultLocale

  const docURL = isGlobal
    ? `${baseURL}/api/globals/${slug}`
    : `${baseURL}/api/${slug}/${docId ?? ''}`

  // Load the doc from the server whenever a non-default locale is active.
  useEffect(() => {
    if (isDefaultLocale || (!isGlobal && !docId)) {
      setRemoteDoc(null)
      setRemoteError(null)
      setRemoteLoading(false)
      return
    }

    let cancelled = false
    const load = async () => {
      setRemoteLoading(true)
      setRemoteError(null)
      try {
        const url = new URL(docURL)
        url.searchParams.set('locale', activeLocale)
        url.searchParams.set('fallback-locale', 'none')
        url.searchParams.set('depth', '0')
        if (draft) url.searchParams.set('draft', 'true')

        const res = await fetch(url.toString(), { headers: buildHeaders(token) })
        if (!res.ok) throw new Error(`Failed to load locale "${activeLocale}" (${res.status})`)
        const json = (await res.json()) as Record<string, unknown>
        if (!cancelled) setRemoteDoc(json)
      } catch (err) {
        if (!cancelled) {
          setRemoteDoc(null)
          setRemoteError(err instanceof Error ? err.message : 'Failed to load locale')
        }
      } finally {
        if (!cancelled) setRemoteLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isDefaultLocale, isGlobal, docId, docURL, activeLocale, token, draft])

  const saveRemote = useCallback(
    async (data: Record<string, unknown>, options?: { status?: 'draft' | 'published' }) => {
      const url = new URL(docURL)
      url.searchParams.set('locale', activeLocale)
      url.searchParams.set('depth', '0')
      // Saving as draft must not run full publish validation server-side.
      if (options?.status === 'draft') url.searchParams.set('draft', 'true')

      const body = options?.status ? { ...data, _status: options.status } : data
      const res = await fetch(url.toString(), {
        method: isGlobal ? 'POST' : 'PATCH',
        headers: buildHeaders(token),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          errors?: Array<{ message?: string }>
        }
        throw new Error(
          errBody.errors?.[0]?.message || `Failed to save locale "${activeLocale}" (${res.status})`,
        )
      }
      const json = (await res.json().catch(() => null)) as
        | { doc?: Record<string, unknown>; result?: Record<string, unknown> }
        | null
      const updated = json?.doc ?? json?.result
      if (updated && typeof updated === 'object') setRemoteDoc(updated)
    },
    [docURL, activeLocale, token, isGlobal],
  )

  return {
    activeLocale,
    setActiveLocale,
    isDefaultLocale,
    remoteDoc,
    remoteLoading,
    remoteError,
    saveRemote,
  }
}
