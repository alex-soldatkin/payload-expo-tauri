// Renders the workspace split tree: PanelGroups per branch, a GroupView
// (tab strip + content) per leaf. Owns the DndContext so tabs can travel
// across groups: dropping on another tab reorders within a group; dropping on
// a group's five-region overlay (vscode editorDropTarget) moves (center) or
// splits (edges).
import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { Action, Group, Layout, Tab, TabId, WorkspaceState } from './state'
import type { SplitDirection } from './layout'
import { TabStrip } from './TabStrip'

type RenderContent = (tab: Tab, groupId: string) => React.ReactNode

type Props = {
  state: WorkspaceState
  dispatch: (a: Action) => void
  renderContent: RenderContent
}

export function SplitLayout({ state, dispatch, renderContent }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const [draggingTab, setDraggingTab] = useState<TabId | null>(null)

  const onDragStart = (e: DragStartEvent) => setDraggingTab(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setDraggingTab(null)
    const { active, over } = e
    if (!over) return
    const tabId = String(active.id)
    const overId = String(over.id)
    if (overId.startsWith('drop:')) {
      const [, groupId, region] = overId.split(':')
      if (region === 'center') dispatch({ type: 'moveTabToGroup', tabId, targetGroupId: groupId })
      else dispatch({ type: 'splitWithTab', tabId, targetGroupId: groupId, dir: region as SplitDirection })
      return
    }
    // Dropped on another tab → reorder within that tab's group.
    if (overId !== tabId) {
      const group = Object.values(state.groups).find((g) => g.tabIds.includes(overId))
      const sourceGroup = Object.values(state.groups).find((g) => g.tabIds.includes(tabId))
      if (group && sourceGroup?.id === group.id) {
        dispatch({
          type: 'reorder',
          groupId: group.id,
          from: group.tabIds.indexOf(tabId),
          to: group.tabIds.indexOf(overId),
        })
      } else if (group) {
        dispatch({ type: 'moveTabToGroup', tabId, targetGroupId: group.id })
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingTab(null)}
    >
      <LayoutNode
        layout={state.layout}
        path={[]}
        state={state}
        dispatch={dispatch}
        renderContent={renderContent}
        dragging={Boolean(draggingTab)}
      />
    </DndContext>
  )
}

function LayoutNode({
  layout,
  path,
  state,
  dispatch,
  renderContent,
  dragging,
}: {
  layout: Layout
  path: number[]
  state: WorkspaceState
  dispatch: (a: Action) => void
  renderContent: RenderContent
  dragging: boolean
}) {
  if (layout.type === 'leaf') {
    const group = state.groups[layout.groupId]
    if (!group) return null
    return (
      <GroupView
        group={group}
        state={state}
        dispatch={dispatch}
        renderContent={renderContent}
        dragging={dragging}
      />
    )
  }
  return (
    <PanelGroup
      direction={layout.orientation}
      onLayout={(sizes) => dispatch({ type: 'resize', branchPath: path, sizes })}
    >
      {layout.children.map((child, i) => (
        <FragmentWithHandle key={i} first={i === 0}>
          <Panel defaultSize={layout.sizes[i] ?? 100 / layout.children.length} minSize={15}>
            <LayoutNode
              layout={child}
              path={[...path, i]}
              state={state}
              dispatch={dispatch}
              renderContent={renderContent}
              dragging={dragging}
            />
          </Panel>
        </FragmentWithHandle>
      ))}
    </PanelGroup>
  )
}

function FragmentWithHandle({ first, children }: { first: boolean; children: React.ReactNode }) {
  return (
    <>
      {!first && <PanelResizeHandle className="split-handle" />}
      {children}
    </>
  )
}

const REGIONS: Array<{ region: SplitDirection | 'center'; className: string }> = [
  { region: 'center', className: 'region-center' },
  { region: 'left', className: 'region-left' },
  { region: 'right', className: 'region-right' },
  { region: 'up', className: 'region-up' },
  { region: 'down', className: 'region-down' },
]

function GroupView({
  group,
  state,
  dispatch,
  renderContent,
  dragging,
}: {
  group: Group
  state: WorkspaceState
  dispatch: (a: Action) => void
  renderContent: RenderContent
  dragging: boolean
}) {
  const activeTab = group.activeTabId ? state.tabs[group.activeTabId] : undefined
  const isActiveGroup = state.activeGroupId === group.id
  return (
    <div
      className={`group-view${isActiveGroup ? ' focused' : ''}`}
      onMouseDownCapture={() => {
        if (!isActiveGroup && group.activeTabId) dispatch({ type: 'activate', tabId: group.activeTabId })
      }}
    >
      <TabStrip
        group={group}
        tabs={state.tabs}
        onActivate={(id) => dispatch({ type: 'activate', tabId: id })}
        onClose={(id) => dispatch({ type: 'close', tabId: id })}
        onPromote={(id) => dispatch({ type: 'promote', tabId: id })}
        onPin={(id, pinned) => dispatch({ type: 'pin', tabId: id, pinned })}
      />
      <div className="group-content">
        {activeTab ? renderContent(activeTab, group.id) : <div className="empty">No open tabs.</div>}
        {dragging && (
          <div className="drop-overlay">
            {REGIONS.map(({ region, className }) => (
              <DropRegion key={region} id={`drop:${group.id}:${region}`} className={className} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DropRegion({ id, className }: { id: string; className: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return <div ref={setNodeRef} className={`drop-region ${className}${isOver ? ' over' : ''}`} />
}
