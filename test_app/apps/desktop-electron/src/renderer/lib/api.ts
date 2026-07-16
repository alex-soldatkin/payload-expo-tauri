// Thin REST wrappers for login + admin-schema fetch, with useful errors.
import { fetchAdminSchema } from '@payload-universal/admin-schema/client'
import type { AdminSchema } from '@payload-universal/admin-schema'
import { normalizeServerURL } from './settings'

export type LoginResult = {
  token: string
  email: string
}

/** Auth error the caller can distinguish (401/403 → clear token). */
export class AuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/**
 * POST {serverURL}/api/users/login with a JSON body.
 * Returns the JWT + confirmed email on success.
 */
export async function login(
  serverURL: string,
  email: string,
  password: string,
): Promise<LoginResult> {
  const base = normalizeServerURL(serverURL)
  let res: Response
  try {
    res = await fetch(`${base}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch (err) {
    throw new Error(
      `Could not reach ${base}. Check the server URL and that the server is running. (${
        err instanceof Error ? err.message : String(err)
      })`,
    )
  }

  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { errors?: Array<{ message?: string }>; message?: string }
      detail = body?.errors?.[0]?.message || body?.message || ''
    } catch {
      // ignore body parse errors
    }
    if (res.status === 401 || res.status === 400) {
      throw new Error(detail || 'Invalid email or password.')
    }
    throw new Error(detail || `Login failed (${res.status}).`)
  }

  const data = (await res.json()) as {
    token?: string
    user?: { email?: string }
    exp?: number
  }
  if (!data.token) {
    throw new Error('Server did not return an auth token.')
  }
  return { token: data.token, email: data.user?.email || email }
}

/**
 * Fetch the admin schema for a server using a JWT.
 * Throws {@link AuthError} on 401/403 so the caller can drop the token.
 */
export async function loadSchema(
  serverURL: string,
  token: string,
  language?: string,
): Promise<AdminSchema> {
  const base = normalizeServerURL(serverURL)
  try {
    return await fetchAdminSchema({
      baseURL: base,
      language: language || undefined,
      requestInit: { headers: { Authorization: `JWT ${token}` } },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // fetchAdminSchema encodes the HTTP status in its message, e.g. "(401)".
    const match = message.match(/\((\d{3})\)/)
    const status = match ? Number(match[1]) : 0
    if (status === 401 || status === 403) {
      throw new AuthError(status, 'Your session has expired. Please sign in again.')
    }
    throw new Error(`Could not load the admin schema from ${base}. ${message}`)
  }
}
