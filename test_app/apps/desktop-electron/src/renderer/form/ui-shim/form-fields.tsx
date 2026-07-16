// Form-connected field components (Payload exports these as full fields that
// read/write the form by path). Thin compositions over the shim's useField.
import { useField } from './hooks'
import { FieldLabel } from './fields'

export function TextField({ path, label, required }: { path: string; label?: string; required?: boolean }) {
  const { value, setValue } = useField<string>({ path })
  return (
    <div className="pui-text-input">
      <FieldLabel label={label} required={required} htmlFor={path} />
      <input id={path} className="input" type="text" value={value ?? ''} onChange={(e) => setValue(e.target.value)} />
    </div>
  )
}

export function NumberField({ path, label, required }: { path: string; label?: string; required?: boolean }) {
  const { value, setValue } = useField<number | null>({ path })
  return (
    <div className="pui-text-input">
      <FieldLabel label={label} required={required} htmlFor={path} />
      <input
        id={path}
        className="input"
        type="number"
        value={value ?? ''}
        onChange={(e) => setValue(e.target.value === '' ? null : Number(e.target.value))}
      />
    </div>
  )
}

/** Relationship pickers need the full desktop picker UI — passthroughs that
 *  reach for these get a read-only placeholder rather than a broken control. */
export function RelationshipField({ path, label }: { path: string; label?: string }) {
  const { value } = useField<unknown>({ path })
  return (
    <div className="pui-text-input">
      <FieldLabel label={label} htmlFor={path} />
      <input className="input" readOnly value={typeof value === 'string' ? value : JSON.stringify(value ?? '')} />
    </div>
  )
}
export const RelationshipInput = RelationshipField
