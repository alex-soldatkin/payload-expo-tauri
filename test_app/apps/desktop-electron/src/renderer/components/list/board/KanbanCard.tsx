// A single board card: draggable via dnd-kit useDraggable (id = doc.id).
// Shows docTitle + updatedAt + the locally-modified dot (same convention as
// ListTable rows). A plain click selects (or opens) — the PointerSensor's 6px
// activation constraint (see KanbanBoard) keeps clicks from starting a drag.
//
// The long-press peek handlers and dnd-kit's activator BOTH need pointer
// events, so they are merged (spreading one after the other silently
// overwrites onPointerDown and kills dragging — that regression shipped once).
// While dragging, the card itself stays in place dimmed; the moving preview
// is the board-level DragOverlay, which escapes the column's overflow clip.
import { useDraggable } from '@dnd-kit/core'
import { longPressHandlers } from '../../../lib/longPress'
import { docTitle, formatUpdatedAt } from '../../../lib/doc'
import { CardFields } from '../CardFields'
import type { DisplayField } from '../columns'

type Props = {
  doc: Record<string, unknown>
  useAsTitle?: string
  onOpen: (id: string) => void
  onPeek?: (id: string) => void
  onDocMenu?: (id: string, x: number, y: number) => void
  selected?: boolean
  onToggleSelect?: (id: string) => void
  /** Set by the board on any completed drag; the trailing click checks+clears. */
  suppressClickRef?: React.MutableRefObject<boolean>
  /** This card is being carried by the current drag — gather (shrink/fade). */
  carried?: boolean
  /** This card just landed in a new column — play the placement animation. */
  placed?: boolean
  /** Configured extra columns (gear icon flow) repeated on the card. */
  cardCols?: DisplayField[]
}

/** The card's visual content, shared with the board's DragOverlay preview. */
export function KanbanCardBody({
  doc,
  useAsTitle,
  cardCols,
}: {
  doc: Record<string, unknown>
  useAsTitle?: string
  cardCols?: DisplayField[]
}) {
  const modified = Boolean(doc._locallyModified)
  return (
    <>
      <div className="board-card-head">
        <span className={`dot${modified ? '' : ' placeholder'}`} />
        <span className="board-card-title">{docTitle(doc, useAsTitle)}</span>
      </div>
      {cardCols && cardCols.length > 0 && <CardFields doc={doc} cols={cardCols} />}
      <span className="board-card-meta">{formatUpdatedAt(doc.updatedAt)}</span>
    </>
  )
}

export function KanbanCard({ doc, useAsTitle, onOpen, onPeek, onDocMenu, selected, onToggleSelect, suppressClickRef, carried, placed, cardCols }: Props) {
  const id = String(doc.id ?? '')
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  const lp = onPeek ? longPressHandlers(() => onPeek(id)) : null

  return (
    <div
      ref={setNodeRef}
      className={`board-card${isDragging ? ' dragging' : ''}${carried ? ' gathering' : ''}${placed ? ' placed' : ''}${selected ? ' selected' : ''}`}
      {...attributes}
      role="button"
      tabIndex={0}
      onPointerDown={(e) => {
        lp?.onPointerDown(e)
        ;(listeners?.onPointerDown as ((e: React.PointerEvent) => void) | undefined)?.(e)
      }}
      onPointerMove={(e) => lp?.onPointerMove(e)}
      onPointerUp={() => lp?.onPointerUp()}
      onPointerLeave={() => lp?.onPointerLeave()}
      onClickCapture={(e) => lp?.onClickCapture(e)}
      onContextMenu={(e) => {
        if (!onDocMenu) return
        e.preventDefault()
        onDocMenu(id, e.clientX, e.clientY)
      }}
      onClick={(e) => {
        if (suppressClickRef?.current) {
          suppressClickRef.current = false
          return
        }
        // Cmd/Ctrl+click: open in a tab, leave selection alone.
        if (e.metaKey || e.ctrlKey) return onOpen(id)
        if (onToggleSelect) onToggleSelect(id)
        else onOpen(id)
      }}
      onDoubleClick={() => onOpen(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(id)
        }
      }}
    >
      <KanbanCardBody doc={doc} useAsTitle={useAsTitle} cardCols={cardCols} />
    </div>
  )
}
