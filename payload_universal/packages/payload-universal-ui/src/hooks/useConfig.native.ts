/**
 * useConfig — Native implementation.
 *
 * Wraps admin-native's useAdminSchema to match @payloadcms/ui signature.
 * Returns the client config from the admin schema.
 */
import { useAdminSchema } from '@payload-universal/admin-native'

export type UseConfigReturn = {
  config: Record<string, unknown>
}

export function useConfig(): UseConfigReturn {
  const schema = useAdminSchema()
  return {
    config: (schema as any)?.clientConfig ?? {},
  }
}
