/**
 * @payload-universal/client-validators
 *
 * Client-safe field validators and hooks for the Payload mobile admin.
 * Zero Node.js dependencies — runs in Hermes, JSC, and V8.
 *
 * Architecture:
 *   Payload Config (server)
 *       → Built-in validators ported from payload-main/packages/payload/src/fields/validations.ts
 *       → Custom validators defined per-app in a client-safe module
 *   Mobile App (Hermes)
 *       → runValidation() walks the field schema and runs all validators
 *       → runBeforeValidateHooks() / runBeforeChangeHooks() / runAfterChangeHooks()
 *           execute hooks in Payload's prescribed order
 */

// Types
export type {
  ClientValidate,
  ClientValidateOptions,
  ClientTranslate,
  ClientFieldHook,
  ClientFieldHookArgs,
  ClientCollectionHook,
  ClientCollectionHookArgs,
  ClientFieldConfig,
  ClientCollectionConfig,
  ClientHooksConfig,
  ValidationErrors,
  ValidationResult,
} from './types'

// Built-in validators (can be used individually or via runValidation)
export { builtinValidators } from './builtinValidators'
export {
  text,
  textarea,
  email,
  password,
  number,
  checkbox,
  date,
  code,
  json,
  select,
  radio,
  point,
  array,
  blocks,
  relationship,
  upload,
  richText,
} from './builtinValidators'

// Validation runner
export { runValidation } from './runValidation'

// Hooks runners
export {
  runBeforeValidateHooks,
  runBeforeChangeHooks,
  runAfterChangeHooks,
  runAfterReadHooks,
} from './runHooks'
