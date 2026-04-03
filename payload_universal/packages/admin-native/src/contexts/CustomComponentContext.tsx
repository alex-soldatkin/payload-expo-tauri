/**
 * CustomComponentContext — context-based custom component override system.
 *
 * Allows injecting custom field/view/admin components from codegen output
 * (or hand-written native components) into the standard FieldRenderer
 * dispatch pipeline.
 *
 * When a `CustomComponentProvider` wraps the component tree with a registry,
 * `FieldRenderer` checks for per-field-path overrides before falling back
 * to the type-based `fieldRegistry`.
 *
 * No registry = no overrides = zero behavioral change (backward-compatible).
 */
import React, { createContext, useContext } from 'react'

import type {
  ComponentSlot,
  CustomComponentRegistry,
  CustomFieldEntry,
} from '../types'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CustomComponentCtx = createContext<CustomComponentRegistry | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

type ProviderProps = {
  registry: CustomComponentRegistry
  children: React.ReactNode
}

/**
 * Wraps children with a custom component registry.
 *
 * Place this inside `PayloadNativeProvider` so custom components have
 * access to auth and schema context.
 */
export const CustomComponentProvider: React.FC<ProviderProps> = ({
  registry,
  children,
}) => (
  <CustomComponentCtx.Provider value={registry}>
    {children}
  </CustomComponentCtx.Provider>
)

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Access the full custom component registry (may be null). */
export const useCustomComponentRegistry = (): CustomComponentRegistry | null =>
  useContext(CustomComponentCtx)

/**
 * Look up a custom component override for a specific field + slot.
 *
 * @param collectionSlug - Collection slug (e.g. 'posts')
 * @param fieldPath      - Dot-path to the field (e.g. 'title', 'gallery.images')
 * @param slot           - Which component slot to look up (default: 'Field')
 * @returns The override component, or null if none registered
 */
export const useCustomComponent = (
  collectionSlug: string | undefined,
  fieldPath: string,
  slot: ComponentSlot = 'Field',
): React.ComponentType<any> | null => {
  const registry = useContext(CustomComponentCtx)
  if (!registry) return null

  // Try collection-scoped key first: "posts.title"
  if (collectionSlug) {
    const scopedKey = `${collectionSlug}.${fieldPath}`
    const entry = registry.fields[scopedKey]
    if (entry) {
      const component = resolveSlot(entry, slot)
      if (component) return component
    }
  }

  // Try unscoped key: "title" (applies to all collections)
  const entry = registry.fields[fieldPath]
  if (entry) {
    const component = resolveSlot(entry, slot)
    if (component) return component
  }

  return null
}

/**
 * Get the beforeInput/afterInput slot arrays for a field.
 */
export const useCustomFieldSlots = (
  collectionSlug: string | undefined,
  fieldPath: string,
): { beforeInput: React.ComponentType<any>[]; afterInput: React.ComponentType<any>[] } => {
  const registry = useContext(CustomComponentCtx)
  const empty = { beforeInput: [], afterInput: [] }
  if (!registry) return empty

  const key = collectionSlug ? `${collectionSlug}.${fieldPath}` : fieldPath
  const entry = registry.fields[key]
  if (!entry || typeof entry === 'function') return empty

  return {
    beforeInput: (entry as CustomFieldEntry).beforeInput ?? [],
    afterInput: (entry as CustomFieldEntry).afterInput ?? [],
  }
}

/**
 * Look up a custom view component.
 */
export const useCustomView = (
  viewKey: string,
): { Component: React.ComponentType<any>; tab?: { label: string } } | null => {
  const registry = useContext(CustomComponentCtx)
  if (!registry) return null
  return registry.views[viewKey] ?? null
}

/**
 * Look up a custom admin-level component (Nav, beforeDashboard, etc.).
 */
export const useCustomAdminComponent = (
  key: string,
): React.ComponentType<any> | null => {
  const registry = useContext(CustomComponentCtx)
  if (!registry) return null
  return registry.admin[key] ?? null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveSlot(
  entry: CustomFieldEntry | React.ComponentType<any>,
  slot: ComponentSlot,
): React.ComponentType<any> | null {
  // If the entry is a bare component, treat it as the Field slot
  if (typeof entry === 'function') {
    return slot === 'Field' ? entry : null
  }

  // Otherwise it's a CustomFieldEntry object
  return (entry as Record<string, any>)[slot] ?? null
}
