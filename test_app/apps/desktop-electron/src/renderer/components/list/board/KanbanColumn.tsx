// One board column = one option value (or the leading 'No value' column, whose
// value is null). It's a dnd-kit droppable zone (id = `col:${value ?? ''}`)
// and tints (.over) while a card is dragged over it. Header shows label +
// live count; body scrolls vertically when its cards overflow.
import { useDroppable } from '@dnd-kit/core'
import { KanbanCard } from './KanbanCard'

export const NO_VALUE = '__none__'

type Props = {
  /** Option value backing this column, or null for the 'No value' column. */
  value: string | null
  label: string
  docs: Record<string, unknown>[]
  useAsTitle?: string
  onOpen: (id: string) => void
}

export function KanbanColumn({ value, label, docs, useAsTitle, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${value ?? NO_VALUE}` })

  return (
    <div className={`board-col${isOver ? ' over' : ''}`}>
      <div className="board-col-head">
        <span className="board-col-label">{label}</span>
        <span className="board-col-count">{docs.length}</span>
      </div>
      <div className="board-col-body" ref={setNodeRef}>
        {docs.map((doc) => (
          <KanbanCard
            key={String(doc.id ?? '')}
            doc={doc}
            useAsTitle={useAsTitle}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  )
}
