// Numeric editor. Single-value = number input; hasMany = numeric chip list.
import { useState } from 'react'
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly, placeholderOf } from './shared'

function stepOf(props: FieldComponentProps): number | 'any' {
  return props.field.admin?.step ?? 'any'
}

function toNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number') : []
}

export function NumberField(props: FieldComponentProps) {
  const { field } = props
  const readOnly = isReadOnly(props)

  if (field.hasMany) {
    return <ChipNumber props={props} readOnly={readOnly} />
  }

  const { value, setValue, onBlur } = useFieldValue<number | undefined>(props)
  return (
    <FieldShell props={props}>
      <input
        className="input"
        type="number"
        value={value ?? ''}
        placeholder={placeholderOf(props)}
        readOnly={readOnly}
        min={field.min}
        max={field.max}
        step={stepOf(props)}
        onBlur={onBlur}
        onChange={(e) => setValue(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </FieldShell>
  )
}

function ChipNumber({ props, readOnly }: { props: FieldComponentProps; readOnly: boolean }) {
  const { value, setValue } = useFieldValue<number[] | undefined>(props)
  const items = toNumberArray(value)
  const [draft, setDraft] = useState('')

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed === '') return
    const n = Number(trimmed)
    if (Number.isNaN(n)) {
      setDraft('')
      return
    }
    setValue([...items, n])
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
            type="number"
            value={draft}
            step={stepOf(props)}
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
