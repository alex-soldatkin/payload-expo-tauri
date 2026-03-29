import type { AdminSchema } from './index'

export type FetchAdminSchemaArgs = {
  baseURL?: string
  fetch?: typeof fetch
  language?: string
  path?: string
  requestInit?: RequestInit
}

export const deserializeSchemaMap = <T>(entries: Array<[string, T]>) => {
  return new Map(entries)
}

const joinURL = (baseURL: string | undefined, path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  if (!baseURL) {
    return path
  }

  const normalizedBase = baseURL.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${normalizedBase}${normalizedPath}`
}

export const fetchAdminSchema = async ({
  baseURL,
  fetch: fetchImpl = fetch,
  language,
  path = '/api/admin-schema',
  requestInit,
}: FetchAdminSchemaArgs = {}): Promise<AdminSchema> => {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetchAdminSchema requires a fetch implementation')
  }

  const joined = joinURL(baseURL, path)
  const url = new URL(joined, baseURL || 'http://localhost')

  if (language) {
    url.searchParams.set('language', language)
  }

  const requestURL = joined.startsWith('http') || baseURL ? url.toString() : url.pathname + url.search

  const response = await fetchImpl(requestURL, {
    ...requestInit,
    headers: {
      Accept: 'application/json',
      ...(requestInit?.headers || {}),
    },
  })

  if (!response.ok) {
    let detail = ''
    try {
      const text = await response.text()
      if (text) {
        detail = text
      }
    } catch {
      // ignore
    }

    const suffix = detail ? `: ${detail}` : ''
    throw new Error(`Failed to fetch admin schema (${response.status})${suffix}`)
  }

  return (await response.json()) as AdminSchema
}
