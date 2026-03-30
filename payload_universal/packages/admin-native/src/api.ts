import type { PaginatedDocs } from './types'

export type PayloadAPIConfig = {
  baseURL: string
  token: string | null
}

/** A version entry returned by Payload's versions REST API. */
export type VersionDoc<T = Record<string, unknown>> = {
  id: string
  parent: string | { id: string }
  version: T
  createdAt: string
  updatedAt: string
  autosave?: boolean
  snapshot?: boolean
  latest?: boolean
  publishedLocale?: string
}

/**
 * Error thrown by the API client that preserves the full Payload response body.
 * The `body` property contains the parsed JSON with validation error details.
 */
export class PayloadAPIError extends Error {
  status: number
  body: Record<string, unknown>

  constructor(message: string, status: number, body: Record<string, unknown>) {
    super(message)
    this.name = 'PayloadAPIError'
    this.status = status
    this.body = body
  }
}

const buildHeaders = (token: string | null, extra?: Record<string, string>): Record<string, string> => ({
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...(token ? { Authorization: `JWT ${token}` } : {}),
  ...(extra ?? {}),
})

/** Throw a PayloadAPIError that preserves the full response body for field-level error parsing. */
const throwAPIError = async (res: Response, fallbackMsg: string): Promise<never> => {
  const body = await res.json().catch(() => ({}))
  const msg = body.errors?.[0]?.message || fallbackMsg
  throw new PayloadAPIError(msg, res.status, body)
}

/**
 * Thin REST client for the Payload API.
 * Every method takes an explicit config so the caller owns the auth state.
 */
export const payloadApi = {
  // --------------- Collections ---------------

  async find<T = Record<string, unknown>>(
    config: PayloadAPIConfig,
    collection: string,
    params?: {
      page?: number
      limit?: number
      sort?: string
      where?: Record<string, unknown>
      depth?: number
    },
  ): Promise<PaginatedDocs<T>> {
    const url = new URL(`${config.baseURL}/api/${collection}`)
    if (params?.page) url.searchParams.set('page', String(params.page))
    if (params?.limit) url.searchParams.set('limit', String(params.limit))
    if (params?.sort) url.searchParams.set('sort', params.sort)
    if (params?.depth != null) url.searchParams.set('depth', String(params.depth))
    if (params?.where) url.searchParams.set('where', JSON.stringify(params.where))

    const res = await fetch(url.toString(), { headers: buildHeaders(config.token) })
    if (!res.ok) throw new Error(`Failed to fetch ${collection} (${res.status})`)
    return res.json()
  },

  async findByID<T = Record<string, unknown>>(
    config: PayloadAPIConfig,
    collection: string,
    id: string,
    params?: { depth?: number },
  ): Promise<T> {
    const url = new URL(`${config.baseURL}/api/${collection}/${id}`)
    if (params?.depth != null) url.searchParams.set('depth', String(params.depth))

    const res = await fetch(url.toString(), { headers: buildHeaders(config.token) })
    if (!res.ok) throw new Error(`Failed to fetch ${collection}/${id} (${res.status})`)
    return res.json()
  },

  async create<T = Record<string, unknown>>(
    config: PayloadAPIConfig,
    collection: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${config.baseURL}/api/${collection}`, {
      method: 'POST',
      headers: buildHeaders(config.token),
      body: JSON.stringify(data),
    })
    if (!res.ok) await throwAPIError(res, `Failed to create ${collection} (${res.status})`)
    return (await res.json()).doc
  },

  async update<T = Record<string, unknown>>(
    config: PayloadAPIConfig,
    collection: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${config.baseURL}/api/${collection}/${id}`, {
      method: 'PATCH',
      headers: buildHeaders(config.token),
      body: JSON.stringify(data),
    })
    if (!res.ok) await throwAPIError(res, `Failed to update ${collection}/${id} (${res.status})`)
    return (await res.json()).doc
  },

  async deleteDoc(
    config: PayloadAPIConfig,
    collection: string,
    id: string,
  ): Promise<void> {
    const res = await fetch(`${config.baseURL}/api/${collection}/${id}`, {
      method: 'DELETE',
      headers: buildHeaders(config.token),
    })
    if (!res.ok) throw new Error(`Failed to delete ${collection}/${id} (${res.status})`)
  },

  // --------------- Versions ---------------

  /** Fetch paginated versions for a document. */
  async findVersions<T = Record<string, unknown>>(
    config: PayloadAPIConfig,
    collection: string,
    parentId: string,
    params?: {
      page?: number
      limit?: number
      sort?: string
    },
  ): Promise<PaginatedDocs<VersionDoc<T>>> {
    const url = new URL(`${config.baseURL}/api/${collection}/versions`)
    url.searchParams.set('where', JSON.stringify({ parent: { equals: parentId } }))
    url.searchParams.set('sort', params?.sort ?? '-updatedAt')
    if (params?.page) url.searchParams.set('page', String(params.page))
    if (params?.limit) url.searchParams.set('limit', String(params.limit))
    url.searchParams.set('depth', '0')

    const res = await fetch(url.toString(), { headers: buildHeaders(config.token) })
    if (!res.ok) throw new Error(`Failed to fetch versions for ${collection}/${parentId} (${res.status})`)
    return res.json()
  },

  /** Fetch a single version by ID. */
  async findVersionByID<T = Record<string, unknown>>(
    config: PayloadAPIConfig,
    collection: string,
    versionId: string,
  ): Promise<VersionDoc<T>> {
    const res = await fetch(`${config.baseURL}/api/${collection}/versions/${versionId}`, {
      headers: buildHeaders(config.token),
    })
    if (!res.ok) throw new Error(`Failed to fetch version ${versionId} (${res.status})`)
    return res.json()
  },

  /** Restore a document to a specific version. */
  async restoreVersion<T = Record<string, unknown>>(
    config: PayloadAPIConfig,
    collection: string,
    versionId: string,
  ): Promise<T> {
    const res = await fetch(`${config.baseURL}/api/${collection}/versions/${versionId}`, {
      method: 'POST',
      headers: buildHeaders(config.token),
    })
    if (!res.ok) await throwAPIError(res, `Failed to restore version ${versionId} (${res.status})`)
    return (await res.json()).doc
  },

  // --------------- Globals ---------------

  async findGlobal<T = Record<string, unknown>>(
    config: PayloadAPIConfig,
    slug: string,
  ): Promise<T> {
    const res = await fetch(`${config.baseURL}/api/globals/${slug}`, {
      headers: buildHeaders(config.token),
    })
    if (!res.ok) throw new Error(`Failed to fetch global ${slug} (${res.status})`)
    return res.json()
  },

  async updateGlobal<T = Record<string, unknown>>(
    config: PayloadAPIConfig,
    slug: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${config.baseURL}/api/globals/${slug}`, {
      method: 'POST',
      headers: buildHeaders(config.token),
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.errors?.[0]?.message || `Failed to update global ${slug} (${res.status})`)
    }
    return (await res.json()).result ?? (await res.json())
  },
}
