// Value input for a single filter rule, adapted to the field type + operator:
//   exists            → true/false select
//   in                → comma-separated text (any type)
//   select/radio      → options dropdown
//   checkbox          → true/false select
//   number            → number input
//   date              → date input
//   otherwise         → text input
import { resolveOptionLabel, optionValue } from '../../../form/labels'
import type { FilterField } from './filterFields'
import type { FilterOp } from './types'

type Props = {
  field: FilterField
  op: FilterOp
  value: unknown
  onChange: (v: unknown) => void
}

export function FilterValueInput({ field, op, value, onChange }: Props) {
  if (op === 'exists') {
    return (
      <select
        className="filter-value"
        value={value === true || value === 'true' ? 'true' : 'false'}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="true">exists</option>
        <option value="false">does not exist</option>
      </select>
    )
  }

  if (op === 'in') {
    return (
      <input
        className="filter-value"
        type="text"
        placeholder="a, b, c"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  if ((field.type === 'select' || field.type === 'radio') && field.field?.options?.length) {
    return (
      <select
        className="filter-value"
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {field.field.options.map((opt) => {
          const v = optionValue(opt)
          return (
            <option key={v} value={v}>
              {resolveOptionLabel(opt)}
            </option>
          )
        })}
      </select>
    )
  }

  if (field.type === 'checkbox' || field.key === '_status') {
    const opts = field.key === '_status' ? ['draft', 'published'] : ['true', 'false']
    return (
      <select
        className="filter-value"
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'number') {
    return (
      <input
        className="filter-value"
        type="number"
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    )
  }

  if (field.type === 'date') {
    return (
      <input
        className="filter-value"
        type="date"
        value={typeof value === 'string' ? value.slice(0, 10) : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  return (
    <input
      className="filter-value"
      type="text"
      value={typeof value === 'string' ? value : value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
