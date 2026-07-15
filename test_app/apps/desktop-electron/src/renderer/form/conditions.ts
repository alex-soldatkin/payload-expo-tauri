// Client-side condition registry. Payload admin.condition functions cannot be
// serialized — the admin schema only marks fields with admin.hasCondition and
// lists their paths. The predicates are CODEGEN-EXTRACTED from the SSOT config
// sources (generated/conditions.gen.ts, re-run `pnpm codegen:native`); the
// hand-written entries below remain only as overrides and win on key clashes.
// Resolution and fail-open semantics mirror admin-native's ConditionContext.
import { getAtPath, normalizeIndexes, parentPath } from './paths'
import { generatedConditions } from '../generated/conditions.gen'

export type ConditionFn = (
  data: Record<string, unknown>,
  siblingData: Record<string, unknown>,
) => boolean

type Registry = Record<string, Record<string, ConditionFn>>

/** Hand-written overrides — merged OVER the generated registry. */
const overrides: Registry = {}

const registry: Registry = (() => {
  const merged: Registry = {}
  for (const [slug, conds] of Object.entries(generatedConditions)) {
    merged[slug] = { ...conds }
  }
  for (const [slug, conds] of Object.entries(overrides)) {
    merged[slug] = { ...merged[slug], ...conds }
  }
  return merged
})()

/**
 * Resolve the condition for a concrete form path: exact match first, then
 * index-normalized (`items.0.title` → `items.title`), then block-scoped
 * (`layout.0.internalPage` + blockType 'cta' → `layout.cta.internalPage`).
 */
function resolveCondition(slug: string, path: string, blockType?: string): ConditionFn | undefined {
  const bySlug = registry[slug]
  if (!bySlug) return undefined
  if (bySlug[path]) return bySlug[path]
  const normalized = normalizeIndexes(path)
  if (bySlug[normalized]) return bySlug[normalized]
  if (blockType) {
    const segs = normalized.split('.')
    const name = segs.pop()
    const scoped = [...segs, blockType, name].join('.')
    if (bySlug[scoped]) return bySlug[scoped]
  }
  return undefined
}

/**
 * Is the field at `path` visible? Fail-open: unregistered or throwing
 * conditions keep the field visible (matches mobile).
 */
export function isFieldVisible(
  slug: string,
  path: string,
  formData: Record<string, unknown>,
  blockType?: string,
): boolean {
  const fn = resolveCondition(slug, path, blockType)
  if (!fn) return true
  try {
    const sibling = getAtPath(formData, parentPath(path))
    return fn(formData, (sibling ?? {}) as Record<string, unknown>)
  } catch {
    return true
  }
}
