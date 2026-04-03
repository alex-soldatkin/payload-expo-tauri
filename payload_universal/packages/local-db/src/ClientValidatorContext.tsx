/**
 * ClientValidatorProvider — React context that holds the app's client-side
 * validation and hooks configuration.
 *
 * Mount this at the app root (alongside LocalDBProvider) and pass in the
 * app-specific ClientHooksConfig. The useValidatedMutations hook reads it
 * automatically.
 */
import React, { createContext, useContext, type ReactNode } from 'react'
import type { ClientHooksConfig } from '@payload-universal/client-validators'

const ClientValidatorContext = createContext<ClientHooksConfig | null>(null)

export type ClientValidatorProviderProps = {
  config: ClientHooksConfig
  children: ReactNode
}

export function ClientValidatorProvider({ config, children }: ClientValidatorProviderProps) {
  return (
    <ClientValidatorContext.Provider value={config}>
      {children}
    </ClientValidatorContext.Provider>
  )
}

/**
 * Access the client-side hooks/validation config from context.
 * Returns null if no provider is mounted (validation will still run built-in validators).
 */
export function useClientValidatorConfig(): ClientHooksConfig | null {
  return useContext(ClientValidatorContext)
}
