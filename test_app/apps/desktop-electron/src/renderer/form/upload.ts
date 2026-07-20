// Direct multipart upload to a Payload upload collection.
//
// Payload's REST upload endpoint reads the binary from the `file` part and ALL
// other document fields from a single `_payload` JSON part — NOT from individual
// form fields. Sending `alt` as a bare form field works for collections where
// `alt` is optional (some `media`), but silently drops it for collections that
// require it (assemblon's `files`), so those uploads fail server-side with
// "This field is required" / "No files were uploaded". Always use `_payload`.
//
// The renderer is not served from the Payload origin and auth is a JWT header,
// so URLs are absolute and Authorization is attached explicitly.

/** A minimal upload-doc shape returned by Payload after a successful POST. */
export type UploadedDoc = {
  id: string
  url?: string
  filename?: string
  mimeType?: string
  filesize?: number
  [key: string]: unknown
}

export type UploadResult = { doc: UploadedDoc }

/**
 * Upload a File to a Payload upload collection as multipart/form-data.
 *
 * `fields` carries every non-file document value (e.g. `alt`) and is sent as the
 * `_payload` JSON part Payload expects. The browser sets the multipart
 * Content-Type + boundary itself — never set it by hand.
 *
 * When `docId` is given, the file replaces the binary on that existing document
 * (PATCH /api/{slug}/{id}); otherwise a new document is created (POST
 * /api/{slug}). Throws with the server's first field/error message on failure.
 */
export async function uploadToCollection(
  file: File,
  slug: string,
  serverURL: string,
  token: string,
  fields: Record<string, unknown> = {},
  docId?: string,
): Promise<UploadedDoc> {
  const form = new FormData()
  form.append('file', file)
  // Only emit `_payload` when there are fields — an empty `{}` is harmless but
  // some setups are picky; keep the request minimal.
  if (Object.keys(fields).length > 0) {
    form.append('_payload', JSON.stringify(fields))
  }

  const path = docId ? `/api/${slug}/${docId}` : `/api/${slug}`
  const res = await fetch(new URL(path, serverURL).toString(), {
    method: docId ? 'PATCH' : 'POST',
    // NB: no Content-Type — fetch derives the multipart boundary from FormData.
    headers: token ? { Authorization: `JWT ${token}` } : undefined,
    body: form,
  })

  type ResponseBody = {
    doc?: UploadedDoc
    errors?: Array<{ message?: string; data?: unknown }>
  }
  let json: ResponseBody | null = null
  try {
    json = (await res.json()) as ResponseBody
  } catch {
    json = null
  }

  if (!res.ok || !json?.doc?.id) {
    const serverMsg = firstErrorMessage(json)
    throw new Error(serverMsg || `Upload failed (${res.status})`)
  }
  return json.doc
}

/** Pull the most useful message out of Payload's nested error envelope. */
function firstErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const errors = (json as { errors?: Array<unknown> }).errors
  if (!Array.isArray(errors) || errors.length === 0) return null
  const first = errors[0] as {
    message?: string
    data?: { errors?: Array<{ message?: string }> }
  }
  // Upload validation nests the field errors one level deeper.
  return first.data?.errors?.[0]?.message ?? first.message ?? null
}
