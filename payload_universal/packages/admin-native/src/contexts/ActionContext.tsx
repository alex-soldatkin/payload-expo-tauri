/**
 * ActionContext — provides collection-level action handlers to screens.
 *
 * Action **metadata** (label, icon, key) flows through the admin schema
 * so the mobile app can render native menu items dynamically.
 *
 * Action **handlers** (the actual logic) are defined per-app as code
 * bundled by Metro — just like client validators. They cannot be
 * serialized through JSON so they are provided via this context.
 *
 * Usage:
 *   <ActionRegistryProvider registry={actionHandlers}>
 *     <App />
 *   </ActionRegistryProvider>
 *
 * Then in screens:
 *   const listHandlers = useListActionHandlers('posts')
 *   const editHandlers = useEditActionHandlers('posts')
 */
import React, { createContext, useContext } from 'react'

import type {
  ActionHandler,
  ActionHandlerRegistry,
  EditActionContext,
  ListActionContext,
} from '../types'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ActionCtx = createContext<ActionHandlerRegistry | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

type ActionRegistryProviderProps = {
  registry: ActionHandlerRegistry
  children: React.ReactNode
}

/**
 * Wraps children with the action handler registry.
 *
 * Place this alongside (or inside) `CustomComponentProvider` in the
 * app root so all screens can access action handlers.
 */
export const ActionRegistryProvider: React.FC<ActionRegistryProviderProps> = ({
  registry,
  children,
}) => (
  <ActionCtx.Provider value={registry}>
    {children}
  </ActionCtx.Provider>
)

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Access the full action handler registry (may be null). */
export const useActionRegistry = (): ActionHandlerRegistry | null =>
  useContext(ActionCtx)

/**
 * Get list action handlers for a specific collection.
 *
 * Returns a Record<key, handler> so the screen can wire each
 * menu action's `onPress` to the corresponding handler.
 */
export const useListActionHandlers = (
  collectionSlug: string,
): Record<string, ActionHandler<ListActionContext>> => {
  const registry = useContext(ActionCtx)
  if (!registry) return {}
  return registry[collectionSlug]?.list ?? {}
}

/**
 * Get edit action handlers for a specific collection.
 */
export const useEditActionHandlers = (
  collectionSlug: string,
): Record<string, ActionHandler<EditActionContext>> => {
  const registry = useContext(ActionCtx)
  if (!registry) return {}
  return registry[collectionSlug]?.edit ?? {}
}
