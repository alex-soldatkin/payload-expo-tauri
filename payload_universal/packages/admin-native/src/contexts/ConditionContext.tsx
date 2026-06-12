/**
 * ConditionContext — client-side `admin.condition` support.
 *
 * Payload `admin.condition` functions cannot serialize through the admin
 * schema JSON. The server emits markers instead:
 *   - `admin.hasCondition: true` on each affected client field
 *   - `AdminSchema.conditions[slug] = [fieldPaths]`
 *
 * The mobile app registers the actual condition functions here as
 * Metro-bundled code (the same pattern as client validators and action
 * handlers — they live in the app bundle, not in serialized JSON):
 *
 *   const conditions: ConditionRegistry = {
 *     posts: {
 *       publishedDate: (data, siblingData) => data._status === 'published',
 *     },
 *   }
 *   <ConditionRegistryProvider registry={conditions}>...</ConditionRegistryProvider>
 *
 * DocumentForm evaluates registered conditions against the live form data
 * and hides fields whose condition returns false.
 *
 * FAIL-OPEN: a field whose schema carries `admin.hasCondition: true` but has
 * NO registered client condition stays VISIBLE. Conditionally-hidden web
 * fields therefore remain visible on mobile until the app registers a
 * matching condition — treat `hasCondition: true` conservatively (e.g.
 * respect it before submitting). Conditions that throw also fail open.
 *
 * Path convention (matches AdminSchema.conditions):
 *   - dot paths from the collection root (e.g. 'group.subField')
 *   - array subfields WITHOUT row indices ('items.title' — runtime form
 *     paths like 'items.0.title' are normalized before lookup)
 *   - block subfields as '{fieldPath}.{blockSlug}.{name}' (resolved via the
 *     row's `blockType` in the live form data)
 *   - unnamed row/collapsible fields use '_index-{n}' segments; those have
 *     no stable runtime form path and are currently not matched
 */
import React, { createContext, useContext } from 'react'

import { getByPath } from '../utils/schemaHelpers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A client-side condition function. Mirrors Payload's `admin.condition`
 * signature minus the server-only ctx argument: return `false` to hide
 * the field, anything else keeps it visible.
 */
export type ClientFieldCondition = (
  data: Record<string, unknown>,
  siblingData: Record<string, unknown>,
) => boolean

/**
 * Registry of condition functions defined in the mobile app (Metro-bundled).
 * Keyed by collection/global slug → field schema path → condition.
 */
export type ConditionRegistry = {
  [collectionSlug: string]: {
    [fieldPath: string]: ClientFieldCondition
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ConditionCtx = createContext<ConditionRegistry | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

type ConditionRegistryProviderProps = {
  registry: ConditionRegistry
  children: React.ReactNode
}

/**
 * Wraps children with the client condition registry.
 *
 * Place this alongside `CustomComponentProvider` / `ActionRegistryProvider`
 * in the app root so every DocumentForm can evaluate conditions.
 */
export const ConditionRegistryProvider: React.FC<ConditionRegistryProviderProps> = ({
  registry,
  children,
}) => (
  <ConditionCtx.Provider value={registry}>
    {children}
  </ConditionCtx.Provider>
)

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Access the full condition registry (may be null). */
export const useConditionRegistry = (): ConditionRegistry | null =>
  useContext(ConditionCtx)

/**
 * Get the condition map for a specific collection/global slug.
 * Returns null when no conditions are registered — callers can use the
 * null to skip evaluation entirely (and keep memo deps stable).
 */
export const useCollectionConditions = (
  collectionSlug: string | undefined,
): Record<string, ClientFieldCondition> | null => {
  const registry = useContext(ConditionCtx)
  if (!registry || !collectionSlug) return null
  return registry[collectionSlug] ?? null
}

// ---------------------------------------------------------------------------
// Evaluation helpers (pure — usable outside React)
// ---------------------------------------------------------------------------

const isIndexSegment = (segment: string): boolean => /^\d+$/.test(segment)

/** Strip numeric array-row segments: 'items.0.title' → 'items.title'. */
const toSchemaPath = (path: string): string =>
  path.split('.').filter((seg) => !isIndexSegment(seg)).join('.')

/**
 * Resolve the registered condition for a runtime form path.
 *
 * Tries, in order:
 *   1. the exact runtime path
 *   2. the index-normalized schema path ('items.0.title' → 'items.title')
 *   3. the block-scoped path '{fieldPath}.{blockSlug}.{name}' when the
 *      field's sibling row carries a `blockType` (blocks rows)
 */
export const resolveFieldCondition = (
  conditions: Record<string, ClientFieldCondition> | null | undefined,
  path: string,
  data: Record<string, unknown>,
): ClientFieldCondition | null => {
  if (!conditions || !path) return null

  if (conditions[path]) return conditions[path]

  const schemaPath = toSchemaPath(path)
  if (conditions[schemaPath]) return conditions[schemaPath]

  // Block subfield: conditions key is '{fieldPath}.{blockSlug}.{name}'.
  const segments = path.split('.')
  if (segments.length >= 2) {
    const parentPath = segments.slice(0, -1).join('.')
    const sibling = getByPath(data, parentPath)
    const blockType =
      sibling && typeof sibling === 'object'
        ? (sibling as Record<string, unknown>).blockType
        : undefined
    if (typeof blockType === 'string') {
      const blockKey = `${toSchemaPath(parentPath)}.${blockType}.${segments[segments.length - 1]}`
      if (conditions[blockKey]) return conditions[blockKey]
    }
  }

  return null
}

/**
 * Evaluate a field's visibility against the live form data.
 *
 * Returns false ONLY when a registered condition explicitly returns false.
 * No registered condition, or a condition that throws → visible (fail open).
 */
export const evaluateFieldVisibility = (
  conditions: Record<string, ClientFieldCondition> | null | undefined,
  path: string,
  data: Record<string, unknown>,
): boolean => {
  const condition = resolveFieldCondition(conditions, path, data)
  if (!condition) return true

  const segments = path.split('.')
  const parentPath = segments.slice(0, -1).join('.')
  const siblingData = parentPath ? getByPath(data, parentPath) : data

  try {
    return condition(
      data,
      (siblingData && typeof siblingData === 'object'
        ? siblingData
        : {}) as Record<string, unknown>,
    ) !== false
  } catch {
    // Conditions must never crash the form — fail open.
    return true
  }
}
