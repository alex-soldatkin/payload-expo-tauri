// Row container — lays its children out side by side. Transparent for paths:
// children keep props.path. Each child's width comes from its own admin.width
// via FieldShell; the row just provides the flex layout.
import type { FieldComponentProps } from '../types'

export function RowField(props: FieldComponentProps) {
  const { field, path, renderField } = props
  return (
    <div className="field-row">
      {field.fields?.map((child) => renderField(child, path))}
    </div>
  )
}
