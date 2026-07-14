// VS Code-style tab strip: pointer-based drag reorder (dnd-kit — no OS-drop
// requirement, so no HTML5 DnD), preview tabs italic, pinned-first, middle-
// click close, hover-reveal close button, overflow-x scroll with the active
// tab kept in view.
import { useEffect, useRef } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Group, Tab, TabId } from './state'

type Props = {
  group: Group
  tabs: Record<TabId, Tab>
  onActivate: (tabId: TabId) => void
  onClose: (tabId: TabId) => void
  onReorder: (from: number, to: number) => void
  onPromote: (tabId: TabId) => void
  onPin: (tabId: TabId, pinned: boolean) => void
}

export function TabStrip({ group, tabs, onActivate, onClose, onReorder, onPromote, onPin }: Props) {
  // 4px activation distance: clicks stay clicks, drags need intent.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const stripRef = useRef<HTMLDivElement>(null)

  // Keep the active tab visible on change (vscode reveal behavior).
  useEffect(() => {
    const el = stripRef.current?.querySelector('.tab.active')
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [group.activeTabId])

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = group.tabIds.indexOf(String(active.id))
    const to = group.tabIds.indexOf(String(over.id))
    if (from !== -1 && to !== -1) onReorder(from, to)
  }

  return (
    <div className="tab-strip" ref={stripRef}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={group.tabIds} strategy={horizontalListSortingStrategy}>
          {group.tabIds.map((id) => {
            const tab = tabs[id]
            if (!tab) return null
            return (
              <TabItem
                key={id}
                tab={tab}
                active={id === group.activeTabId}
                onActivate={() => onActivate(id)}
                onClose={() => onClose(id)}
                onPromote={() => onPromote(id)}
                onTogglePin={() => onPin(id, !tab.pinned)}
              />
            )
          })}
        </SortableContext>
      </DndContext>
    </div>
  )
}

function TabItem({
  tab,
  active,
  onActivate,
  onClose,
  onPromote,
  onTogglePin,
}: {
  tab: Tab
  active: boolean
  onActivate: () => void
  onClose: () => void
  onPromote: () => void
  onTogglePin: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={[
        'tab',
        active ? 'active' : '',
        tab.preview ? 'preview' : '',
        tab.pinned ? 'pinned' : '',
        isDragging ? 'dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onActivate}
      onDoubleClick={onPromote}
      onAuxClick={(e) => {
        // Middle-click close (vscode AUXCLICK behavior).
        if (e.button === 1) {
          e.preventDefault()
          onClose()
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onTogglePin()
      }}
      title={tab.pinned ? 'Right-click to unpin' : 'Right-click to pin'}
      {...attributes}
      {...listeners}
    >
      {tab.pinned && <span className="tab-pin">◆</span>}
      <span className="tab-title">{tab.title}</span>
      {!tab.pinned && (
        <button
          type="button"
          className="tab-close"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          aria-label="Close tab"
        >
          ×
        </button>
      )}
    </div>
  )
}
