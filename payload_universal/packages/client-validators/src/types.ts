/**
 * Client-side validation and hooks type definitions.
 *
 * These types mirror Payload's server-side validator/hook contracts but strip
 * all Node.js and database dependencies so they can run in Hermes/JSC on mobile.
 */

// ---------------------------------------------------------------------------
// Validator types
// ---------------------------------------------------------------------------

/** Simplified translate function — matches Payload's t() signature. */
export type ClientTranslate = (key: string, vars?: Record<string, unknown>) => string

/** Options passed to every client-side validator. */
export type ClientValidateOptions = {
  /** Whether the field is marked as required in the schema. */
  required?: boolean
  /** Full document data. */
  data?: Record<string, unknown>
  /** Sibling field data (same level in the field tree). */
  siblingData?: Record<string, unknown>
  /** The operation being performed. */
  operation?: 'create' | 'update'
  /** Optional i18n translate function. Falls back to English defaults. */
  t?: ClientTranslate
  // Field-type-specific constraints (pulled from schema metadata)
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  minRows?: number
  maxRows?: number
  hasMany?: boolean
  /** Select/radio options from schema. */
  options?: Array<{ label?: string; value: string } | string>
}

/**
 * A client-safe field validator.
 * Returns `true` if valid, or an error message string.
 * May be async for validators that check local DB (e.g. uniqueness).
 */
export type ClientValidate<TValue = unknown> = (
  value: TValue | null | undefined,
  options: ClientValidateOptions,
) => Promise<string | true> | string | true

// ---------------------------------------------------------------------------
// Hook types
// ---------------------------------------------------------------------------

/** Arguments passed to client-side field hooks. */
export type ClientFieldHookArgs = {
  value: unknown
  previousValue?: unknown
  data: Record<string, unknown>
  siblingData: Record<string, unknown>
  operation: 'create' | 'update' | 'read'
  fieldPath: string
}

/** A client-side field hook. Can transform the value. */
export type ClientFieldHook = (
  args: ClientFieldHookArgs,
) => Promise<unknown> | unknown

/** Arguments passed to client-side collection hooks. */
export type ClientCollectionHookArgs = {
  data: Record<string, unknown>
  originalDoc?: Record<string, unknown>
  operation: 'create' | 'update' | 'delete'
  collectionSlug: string
}

/** A client-side collection hook. Can transform the entire document. */
export type ClientCollectionHook = (
  args: ClientCollectionHookArgs,
) => Promise<Record<string, unknown>> | Record<string, unknown>

// ---------------------------------------------------------------------------
// Configuration map
// ---------------------------------------------------------------------------

/** Per-field validation and hooks config. */
export type ClientFieldConfig = {
  /** Custom validator that overrides or extends the built-in one. */
  validate?: ClientValidate
  hooks?: {
    beforeValidate?: ClientFieldHook[]
    beforeChange?: ClientFieldHook[]
    afterChange?: ClientFieldHook[]
    afterRead?: ClientFieldHook[]
  }
}

/** Per-collection hooks and field overrides. */
export type ClientCollectionConfig = {
  hooks?: {
    beforeValidate?: ClientCollectionHook[]
    beforeChange?: ClientCollectionHook[]
    afterChange?: ClientCollectionHook[]
  }
  /** Field-path keyed config (e.g. 'title', 'gallery.images.0.caption'). */
  fields?: Record<string, ClientFieldConfig>
}

/**
 * The top-level config object that apps provide to wire up client-side
 * validation and hooks. Keyed by collection slug.
 */
export type ClientHooksConfig = {
  collections: Record<string, ClientCollectionConfig>
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

/** Map of field path to error message. Compatible with admin-native's FormErrors. */
export type ValidationErrors = Record<string, string>

export type ValidationResult = {
  valid: boolean
  errors: ValidationErrors
}
