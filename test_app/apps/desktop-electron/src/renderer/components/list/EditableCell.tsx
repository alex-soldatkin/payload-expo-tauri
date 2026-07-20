// Inline-editable table cell (the desktop's native Edit Mode). Simple field
// types edit in place — text/email/number/checkbox/select/date — committing
// through the local-first update path on blur/Enter; Escape reverts. Complex
// types (relationships, arrays, richText) keep their read-only rendering and
// edit via the document editor.
import { useEffect, useState } from 'react'
import type { DisplayField } from './columns'
import { renderCell } from './cells'
import { optionValue, resolveOptionLabel } from '../../form/labels'

const EDITABLE_TYPES = new Set(['text', 'email', 'textarea', 'number', 'checkbox', 'select', 'date'])

export function isInlineEditable(col: DisplayField): boolean {
  return EDITABLE_TYPES.has(col.type) && Boolean(col.field?.name)
}

type Props = {
  doc: Record<string, unknown>
  col: DisplayField
  update: (id: string, patch: Record<string, unknown>) => Promise<unknown>
}

export function EditableCell({ doc, col, update }: Props) {
  const id = String(doc.id ?? '')
  const remote = doc[col.key]
  const [value, setValue] = useState<unknown>(remote)
  // External changes (sync, other panes) re-seed the draft unless mid-edit.
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (!dirty) setValue(remote)
  }, [remote, dirty])

  const commit = () => {
    if (!dirty) return
    setDirty(false)
    if (value === remote) return
    void update(id, { [col.key]: value }).catch((err) => {
      console.error('Inline edit failed:', err)
      setValue(remote)
    })
  }
  const revert = () => {
    setDirty(false)
    setValue(remote)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && col.type !== 'textarea') {
      e.preventDefault()
      ;(e.target as HTMLElement).blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      revert()
      ;(e.target as HTMLElement).blur()
    }
  }
  const set = (v: unknown) => {
    setDirty(true)
    setValue(v)
  }

  if (!isInlineEditable(col)) return <>{renderCell(col, doc)}</>

  switch (col.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          className="inline-edit-checkbox"
          checked={Boolean(value)}
          onChange={(e) => {
            // Checkboxes commit immediately — there's no blur moment.
            setDirty(false)
            setValue(e.target.checked)
            void update(id, { [col.key]: e.target.checked }).catch(() => setValue(remote))
          }}
        />
      )
    case 'select': {
      const opts = col.field?.options ?? []
      return (
        <select
          className="inline-edit-input"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => {
            // Selects also commit on change.
            setDirty(false)
            const v = e.target.value === '' ? undefined : e.target.value
            setValue(v)
            void update(id, { [col.key]: v }).catch(() => setValue(remote))
          }}
        >
          <option value="">—</option>
          {opts.map((o) => (
            <option key={optionValue(o)} value={optionValue(o)}>
              {resolveOptionLabel(o)}
            </option>
          ))}
        </select>
      )
    }
    case 'number':
      return (
        <input
          type="number"
          className="inline-edit-input"
          value={typeof value === 'number' ? value : value == null ? '' : String(value)}
          onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
      )
    case 'date': {
      const iso = typeof value === 'string' ? value : undefined
      const day = iso ? iso.slice(0, 10) : ''
      return (
        <input
          type="date"
          className="inline-edit-input"
          value={day}
          onChange={(e) => {
            const d = e.target.value
            if (!d) return set(undefined)
            // Preserve the original time-of-day when only the day changes.
            const time = iso && iso.length > 10 ? iso.slice(10) : 'T12:00:00.000Z'
            set(`${d}${time}`)
          }}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
      )
    }
    default:
      return (
        <input
          type="text"
          className="inline-edit-input"
          value={typeof value === 'string' ? value : value == null ? '' : String(value)}
          onChange={(e) => set(e.target.value === '' ? undefined : e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
      )
  }
}
