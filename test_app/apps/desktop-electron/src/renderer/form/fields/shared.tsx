// Shared chrome + value plumbing for leaf field editors.
import { useController } from 'react-hook-form'
import type { FieldComponentProps } from '../types'
import { labelForField, resolveLabel } from '../labels'

/** Label + required mark + description + error wrapper for a leaf editor. */
export function FieldShell({
  props,
  children,
  inline = false,
}: {
  props: FieldComponentProps
  children: React.ReactNode
  /** Checkbox-style: control before label on one line. */
  inline?: boolean
}) {
  const { field, error } = props
  const label = labelForField(field)
  const description = resolveLabel(field.admin?.description)
  // In a .field-row the row sets `flex: 1` (basis 0) on children — a plain
  // `width` loses to that basis and the field collapses. flexBasis wins.
  const style = field.admin?.width
    ? { flexBasis: field.admin.width, flexGrow: 0, flexShrink: 1, minWidth: 0 }
    : undefined

  return (
    <div className={`field${inline ? ' field-inline' : ''}`} style={style}>
      {!inline && label && (
        <label className="field-label">
          {label}
          {field.required && <span className="field-required">*</span>}
          {field.localized && <span className="field-flag" title="Localized">🌐</span>}
        </label>
      )}
      {children}
      {inline && label && (
        <span className="field-label inline">
          {label}
          {field.required && <span className="field-required">*</span>}
        </span>
      )}
      {description && <div className="field-description">{description}</div>}
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

/** RHF value binding for a leaf editor; also fires onEdit for error clearing. */
export function useFieldValue<T = unknown>(props: FieldComponentProps) {
  const { field: rhf } = useController({ name: props.path, control: props.control })
  const value = rhf.value as T
  const setValue = (next: T) => {
    rhf.onChange(next)
    props.onEdit?.(props.path)
  }
  return { value, setValue, onBlur: rhf.onBlur }
}

export function placeholderOf(props: FieldComponentProps): string | undefined {
  return resolveLabel(props.field.admin?.placeholder) || undefined
}

export function isReadOnly(props: FieldComponentProps): boolean {
  return Boolean(props.field.admin?.readOnly || props.field.admin?.disabled)
}
