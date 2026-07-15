// Property-driven Kanban board (issue #25 slice one). Columns are derived from
// the chosen select/radio field's options — a leading 'No value' column for
// docs missing (or holding an unknown) value, then one column per option. The
// docs are the SAME filtered `visible` array the table renders; no fetching
// here. Dragging a card into a different column writes that field via the
// local-first mutation (undefined for the 'No value' column).
import { useMemo } from 'react'
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useLocalDB, useLocalMutations } from '@payload-universal/local-db'
import type { SchemaField } from '../../../form/types'
import { optionValue, resolveOptionLabel } from '../../../form/labels'
import { KanbanColumn, NO_VALUE } from './KanbanColumn'

type Props = {
  slug: string
  field: SchemaField
  docs: Record<string, unknown>[]
  useAsTitle?: string
  onOpen: (id: string) => void
  onPeek?: (id: string) => void
  onDocMenu?: (id: string, x: number, y: number) => void
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

type Column = { value: string | null; label: string }

export function KanbanBoard({ slug, field, docs, useAsTitle, onOpen, onPeek, onDocMenu, selectedIds, onToggleSelect }: Props) {
  const localDB = useLocalDB()
  const { update } = useLocalMutations(localDB, slug)
  const fieldName = field.name ?? ''

  // A leading 'No value' column, then one column per option (in option order).
  const columns = useMemo<Column[]>(() => {
    const opts = field.options ?? []
    return [
      { value: null, label: 'No value' },
      ...opts.map((opt) => ({ value: optionValue(opt), label: resolveOptionLabel(opt) })),
    ]
  }, [field.options])

  // Bucket the visible docs by their current field value; unknown/empty values
  // fall into the 'No value' column.
  const grouped = useMemo(() => {
    const known = new Set(columns.map((c) => c.value).filter((v): v is string => v != null))
    const byValue = new Map<string | null, Record<string, unknown>[]>()
    for (const c of columns) byValue.set(c.value, [])
    for (const doc of docs) {
      const raw = doc[fieldName]
      const key = typeof raw === 'string' && known.has(raw) ? raw : null
      byValue.get(key)!.push(doc)
    }
    return byValue
  }, [columns, docs, fieldName])

  const sensors = useSensors(
    // 6px activation so a plain click still opens the card (drag needs intent).
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over) return
    const id = String(active.id)
    const overId = String(over.id)
    if (!overId.startsWith('col:')) return
    const raw = overId.slice('col:'.length)
    const target = raw === NO_VALUE ? null : raw
    const doc = docs.find((d) => String(d.id ?? '') === id)
    if (!doc) return
    const current = typeof doc[fieldName] === 'string' ? (doc[fieldName] as string) : null
    if (current === target) return // dropped on its own column — no-op
    // 'No value' clears the field; otherwise set the option value.
    void update(id, { [fieldName]: target ?? undefined }).catch((err) => {
      console.error('Failed to move card:', err)
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
      <div className="board">
        {columns.map((col) => (
          <KanbanColumn
            key={col.value ?? NO_VALUE}
            value={col.value}
            label={col.label}
            docs={grouped.get(col.value) ?? []}
            useAsTitle={useAsTitle}
            onOpen={onOpen}
            onPeek={onPeek}
            onDocMenu={onDocMenu}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </DndContext>
  )
}
