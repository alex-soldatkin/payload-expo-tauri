// Text (and email) editor. Single-value = plain input; hasMany = chip list.
import { useState } from 'react'
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly, placeholderOf } from './shared'

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function TextField(props: FieldComponentProps) {
  const { field } = props
  const inputType = field.type === 'email' ? 'email' : 'text'
  const readOnly = isReadOnly(props)

  if (field.hasMany) {
    return <ChipText props={props} readOnly={readOnly} inputType={inputType} />
  }

  const { value, setValue, onBlur } = useFieldValue<string | undefined>(props)
  return (
    <FieldShell props={props}>
      <input
        className="input"
        type={inputType}
        value={value ?? ''}
        placeholder={placeholderOf(props)}
        readOnly={readOnly}
        maxLength={field.maxLength}
        minLength={field.minLength}
        onBlur={onBlur}
        onChange={(e) => setValue(e.target.value === '' ? undefined : e.target.value)}
      />
    </FieldShell>
  )
}

function ChipText({
  props,
  readOnly,
  inputType,
}: {
  props: FieldComponentProps
  readOnly: boolean
  inputType: 'text' | 'email'
}) {
  const { value, setValue } = useFieldValue<string[] | undefined>(props)
  const items = toStringArray(value)
  const [draft, setDraft] = useState('')

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed === '') return
    setValue([...items, trimmed])
    setDraft('')
  }
  const removeAt = (i: number) => setValue(items.filter((_, idx) => idx !== i))

  return (
    <FieldShell props={props}>
      <div className="chips">
        {items.map((item, i) => (
          <span className="chip" key={`${item}-${i}`}>
            {item}
            {!readOnly && (
              <button type="button" onClick={() => removeAt(i)} aria-label="Remove">
                ×
              </button>
            )}
          </span>
        ))}
        {!readOnly && (
          <input
            className="input"
            type={inputType}
            value={draft}
            placeholder={placeholderOf(props) ?? 'Add…'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                commit()
              } else if (e.key === 'Backspace' && draft === '' && items.length > 0) {
                e.preventDefault()
                removeAt(items.length - 1)
              }
            }}
          />
        )}
      </div>
    </FieldShell>
  )
}
