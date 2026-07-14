// Thin REST wrappers for Payload's document versions API.
//
// Versions are server-side only (not stored in the local-first RxDB layer), so
// these call the Payload REST endpoints directly. Mirrors the fetch/error style
// of lib/api.ts: `JWT ${token}` auth, useful messages, offline detection.
import { normalizeServerURL } from '../../lib/settings'

/** One entry returned by Payload's versions REST API. */
export type VersionDoc = {
  id: string
  createdAt: string
  updatedAt: string
  /** The document snapshot at this version (includes `_status`). */
  version: Record<string, unknown>
  /** Set when this version was produced by autosave. */
  autosave?: boolean
}

type PaginatedDocs = {
  docs?: VersionDoc[]
}

/** Wrap a fetch so network failures surface as an offline message. */
async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new Error('Versions require a connection to the server.')
  }
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `JWT ${token}`, Accept: 'application/json' }
}

/** Pull the first useful message out of a Payload error body. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { errors?: Array<{ message?: string }>; message?: string }
    return body?.errors?.[0]?.message || body?.message || fallback
  } catch {
    return fallback
  }
}

/**
 * List versions for a document, newest first.
 *
 * GET {serverURL}/api/{slug}/versions
 *   ?where[parent][equals]={docId}&sort=-updatedAt&limit={limit}&depth=0
 */
export async function listVersions(
  serverURL: string,
  token: string,
  slug: string,
  docId: string,
  limit = 30,
): Promise<VersionDoc[]> {
  const base = normalizeServerURL(serverURL)
  const url = new URL(`${base}/api/${slug}/versions`)
  url.searchParams.set('where', JSON.stringify({ parent: { equals: docId } }))
  url.searchParams.set('sort', '-updatedAt')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('depth', '0')

  const res = await safeFetch(url.toString(), { headers: authHeaders(token) })
  if (!res.ok) {
    throw new Error(await errorMessage(res, `Could not load versions (${res.status}).`))
  }
  const data = (await res.json()) as PaginatedDocs
  return data.docs ?? []
}

/**
 * Restore a document to a specific version.
 *
 * POST {serverURL}/api/{slug}/versions/{versionId} (empty body) → restored doc.
 */
export async function restoreVersion(
  serverURL: string,
  token: string,
  slug: string,
  versionId: string,
): Promise<Record<string, unknown>> {
  const base = normalizeServerURL(serverURL)
  const url = `${base}/api/${slug}/versions/${versionId}`

  const res = await safeFetch(url, { method: 'POST', headers: authHeaders(token) })
  if (!res.ok) {
    throw new Error(await errorMessage(res, `Could not restore this version (${res.status}).`))
  }
  const data = (await res.json()) as { doc?: Record<string, unknown> }
  return data.doc ?? {}
}
