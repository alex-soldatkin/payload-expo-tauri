import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { fetchAdminSchema } from '@payload-universal/admin-schema/client'

import type { AdminSchema, AuthState, MenuModel, PayloadNativeContextValue } from './types'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PayloadNativeContext = createContext<PayloadNativeContextValue | null>(null)

export const usePayloadNative = (): PayloadNativeContextValue => {
  const ctx = useContext(PayloadNativeContext)
  if (!ctx) throw new Error('usePayloadNative must be used within <PayloadNativeProvider>')
  return ctx
}

/** Shorthand: the full admin schema (or null while loading). */
export const useAdminSchema = (): AdminSchema | null => usePayloadNative().schema

/** Shorthand: the menu model extracted from the schema. */
export const useMenuModel = (): MenuModel | null => usePayloadNative().schema?.menuModel ?? null

/** Shorthand: auth state + login/logout/firstRegister helpers. */
export const useAuth = () => {
  const { auth, login, firstRegister, logout } = usePayloadNative()
  return { ...auth, login, firstRegister, logout }
}

/** Shorthand: the configured base URL. */
export const useBaseURL = (): string => usePayloadNative().baseURL

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

type Props = {
  baseURL: string
  children: React.ReactNode
  /** Supply a persisted token on launch (e.g. from SecureStore). */
  initialToken?: string | null
  /** Called whenever the token changes so the host app can persist it. */
  onTokenChange?: (token: string | null) => void
  /** Auth collection slug – defaults to "users". */
  authCollection?: string
}

export const PayloadNativeProvider: React.FC<Props> = ({
  baseURL,
  children,
  initialToken = null,
  onTokenChange,
  authCollection = 'users',
}) => {
  const [schema, setSchema] = useState<AdminSchema | null>(null)
  const [isSchemaLoading, setIsSchemaLoading] = useState(false)
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [auth, setAuth] = useState<AuthState>({
    token: initialToken,
    user: null,
    isAuthenticated: false,
    isLoading: Boolean(initialToken), // true while we validate the initial token
  })

  // Persist token changes to the host app
  const persistToken = useCallback(
    (token: string | null) => onTokenChange?.(token),
    [onTokenChange],
  )

  // Fetch admin schema using the current token
  const loadSchema = useCallback(
    async (token: string | null) => {
      if (!token) return
      setIsSchemaLoading(true)
      setSchemaError(null)
      try {
        const result = await fetchAdminSchema({
          baseURL,
          requestInit: { headers: { Authorization: `JWT ${token}` } },
        })
        setSchema(result)
      } catch (err) {
        setSchemaError(err instanceof Error ? err.message : 'Failed to load schema')
      } finally {
        setIsSchemaLoading(false)
      }
    },
    [baseURL],
  )

  // ---- Auth actions ----

  /**
   * Map a failed fetch response to a human-readable error message.
   * Error mapping table:
   *   TypeError (network)  → 'Cannot reach server — check the server URL and your connection'
   *   HTTP 401             → server message (e.g. 'The email or password provided is incorrect')
   *   HTTP 423             → server lock message (account locked by maxLoginAttempts)
   *   Any other non-ok     → body.errors[0].message || body.message || 'Login failed (status N)'
   */
  const mapLoginError = (err: unknown, status?: number, body?: Record<string, unknown>): Error => {
    if (err instanceof TypeError) {
      return new Error('Cannot reach server — check the server URL and your connection')
    }
    if (body && status) {
      const serverMsg =
        (body.errors as Array<{ message: string }> | undefined)?.[0]?.message ||
        (body.message as string | undefined)
      if (serverMsg) return new Error(serverMsg)
      return new Error(`Login failed (${status})`)
    }
    if (err instanceof Error) return err
    return new Error('Login failed')
  }

  /** Persist auth state and load the admin schema after a successful auth response. */
  const applyAuthResponse = useCallback(
    async (data: { token: string; user: Record<string, unknown> }) => {
      setAuth({ token: data.token, user: data.user, isAuthenticated: true, isLoading: false })
      persistToken(data.token)
      await loadSchema(data.token)
    },
    [persistToken, loadSchema],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      setAuth((prev) => ({ ...prev, isLoading: true }))
      let res: Response | undefined
      try {
        res = await fetch(`${baseURL}/api/${authCollection}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
      } catch (networkErr) {
        setAuth((prev) => ({ ...prev, isLoading: false }))
        throw mapLoginError(networkErr)
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>
        setAuth((prev) => ({ ...prev, isLoading: false }))
        throw mapLoginError(undefined, res.status, body)
      }
      try {
        const data = await res.json() as { token: string; user: Record<string, unknown> }
        await applyAuthResponse(data)
      } catch (err) {
        setAuth((prev) => ({ ...prev, isLoading: false }))
        throw err
      }
    },
    [baseURL, authCollection, applyAuthResponse],
  )

  const firstRegister = useCallback(
    async (email: string, password: string, confirmPassword: string) => {
      setAuth((prev) => ({ ...prev, isLoading: true }))
      let res: Response | undefined
      try {
        res = await fetch(`${baseURL}/api/${authCollection}/first-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, 'confirm-password': confirmPassword }),
        })
      } catch (networkErr) {
        setAuth((prev) => ({ ...prev, isLoading: false }))
        throw mapLoginError(networkErr)
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>
        setAuth((prev) => ({ ...prev, isLoading: false }))
        throw mapLoginError(undefined, res.status, body)
      }
      try {
        const data = await res.json() as { token: string; user: Record<string, unknown> }
        await applyAuthResponse(data)
      } catch (err) {
        setAuth((prev) => ({ ...prev, isLoading: false }))
        throw err
      }
    },
    [baseURL, authCollection, applyAuthResponse],
  )

  const logout = useCallback(async () => {
    try {
      if (auth.token) {
        await fetch(`${baseURL}/api/${authCollection}/logout`, {
          method: 'POST',
          headers: { Authorization: `JWT ${auth.token}` },
        }).catch(() => {})
      }
    } finally {
      setAuth({ token: null, user: null, isAuthenticated: false, isLoading: false })
      setSchema(null)
      persistToken(null)
    }
  }, [baseURL, authCollection, auth.token, persistToken])

  const refreshSchema = useCallback(
    () => loadSchema(auth.token),
    [loadSchema, auth.token],
  )

  // ---- Validate initial token on mount ----

  useEffect(() => {
    if (!initialToken) return
    let cancelled = false

    const validate = async () => {
      try {
        const res = await fetch(`${baseURL}/api/${authCollection}/me`, {
          headers: { Authorization: `JWT ${initialToken}` },
        })
        if (!res.ok) throw new Error('Token invalid')
        const data = await res.json()
        if (cancelled) return
        setAuth({ token: initialToken, user: data.user, isAuthenticated: true, isLoading: false })
        await loadSchema(initialToken)
      } catch {
        if (cancelled) return
        setAuth({ token: null, user: null, isAuthenticated: false, isLoading: false })
        persistToken(null)
      }
    }

    validate()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Memoised context value ----

  const value = useMemo<PayloadNativeContextValue>(
    () => ({ schema, auth, baseURL, login, firstRegister, logout, refreshSchema, isSchemaLoading, schemaError }),
    [schema, auth, baseURL, login, firstRegister, logout, refreshSchema, isSchemaLoading, schemaError],
  )

  return (
    <PayloadNativeContext.Provider value={value}>
      {children}
    </PayloadNativeContext.Provider>
  )
}
