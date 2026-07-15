// REST wrappers for the globals editor. Globals are NOT synced by local-db
// (issue #27 slice), so this path is online-only and talks to Payload's REST
// API directly. Field trees come from schema.globals[slug] — the same
// serialized-schema-map shape used for collections.
import { deserializeSchemaMap } from '@payload-universal/admin-schema/client'
import type { AdminSchema } from '@payload-universal/admin-schema'
import type { SchemaField } from '../../form/types'
import { normalizeServerURL } from '../../lib/settings'

/**
 * Root field tree for a global — the globals analogue of getRootFields.
 * The serialized map stores `{ fields }` under the plain slug key.
 */
export function getGlobalRootFields(schema: AdminSchema, slug: string): SchemaField[] {
  const entries = schema.globals[slug]
  if (!entries) return []
  const map = deserializeSchemaMap(entries as Array<[string, unknown]>)
  const root = map.get(slug) as { fields?: SchemaField[] } | undefined
  return root?.fields ?? []
}

/** Pull a readable message out of a Payload error response body. */
async function payloadError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as {
      errors?: Array<{ message?: string }>
      message?: string
    }
    const first = body?.errors?.[0]?.message
    return first || body?.message || fallback
  } catch {
    return fallback
  }
}

/**
 * GET {serverURL}/api/globals/{slug}?depth=0 with a JWT.
 * Returns the global doc (may include globalType/updatedAt keys).
 */
export async function fetchGlobal(
  serverURL: string,
  token: string,
  slug: string,
): Promise<Record<string, unknown>> {
  const base = normalizeServerURL(serverURL)
  const res = await fetch(`${base}/api/globals/${slug}?depth=0`, {
    headers: { Authorization: `JWT ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(await payloadError(res, `Failed to load global (${res.status}).`))
  }
  return (await res.json()) as Record<string, unknown>
}

/**
 * POST {serverURL}/api/globals/{slug} with a JSON body (whole-doc write —
 * correct Payload semantics for globals). Returns the updated doc; surfaces
 * Payload validation errors ({errors:[{message}]}) as a thrown Error.
 */
export async function saveGlobal(
  serverURL: string,
  token: string,
  slug: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const base = normalizeServerURL(serverURL)
  const res = await fetch(`${base}/api/globals/${slug}`, {
    method: 'POST',
    headers: {
      Authorization: `JWT ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    throw new Error(await payloadError(res, `Save failed (${res.status}).`))
  }
  // Payload wraps the updated doc under `result` on success; tolerate either.
  const body = (await res.json()) as {
    result?: Record<string, unknown>
    doc?: Record<string, unknown>
  } & Record<string, unknown>
  return body.result ?? body.doc ?? body
}
