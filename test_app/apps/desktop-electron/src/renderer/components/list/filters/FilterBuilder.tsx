// Filter builder popover — the desktop translation of the mobile
// FilterBottomSheet OR-group overview. Groups render as bordered sections whose
// rows AND together; groups OR together. Reuses the .picker-menu vocabulary.
import { useEffect, useRef } from 'react'
import type { FilterField } from './filterFields'
import { findFilterField } from './filterFields'
import { FilterValueInput } from './FilterValueInput'
import { OPERATOR_LABELS, operatorsForType } from './types'
import type { FilterGroups, FilterOp, FilterRule } from './types'

type Props = {
  fields: FilterField[]
  groups: FilterGroups
  onChange: (groups: FilterGroups) => void
  onClose: () => void
}

/** Default rule for a freshly-added condition (first field, its first op). */
function newRule(fields: FilterField[]): FilterRule {
  const field = fields[0]
  const op = field ? operatorsForType(field.type)[0] : 'equals'
  return { field: field?.key ?? '', op, value: '' }
}

export function FilterBuilder({ fields, groups, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const setRule = (gi: number, ri: number, patch: Partial<FilterRule>) => {
    const next = groups.map((g) => g.slice())
    next[gi][ri] = { ...next[gi][ri], ...patch }
    onChange(next)
  }

  const onField = (gi: number, ri: number, key: string) => {
    const field = findFilterField(fields, key)
    const ops = field ? operatorsForType(field.type) : (['equals'] as FilterOp[])
    const cur = groups[gi][ri].op
    setRule(gi, ri, { field: key, op: ops.includes(cur) ? cur : ops[0], value: '' })
  }

  const addCondition = (gi: number) => {
    const next = groups.map((g) => g.slice())
    next[gi] = [...next[gi], newRule(fields)]
    onChange(next)
  }

  const removeRule = (gi: number, ri: number) => {
    const next = groups.map((g) => g.slice())
    next[gi].splice(ri, 1)
    onChange(next.filter((g) => g.length > 0))
  }

  const addGroup = () => onChange([...groups, [newRule(fields)]])

  const clearAll = () => onChange([])

  const activeGroups = groups.length > 0 ? groups : []

  return (
    <div className="picker-menu filter-builder" ref={ref}>
      <div className="column-config-head">
        <span>Filters</span>
        {activeGroups.length > 0 && (
          <button className="link" onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>

      {activeGroups.length === 0 && <div className="filter-empty">No filters applied.</div>}

      {activeGroups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && <div className="filter-or-divider">OR</div>}
          <div className="filter-group">
            {group.map((rule, ri) => {
              const field = findFilterField(fields, rule.field)
              const ops = field ? operatorsForType(field.type) : (['equals'] as FilterOp[])
              return (
                <div key={ri} className="filter-rule">
                  {ri > 0 && <span className="filter-and">AND</span>}
                  <select
                    className="filter-field"
                    value={rule.field}
                    onChange={(e) => onField(gi, ri, e.target.value)}
                  >
                    {fields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="filter-op"
                    value={rule.op}
                    onChange={(e) => setRule(gi, ri, { op: e.target.value as FilterOp, value: '' })}
                  >
                    {ops.map((op) => (
                      <option key={op} value={op}>
                        {OPERATOR_LABELS[op]}
                      </option>
                    ))}
                  </select>
                  {field && (
                    <FilterValueInput
                      field={field}
                      op={rule.op}
                      value={rule.value}
                      onChange={(v) => setRule(gi, ri, { value: v })}
                    />
                  )}
                  <button
                    className="mini filter-remove"
                    onClick={() => removeRule(gi, ri)}
                    title="Remove condition"
                    aria-label="Remove condition"
                  >
                    ×
                  </button>
                </div>
              )
            })}
            <button className="link filter-add" onClick={() => addCondition(gi)}>
              + condition
            </button>
          </div>
        </div>
      ))}

      <div className="filter-builder-foot">
        <button className="link" onClick={addGroup} disabled={fields.length === 0}>
          + OR group
        </button>
      </div>
    </div>
  )
}
