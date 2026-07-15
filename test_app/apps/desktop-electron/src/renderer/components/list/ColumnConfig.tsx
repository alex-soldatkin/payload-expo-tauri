// Gear popover for toggling + reordering list columns. Reuses the .picker-menu
// vocabulary from form.css. Active columns drag-reorder (dnd-kit, handle-scoped
// like the array rows) with the up/down buttons kept for accessibility.
import { useEffect, useRef } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DisplayField } from './columns'

type Props = {
  displayable: DisplayField[]
  columns: string[]
  titleKey: string
  onToggle: (key: string) => void
  onMove: (key: string, dir: -1 | 1) => void
  /** Drag reorder (from/to indexes within the active columns). */
  onReorder?: (from: number, to: number) => void
  onReset: () => void
  onClose: () => void
}

export function ColumnConfig({
  displayable,
  columns,
  titleKey,
  onToggle,
  onMove,
  onReorder,
  onReset,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id || !onReorder) return
    const from = columns.indexOf(String(active.id))
    const to = columns.indexOf(String(over.id))
    if (from !== -1 && to !== -1) onReorder(from, to)
  }

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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={active.map((d) => d.key)} strategy={verticalListSortingStrategy}>
          {active.map((d, i) => (
            <SortableColumnRow key={d.key} id={d.key}>
              <input
                type="checkbox"
                checked
                disabled={d.key === titleKey}
                onChange={() => onToggle(d.key)}
              />
              <span className="column-config-label">{d.label}</span>
              <span className="type-badge">{d.type}</span>
              <span className="column-config-move">
                <button className="mini" disabled={i === 0} onClick={() => onMove(d.key, -1)} title="Move up">
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
            </SortableColumnRow>
          ))}
        </SortableContext>
      </DndContext>
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

function SortableColumnRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="option column-config-row"
    >
      <span className="row-drag-handle" {...attributes} {...listeners}>
        ⋮⋮
      </span>
      {children}
    </div>
  )
}
