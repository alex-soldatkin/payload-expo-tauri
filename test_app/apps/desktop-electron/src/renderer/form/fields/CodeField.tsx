// Code editor — plain mono textarea with the language shown as a small tag.
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly, placeholderOf } from './shared'

export function CodeField(props: FieldComponentProps) {
  const { value, setValue, onBlur } = useFieldValue<string | undefined>(props)
  const language = props.field.admin?.language

  return (
    <FieldShell props={props}>
      {language && <div className="field-description">language: {language}</div>}
      <textarea
        className="input mono"
        rows={8}
        spellCheck={false}
        value={value ?? ''}
        placeholder={placeholderOf(props)}
        readOnly={isReadOnly(props)}
        onBlur={onBlur}
        onChange={(e) => setValue(e.target.value === '' ? undefined : e.target.value)}
      />
    </FieldShell>
  )
}
