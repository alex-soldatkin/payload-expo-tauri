/**
 * Client-safe built-in field validators.
 *
 * Ported from payload-main/packages/payload/src/fields/validations.ts
 * with all server dependencies (req, t, payload, config) removed.
 *
 * Uses hardcoded English messages with an optional t() override for i18n.
 *
 * This barrel re-exports every validator (grouped into sibling files by field
 * family) plus the registry mapping field type → built-in validator.
 */
import type { ClientValidate } from '../types'

import { text, textarea, email, password } from './text'
import { number, checkbox, date } from './numeric'
import { code, json, select, radio, point } from './structured'
import { array, blocks, relationship, upload, richText } from './collections'

export { text, textarea, email, password } from './text'
export { number, checkbox, date } from './numeric'
export { code, json, select, radio, point } from './structured'
export { array, blocks, relationship, upload, richText } from './collections'

// ---------------------------------------------------------------------------
// Registry mapping field type → built-in validator
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const builtinValidators: Record<string, ClientValidate<any>> = {
  text,
  email,
  password,
  textarea,
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
}
