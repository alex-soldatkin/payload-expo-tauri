import type { AdminSchema } from '@payload-universal/admin-schema'

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------

export type AuthState = {
  token: string | null
  user: Record<string, unknown> | null
  isAuthenticated: boolean
  isLoading: boolean
}

// ---------------------------------------------------------------------------
// Provider context value
// ---------------------------------------------------------------------------

export type PayloadNativeContextValue = {
  schema: AdminSchema | null
  auth: AuthState
  baseURL: string
  login: (email: string, password: string) => Promise<void>
  firstRegister: (email: string, password: string, confirmPassword: string) => Promise<void>
  logout: () => Promise<void>
  refreshSchema: () => Promise<void>
  isSchemaLoading: boolean
  schemaError: string | null
}
