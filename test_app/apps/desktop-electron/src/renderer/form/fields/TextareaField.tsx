// Multi-line text editor.
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly, placeholderOf } from './shared'

export function TextareaField(props: FieldComponentProps) {
  const { value, setValue, onBlur } = useFieldValue<string | undefined>(props)
  return (
    <FieldShell props={props}>
      <textarea
        className="input"
        rows={4}
        value={value ?? ''}
        placeholder={placeholderOf(props)}
        readOnly={isReadOnly(props)}
        maxLength={props.field.maxLength}
        minLength={props.field.minLength}
        onBlur={onBlur}
        onChange={(e) => setValue(e.target.value === '' ? undefined : e.target.value)}
      />
    </FieldShell>
  )
}
