// JSON editor. Parse-on-change; invalid JSON is shown but never written.
import { useEffect, useState } from 'react'
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly } from './shared'

export function JsonField(props: FieldComponentProps) {
  const { value, setValue } = useFieldValue<unknown>(props)
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    setText(JSON.stringify(value ?? null, null, 2))
    setParseError(null)
  }, [props.path]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FieldShell props={props}>
      <textarea
        className="input mono"
        rows={6}
        value={text}
        readOnly={isReadOnly(props)}
        onChange={(e) => {
          setText(e.target.value)
          const raw = e.target.value.trim()
          try {
            setValue(raw === '' ? null : JSON.parse(e.target.value))
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
