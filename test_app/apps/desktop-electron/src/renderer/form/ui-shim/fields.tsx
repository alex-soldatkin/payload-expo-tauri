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
  description,
  className,
  Error: ErrorSlot,
}: {
  value?: string
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  path?: string
  label?: LabelValue
  placeholder?: string
  readOnly?: boolean
  required?: boolean
  description?: LabelValue
  className?: string
  Error?: ReactNode
}) {
  return (
    <div className={`pui-text-input${className ? ` ${className}` : ''}`}>
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
      {description ? <FieldDescription description={description} /> : null}
      {ErrorSlot}
    </div>
  )
}

// ---- additional Payload inputs used by passthrough components ---------------

export function CheckboxInput({
  checked,
  onToggle,
  label,
  id,
}: {
  checked?: boolean
  onToggle?: (e: ChangeEvent<HTMLInputElement>) => void
  label?: LabelValue
  id?: string
}) {
  return (
    <label className="pui-checkbox" htmlFor={id}>
      <input id={id} type="checkbox" checked={Boolean(checked)} onChange={onToggle} />
      {label ? <span>{resolveLabel(label)}</span> : null}
    </label>
  )
}

export function SelectInput({
  options = [],
  value,
  onChange,
  path,
  label,
  required,
}: {
  options?: Array<{ label: string; value: string }>
  value?: string | { value: string }
  onChange?: (opt: { label: string; value: string } | null) => void
  path?: string
  label?: LabelValue
  required?: boolean
}) {
  const current = typeof value === 'object' && value !== null ? value.value : value
  return (
    <div className="pui-text-input">
      <FieldLabel label={label} required={required} htmlFor={path} />
      <select
        id={path}
        className="input"
        value={current ?? ''}
        onChange={(e) => {
          const opt = options.find((o) => o.value === e.target.value) ?? null
          onChange?.(opt)
        }}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {resolveLabel(o.label)}
          </option>
        ))}
      </select>
    </div>
  )
}

/** react-select stand-in: native select (single) / multi-select. */
export function ReactSelect({
  options = [],
  value,
  onChange,
  isMulti,
  isClearable,
  placeholder,
}: {
  options?: Array<{ label: string; value: string }>
  value?: { label: string; value: string } | Array<{ label: string; value: string }> | null
  onChange?: (v: unknown) => void
  isMulti?: boolean
  isClearable?: boolean
  placeholder?: string
}) {
  void isClearable
  if (isMulti) {
    const selected = Array.isArray(value) ? value.map((v) => v.value) : []
    return (
      <select
        className="input"
        multiple
        value={selected}
        onChange={(e) => {
          const picked = Array.from(e.target.selectedOptions).map(
            (o) => options.find((opt) => opt.value === o.value)!,
          )
          onChange?.(picked)
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  const current = value && !Array.isArray(value) ? value.value : ''
  return (
    <select
      className="input"
      value={current}
      onChange={(e) => onChange?.(options.find((o) => o.value === e.target.value) ?? null)}
    >
      <option value="">{placeholder ?? '—'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function TextareaInput({
  value,
  onChange,
  path,
  label,
  placeholder,
  required,
  rows,
}: {
  value?: string
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void
  path?: string
  label?: LabelValue
  placeholder?: string
  required?: boolean
  rows?: number
}) {
  return (
    <div className="pui-text-input">
      <FieldLabel label={label} required={required} htmlFor={path} />
      <textarea
        id={path}
        className="input"
        rows={rows ?? 4}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={onChange}
      />
    </div>
  )
}
