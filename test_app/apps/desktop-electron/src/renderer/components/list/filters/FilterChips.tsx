// Active-filter chip bar rendered under the toolbar. One chip per rule labeled
// '{field} {op} {value}', grouped visually by OR-group with an 'OR' separator.
// Chip × removes that single rule; 'Clear all' wipes everything.
import { displayValue, findFilterField } from './filterFields'
import { OPERATOR_LABELS } from './types'
import type { FilterField } from './filterFields'
import type { FilterGroups } from './types'

type Props = {
  fields: FilterField[]
  groups: FilterGroups
  onRemove: (groupIndex: number, ruleIndex: number) => void
  onClear: () => void
}

export function FilterChips({ fields, groups, onRemove, onClear }: Props) {
  const active = groups.filter((g) => g.length > 0)
  if (active.length === 0) return null

  return (
    <div className="filter-chips">
      {active.map((group, gi) => (
        <span key={gi} className="filter-chip-group">
          {gi > 0 && <span className="filter-chip-or">OR</span>}
          {group.map((rule, ri) => {
            const field = findFilterField(fields, rule.field)
            const label = field?.label ?? rule.field
            const valueLabel =
              rule.op === 'exists'
                ? ''
                : displayValue(field?.type ?? 'text', rule.op, rule.value)
            return (
              <span key={ri} className="chip">
                {ri > 0 && <span className="filter-chip-and">and</span>}
                <span className="filter-chip-text">
                  {label} {OPERATOR_LABELS[rule.op]}
                  {valueLabel ? ` ${valueLabel}` : ''}
                </span>
                <button
                  onClick={() => onRemove(gi, ri)}
                  title="Remove filter"
                  aria-label="Remove filter"
                >
                  ×
                </button>
              </span>
            )
          })}
        </span>
      ))}
      <button className="link filter-chips-clear" onClick={onClear}>
        Clear all
      </button>
    </div>
  )
}
