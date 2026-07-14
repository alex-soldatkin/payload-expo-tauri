// Gear popover for toggling + reordering list columns. Reuses the .picker-menu
// vocabulary from form.css. Drag reordering lands in #22 — here reordering is
// done with ↑/↓ buttons on the active columns.
import { useEffect, useRef } from 'react'
import type { DisplayField } from './columns'

type Props = {
  displayable: DisplayField[]
  columns: string[]
  titleKey: string
  onToggle: (key: string) => void
  onMove: (key: string, dir: -1 | 1) => void
  onReset: () => void
  onClose: () => void
}

export function ColumnConfig({
  displayable,
  columns,
  titleKey,
  onToggle,
  onMove,
  onReset,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape.
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

  // Active columns in order, then the remaining displayable fields.
  const active = columns
    .map((key) => displayable.find((d) => d.key === key))
    .filter((d): d is DisplayField => Boolean(d))
  const activeKeys = new Set(columns)
  const inactive = displayable.filter((d) => !activeKeys.has(d.key))

  return (
    <div className="picker-menu column-config" ref={ref}>
      <div className="column-config-head">
        <span>Columns</span>
        <button className="link" onClick={onReset}>Reset</button>
      </div>
      {active.map((d, i) => (
        <div key={d.key} className="option column-config-row">
          <input
            type="checkbox"
            checked
            disabled={d.key === titleKey}
            onChange={() => onToggle(d.key)}
          />
          <span className="column-config-label">{d.label}</span>
          <span className="type-badge">{d.type}</span>
          <span className="column-config-move">
            <button
              className="mini"
              disabled={i === 0}
              onClick={() => onMove(d.key, -1)}
              title="Move up"
            >
              ↑
            </button>
            <button
              className="mini"
              disabled={i === active.length - 1}
              onClick={() => onMove(d.key, 1)}
              title="Move down"
            >
              ↓
            </button>
          </span>
        </div>
      ))}
      {inactive.length > 0 && <div className="column-config-sep" />}
      {inactive.map((d) => (
        <div key={d.key} className="option column-config-row">
          <input type="checkbox" checked={false} onChange={() => onToggle(d.key)} />
          <span className="column-config-label">{d.label}</span>
          <span className="type-badge">{d.type}</span>
        </div>
      ))}
    </div>
  )
}
