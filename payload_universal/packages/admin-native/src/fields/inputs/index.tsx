/**
 * TextInput-based field components: text, email, number, textarea, code,
 * json, point.
 *
 * CANONICAL ROW CONTRACT (see FieldShell/FormSection): every text-entry field
 * here is a STACKED row — uppercase 11pt label via FieldShell, input below at
 * the shared 16pt grid (the FormSection row owns the inset; components add
 * ZERO horizontal inset, borders or separators of their own). Single-line
 * fields render native SwiftUI TextField/SecureField (iOS) or JC TextInput
 * (Android) through the registry when available, with the pure-JS RN
 * TextInput as the final fallback tier — both tiers at 16pt text so native
 * and JS rows are pixel-consistent. Multiline fields (textarea, code, json)
 * keep a subtle filled rounded-8 background WITHOUT borders. The bounded
 * stepper number is the one INLINE row (label left, control right). hasMany
 * text/number render a chip editor under a stacked label.
 *
 * Native text inputs are UNCONTROLLED (defaultValue + onChangeText) and are
 * bridged to react-hook-form via useUncontrolledTextBridge — external resets
 * are pushed in with ref.setText, keystrokes are never echoed back.
 *
 * Split across sibling files by responsibility (text/email, number, textarea,
 * code, json, point + shared utils/styles); this barrel re-exports every
 * field component so `from './inputs'` resolves unchanged.
 */
export { EmailField, TextField } from './text'
export { NumberField } from './number'
export { TextareaField } from './textarea'
export { CodeField } from './code'
export { JSONField } from './json'
export { PointField } from './point'
