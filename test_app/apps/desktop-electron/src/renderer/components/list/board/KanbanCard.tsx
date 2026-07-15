import { longPressHandlers } from '../../../lib/longPress'
// A single board card: draggable via dnd-kit useDraggable (id = doc.id).
// Shows docTitle + updatedAt + the locally-modified dot (same convention as
// ListTable rows). A plain click opens the doc — the PointerSensor's 6px
// activation constraint (see KanbanBoard) keeps clicks from starting a drag.
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { docTitle, formatUpdatedAt } from '../../../lib/doc'

type Props = {
  doc: Record<string, unknown>
  useAsTitle?: string
  onOpen: (id: string) => void
  onPeek?: (id: string) => void
  onDocMenu?: (id: string, x: number, y: number) => void
}

export function KanbanCard({ doc, useAsTitle, onOpen, onPeek, onDocMenu }: Props) {
  const id = String(doc.id ?? '')
  const modified = Boolean(doc._locallyModified)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={`board-card${isDragging ? ' dragging' : ''}`}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      {...(onPeek ? longPressHandlers(() => onPeek(id)) : {})}
      onContextMenu={(e) => {
        if (!onDocMenu) return
        e.preventDefault()
        onDocMenu(id, e.clientX, e.clientY)
      }}
      onClick={() => onOpen(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(id)
        }
      }}
    >
      <div className="board-card-head">
        <span className={`dot${modified ? '' : ' placeholder'}`} />
        <span className="board-card-title">{docTitle(doc, useAsTitle)}</span>
      </div>
      <span className="board-card-meta">{formatUpdatedAt(doc.updatedAt)}</span>
    </div>
  )
}
