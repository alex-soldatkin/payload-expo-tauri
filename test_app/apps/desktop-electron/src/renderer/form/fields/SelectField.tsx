// Select editor. Single = native <select>; hasMany = toggle chips.
import type { FieldComponentProps, SchemaField } from '../types'
import { FieldShell, useFieldValue, isReadOnly } from './shared'
import { resolveOptionLabel, optionValue } from '../labels'

function optionsOf(field: SchemaField) {
  return field.options ?? []
}

export function SelectField(props: FieldComponentProps) {
  const { field } = props
  const readOnly = isReadOnly(props)

  if (field.hasMany) {
    return <ToggleChips props={props} readOnly={readOnly} />
  }

  const { value, setValue, onBlur } = useFieldValue<string | undefined>(props)
  const showNone = !field.required || field.admin?.isClearable
  return (
    <FieldShell props={props}>
      <select
        className="input"
        value={value ?? ''}
        disabled={readOnly}
        onBlur={onBlur}
        onChange={(e) => setValue(e.target.value === '' ? undefined : e.target.value)}
      >
        {showNone && <option value="">— none —</option>}
        {optionsOf(field).map((opt) => (
          <option key={optionValue(opt)} value={optionValue(opt)}>
            {resolveOptionLabel(opt)}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

function ToggleChips({ props, readOnly }: { props: FieldComponentProps; readOnly: boolean }) {
  const { field } = props
  const { value, setValue } = useFieldValue<string[] | undefined>(props)
  const selected = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

  const toggle = (v: string) => {
    if (readOnly) return
    setValue(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v])
  }

  return (
    <FieldShell props={props}>
      <div className="chips">
        {optionsOf(field).map((opt) => {
          const v = optionValue(opt)
          const on = selected.includes(v)
          return (
            <button
              type="button"
              key={v}
              className={`chip toggle${on ? ' on' : ''}`}
              disabled={readOnly}
              onClick={() => toggle(v)}
            >
              {resolveOptionLabel(opt)}
            </button>
          )
        })}
      </div>
    </FieldShell>
  )
}
