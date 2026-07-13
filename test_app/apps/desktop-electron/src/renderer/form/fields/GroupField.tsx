// Group container — a titled box whose sub-fields render at this field's own
// base path. Named groups already had their name appended by FieldNode, so
// children keep props.path; unnamed groups pass it through transparently.
import type { FieldComponentProps } from '../types'
import { labelForField, resolveLabel } from '../labels'

export function GroupField(props: FieldComponentProps) {
  const { field, path, renderField, error } = props
  const title = labelForField(field)
  const description = resolveLabel(field.admin?.description)

  return (
    <div className="field-group">
      {title && <div className="field-group-title">{title}</div>}
      {description && <div className="field-description">{description}</div>}
      {field.fields?.map((child) => renderField(child, path))}
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}
