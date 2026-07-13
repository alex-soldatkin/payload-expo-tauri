// Safety net: any field type without a dedicated editor stays editable as JSON.
import { useEffect, useState } from 'react'
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly } from './shared'

export function FallbackField(props: FieldComponentProps) {
  const { value, setValue } = useFieldValue(props)
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    setText(JSON.stringify(value ?? null, null, 2))
  }, [props.path]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FieldShell props={props}>
      <textarea
        className="input mono"
        rows={4}
        value={text}
        readOnly={isReadOnly(props)}
        onChange={(e) => {
          setText(e.target.value)
          try {
            setValue(e.target.value.trim() === '' ? null : JSON.parse(e.target.value))
            setParseError(null)
          } catch {
            setParseError('Invalid JSON — not applied')
          }
        }}
      />
      {parseError && <div className="field-error">{parseError}</div>}
    </FieldShell>
  )
}
