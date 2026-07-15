// VS Code-style tab strip: pointer-based drag reorder (dnd-kit — no OS-drop
// requirement, so no HTML5 DnD), preview tabs italic, pinned-first, middle-
// click close, hover-reveal close button, overflow-x scroll with the active
// tab kept in view.
import { useEffect, useRef } from 'react'
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
  onPromote: (tabId: TabId) => void
  onPin: (tabId: TabId, pinned: boolean) => void
}

// Drag context lives in SplitLayout (drags cross groups); this strip only
// declares the sortable items.
export function TabStrip({ group, tabs, onActivate, onClose, onPromote, onPin }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)

  // Keep the active tab visible on change (vscode reveal behavior).
  useEffect(() => {
    const el = stripRef.current?.querySelector('.tab.active')
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [group.activeTabId])

  return (
    <div className="tab-strip" ref={stripRef}>
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
      {tab.dirty && <span className="tab-dirty" title="Unsaved changes" />}
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
