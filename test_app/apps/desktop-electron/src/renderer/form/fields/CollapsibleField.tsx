// Collapsible container — a clickable title toggles its sub-fields open/closed.
// Initial open state honours admin.initCollapsed. Transparent for paths:
// children keep props.path.
import { useState } from 'react'
import type { FieldComponentProps } from '../types'
import { resolveLabel } from '../labels'

export function CollapsibleField(props: FieldComponentProps) {
  const { field, path, renderField } = props
  const [open, setOpen] = useState(!field.admin?.initCollapsed)
  const title = resolveLabel(field.label, 'Collapsible')

  return (
    <div className="field-collapsible">
      <div
        className="field-collapsible-title"
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
      >
        <span>{open ? '▾' : '▸'}</span>
        {title}
      </div>
      {open && field.fields?.map((child) => renderField(child, path))}
    </div>
  )
}
