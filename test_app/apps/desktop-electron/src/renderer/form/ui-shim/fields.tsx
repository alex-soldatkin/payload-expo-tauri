// @payloadcms/ui field-chrome shims — label/description/error/text-input,
// matching the prop shapes Payload passes (label may be a locale map; the
// error message may come via prop or be looked up from the engine by path).
import type { ChangeEvent, ReactNode } from 'react'
import { resolveLabel } from '../labels'
import { useFormEngine } from '../FieldRenderer'

type LabelValue = string | Record<string, string> | false | undefined

export function FieldLabel({
  label,
  required,
  htmlFor,
}: {
  label?: LabelValue
  required?: boolean
  htmlFor?: string
}) {
  if (label === false || label == null) return null
  return (
    <label className="pui-label" htmlFor={htmlFor}>
      {resolveLabel(label)}
      {required && <span className="pui-required">*</span>}
    </label>
  )
}

export function FieldDescription({
  description,
}: {
  description?: LabelValue
  path?: string
}) {
  if (!description) return null
  return <div className="pui-description">{resolveLabel(description)}</div>
}

export function FieldError({
  message,
  path,
  showError = true,
}: {
  message?: string
  path?: string
  showError?: boolean
}) {
  const engine = useFormEngine()
  const text = message ?? (path ? engine.errors[path] : undefined)
  if (!showError || !text) return null
  return <div className="pui-error">{text}</div>
}

export function TextInput({
  value,
  onChange,
  path,
  label,
  placeholder,
  readOnly,
  required,
  Error: ErrorSlot,
}: {
  value?: string
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  path?: string
  label?: LabelValue
  placeholder?: string
  readOnly?: boolean
  required?: boolean
  Error?: ReactNode
}) {
  return (
    <div className="pui-text-input">
      <FieldLabel label={label} required={required} htmlFor={path} />
      <input
        id={path}
        className="input"
        type="text"
        value={value ?? ''}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={onChange}
      />
      {ErrorSlot}
    </div>
  )
}
