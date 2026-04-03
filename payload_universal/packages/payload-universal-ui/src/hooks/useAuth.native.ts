/**
 * useAuth — Native implementation.
 *
 * Wraps admin-native's useAuth to match @payloadcms/ui signature.
 */
import { useAuth as useAdminNativeAuth } from '@payload-universal/admin-native'

export type UseAuthReturn = {
  user: Record<string, unknown> | null
  permissions: Record<string, unknown>
  logOut: () => Promise<void>
  token: string | null
}

export function useAuth(): UseAuthReturn {
  const auth = useAdminNativeAuth()
  return {
    user: auth.user,
    permissions: {},
    logOut: auth.logout,
    token: auth.token,
  }
}
