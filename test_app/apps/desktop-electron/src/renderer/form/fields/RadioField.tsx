// Single-choice radio group. Options may be strings or {label,value}.
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly } from './shared'
import { resolveOptionLabel, optionValue } from '../labels'

export function RadioField(props: FieldComponentProps) {
  const { field } = props
  const { value, setValue } = useFieldValue<string | undefined>(props)
  const readOnly = isReadOnly(props)
  const vertical = field.admin?.layout !== 'horizontal'

  return (
    <FieldShell props={props}>
      <div className={`radio-group${vertical ? ' vertical' : ''}`}>
        {(field.options ?? []).map((opt) => {
          const v = optionValue(opt)
          return (
            <label key={v}>
              <input
                type="radio"
                name={props.path}
                value={v}
                checked={value === v}
                disabled={readOnly}
                onChange={() => setValue(v)}
              />
              {resolveOptionLabel(opt)}
            </label>
          )
        })}
      </div>
    </FieldShell>
  )
}
