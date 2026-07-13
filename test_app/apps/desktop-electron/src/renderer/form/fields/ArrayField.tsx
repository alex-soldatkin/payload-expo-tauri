// Array field — repeatable rows of the same sub-field set. Each row is a card
// with move/duplicate/remove controls; Add appends an empty row. Data lives at
// `${path}.${index}.${name}` (FieldNode-style child paths handled here).
//
// Positional identity + generation counter: rows are keyed `${index}:${gen}`
// and `generation` is bumped on every structural mutation so shifted rows fully
// remount. Without this, uncontrolled inputs would show stale values for the
// row that moved into a given index (mirrors admin-native's array field).
import { useState } from 'react'
import type { FieldComponentProps, SchemaField } from '../types'
import { labelForField, resolveLabel } from '../labels'
import { getFieldSlots, type RowLabelProps } from '../registry'
import { normalizeIndexes } from '../paths'
import { useFieldValue } from './shared'

type Row = Record<string, unknown>

export function ArrayField(props: FieldComponentProps) {
  const { field, path, slug, error, renderField } = props
  const { value, setValue } = useFieldValue<Row[] | undefined>(props)
  const rows = Array.isArray(value) ? value : []
  const subFields = field.fields ?? []

  const [generation, setGeneration] = useState(0)
  const bump = () => setGeneration((g) => g + 1)

  const title = labelForField(field)
  const description = resolveLabel(field.admin?.description)
  const singular = resolveLabel(field.labels?.singular, 'item')

  const atMax = field.maxRows != null && rows.length >= field.maxRows
  const atMin = field.minRows != null && rows.length <= field.minRows
  const canRemove = !atMin

  const commit = (next: Row[]) => {
    setValue(next)
    bump()
  }

  const addRow = () => {
    if (atMax) return
    commit([...rows, {}])
  }
  const removeRow = (index: number) => {
    if (!canRemove) return
    commit(rows.filter((_, i) => i !== index))
  }
  const moveRow = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return
    const next = [...rows]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    commit(next)
  }
  const duplicateRow = (index: number) => {
    if (atMax) return
    const next = [...rows]
    next.splice(index + 1, 0, { ...rows[index] })
    commit(next)
  }

  const RowLabel = getFieldSlots(slug, normalizeIndexes(path))?.RowLabel
  const rowTitle = (row: Row, i: number): string => {
    const firstText = subFields.find(
      (f: SchemaField) => f.type === 'text' && f.name && String(row[f.name] ?? '').trim() !== '',
    )
    if (firstText?.name) return String(row[firstText.name])
    return `${singular} ${i + 1}`
  }

  return (
    <div className="field-group">
      {title && <div className="field-group-title">{title}</div>}
      {description && <div className="field-description">{description}</div>}
      {error && <div className="field-error">{error}</div>}

      <div className="field-rows">
        {rows.map((row, index) => (
          <div key={`${index}:${generation}`} className="field-row-card">
            <div className="field-row-head">
              <span className="title">
                {RowLabel ? (
                  <RowLabel {...({ data: row, index } satisfies RowLabelProps)} />
                ) : (
                  rowTitle(row, index)
                )}
              </span>
              <button type="button" disabled={index === 0} onClick={() => moveRow(index, index - 1)}>
                ↑
              </button>
              <button
                type="button"
                disabled={index === rows.length - 1}
                onClick={() => moveRow(index, index + 1)}
              >
                ↓
              </button>
              <button type="button" disabled={atMax} onClick={() => duplicateRow(index)}>
                Duplicate
              </button>
              <button type="button" disabled={!canRemove} onClick={() => removeRow(index)}>
                Remove
              </button>
            </div>
            {subFields.map((sub) => renderField(sub, `${path}.${index}`))}
          </div>
        ))}
      </div>

      <button type="button" className="field-add-row" disabled={atMax} onClick={addRow}>
        Add {singular}
      </button>
    </div>
  )
}
