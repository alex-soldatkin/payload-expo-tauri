// One board column = one option value (or the leading 'No value' column, whose
// value is null). It's a dnd-kit droppable zone (id = `col:${value ?? ''}`)
// and tints (.over) while a card is dragged over it. Header shows label +
// live count; body scrolls vertically when its cards overflow.
import { useDroppable } from '@dnd-kit/core'
import { StatusBadge } from '../../badges/StatusBadge'
import { KanbanCard } from './KanbanCard'

export const NO_VALUE = '__none__'

type Props = {
  /** Option value backing this column, or null for the 'No value' column. */
  value: string | null
  label: string
  docs: Record<string, unknown>[]
  useAsTitle?: string
  onOpen: (id: string) => void
  onPeek?: (id: string) => void
  onDocMenu?: (id: string, x: number, y: number) => void
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export function KanbanColumn({ value, label, docs, useAsTitle, onOpen, onPeek, onDocMenu, selectedIds, onToggleSelect }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${value ?? NO_VALUE}` })

  return (
    <div className={`board-col${isOver ? ' over' : ''}`}>
      <div className="board-col-head">
        {/* The 'No value' column (null value) stays a plain label; real option
            columns get the shared status pill, coloured by their value. */}
        {value == null ? (
          <span className="board-col-label">{label}</span>
        ) : (
          <span className="board-col-label board-col-badge">
            <StatusBadge value={value} label={label} />
          </span>
        )}
        <span className="board-col-count">{docs.length}</span>
      </div>
      <div className="board-col-body" ref={setNodeRef}>
        {docs.map((doc) => (
          <KanbanCard
            onPeek={onPeek}
            onDocMenu={onDocMenu}
            selected={selectedIds?.has(String(doc.id ?? ''))}
            onToggleSelect={onToggleSelect}
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
