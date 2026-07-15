// VS Code-style workspace state: normalized tabs/groups + a split-tree layout.
// Mirrors the model distilled from vscode's grid serialization (ISerializedGrid):
// layout leaves reference groups by id; tab contents live in normalized records
// so reorder/move/MRU are cheap array edits. MRU is kept SEPARATE from the
// visual tab order (vscode behavior: Ctrl+Tab walks recency, the strip stays
// spatially stable).
import { leafOrder, removeLeaf, resizeBranch, splitLeaf } from './layout'

export type TabId = string
export type GroupId = string

export type Tab = {
  id: TabId
  /** What the tab shows. */
  kind: 'list' | 'editor' | 'settings'
  slug?: string
  docId?: string
  title: string
  pinned: boolean
  /** Preview tabs (single-click, italic) are reused by the next preview open. */
  preview: boolean
  /** Unsaved edits in this tab's editor (drives the dot + close guard). */
  dirty?: boolean
}

export type Group = {
  id: GroupId
  tabIds: TabId[]
  activeTabId: TabId | null
}

/** Binary split tree; leaves reference a group. Single leaf = no splits. */
export type Layout =
  | { type: 'leaf'; groupId: GroupId }
  | { type: 'branch'; orientation: 'horizontal' | 'vertical'; sizes: number[]; children: Layout[] }

export type WorkspaceState = {
  tabs: Record<TabId, Tab>
  groups: Record<GroupId, Group>
  layout: Layout
  activeGroupId: GroupId
  /** Most-recently-used tab ids, most recent first. Never contains stale ids. */
  mru: TabId[]
  recentlyClosed: Array<Pick<Tab, 'kind' | 'slug' | 'docId' | 'title'>>
}

let counter = 0
const newId = (prefix: string) => `${prefix}_${++counter}_${Math.random().toString(36).slice(2, 7)}`

export function initialWorkspace(firstTab: Omit<Tab, 'id' | 'pinned' | 'preview'>): WorkspaceState {
  const tab: Tab = { ...firstTab, id: newId('tab'), pinned: false, preview: false }
  const group: Group = { id: newId('grp'), tabIds: [tab.id], activeTabId: tab.id }
  return {
    tabs: { [tab.id]: tab },
    groups: { [group.id]: group },
    layout: { type: 'leaf', groupId: group.id },
    activeGroupId: group.id,
    mru: [tab.id],
    recentlyClosed: [],
  }
}

/** Two tabs are "the same document" when kind/slug/docId all match. */
function sameTarget(a: Pick<Tab, 'kind' | 'slug' | 'docId'>, b: Pick<Tab, 'kind' | 'slug' | 'docId'>): boolean {
  return a.kind === b.kind && a.slug === b.slug && a.docId === b.docId
}

function touchMru(mru: TabId[], id: TabId): TabId[] {
  return [id, ...mru.filter((m) => m !== id)]
}

/** Keep pinned tabs first, preserving relative order within each half. */
function pinnedFirst(tabIds: TabId[], tabs: Record<TabId, Tab>): TabId[] {
  const pinned = tabIds.filter((t) => tabs[t]?.pinned)
  const rest = tabIds.filter((t) => !tabs[t]?.pinned)
  return [...pinned, ...rest]
}

export type Action =
  | { type: 'open'; target: Omit<Tab, 'id' | 'pinned' | 'preview'>; mode: 'preview' | 'permanent' }
  | { type: 'activate'; tabId: TabId }
  | { type: 'close'; tabId: TabId }
  | { type: 'reopenClosed' }
  | { type: 'reorder'; groupId: GroupId; from: number; to: number }
  | { type: 'pin'; tabId: TabId; pinned: boolean }
  | { type: 'promote'; tabId: TabId } // preview → permanent
  | { type: 'retitle'; tabId: TabId; title: string }
  | { type: 'setDirty'; tabId: TabId; dirty: boolean }
  | { type: 'mruNext' } // Ctrl+Tab: activate the next-most-recent tab
  | { type: 'hydrate'; state: WorkspaceState }
  // Splits (vscode editor groups)
  | { type: 'splitWithTab'; tabId: TabId; targetGroupId: GroupId; dir: import('./layout').SplitDirection }
  | { type: 'moveTabToGroup'; tabId: TabId; targetGroupId: GroupId }
  | { type: 'focusGroupAt'; index: number } // Cmd+1..9, visual order
  | { type: 'resize'; branchPath: number[]; sizes: number[] }

/**
 * Pull a tab out of its group without recording it as closed. If the group
 * empties and other groups remain, the group and its leaf are removed.
 */
function extractTab(state: WorkspaceState, tabId: TabId): WorkspaceState | null {
  const group = Object.values(state.groups).find((g) => g.tabIds.includes(tabId))
  if (!group) return null
  const tabIds = group.tabIds.filter((t) => t !== tabId)
  const nextActive =
    group.activeTabId === tabId
      ? state.mru.find((t) => t !== tabId && tabIds.includes(t)) ?? tabIds[tabIds.length - 1] ?? null
      : group.activeTabId
  let groups = { ...state.groups, [group.id]: { ...group, tabIds, activeTabId: nextActive } }
  let layout = state.layout
  let activeGroupId = state.activeGroupId
  if (tabIds.length === 0 && Object.keys(groups).length > 1) {
    const { [group.id]: _gone, ...rest } = groups
    groups = rest
    layout = removeLeaf(layout, group.id) ?? layout
    if (activeGroupId === group.id) activeGroupId = leafOrder(layout)[0]
  }
  return { ...state, groups, layout, activeGroupId }
}

export function workspaceReducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'open': {
      const group = state.groups[state.activeGroupId]
      // Existing tab for the same target → just activate (promote if permanent open).
      const existing = group.tabIds.map((t) => state.tabs[t]).find((t) => sameTarget(t, action.target))
      if (existing) {
        const tabs =
          action.mode === 'permanent' && existing.preview
            ? { ...state.tabs, [existing.id]: { ...existing, preview: false } }
            : state.tabs
        return {
          ...state,
          tabs,
          groups: { ...state.groups, [group.id]: { ...group, activeTabId: existing.id } },
          mru: touchMru(state.mru, existing.id),
        }
      }
      // Preview opens reuse the group's current preview tab (vscode: only one).
      if (action.mode === 'preview') {
        const previewTab = group.tabIds.map((t) => state.tabs[t]).find((t) => t.preview)
        if (previewTab) {
          const updated: Tab = { ...previewTab, ...action.target, preview: true }
          return {
            ...state,
            tabs: { ...state.tabs, [previewTab.id]: updated },
            groups: { ...state.groups, [group.id]: { ...group, activeTabId: previewTab.id } },
            mru: touchMru(state.mru, previewTab.id),
          }
        }
      }
      const tab: Tab = { ...action.target, id: newId('tab'), pinned: false, preview: action.mode === 'preview' }
      const tabIds = pinnedFirst([...group.tabIds, tab.id], { ...state.tabs, [tab.id]: tab })
      return {
        ...state,
        tabs: { ...state.tabs, [tab.id]: tab },
        groups: { ...state.groups, [group.id]: { ...group, tabIds, activeTabId: tab.id } },
        mru: touchMru(state.mru, tab.id),
      }
    }
    case 'activate': {
      const group = Object.values(state.groups).find((g) => g.tabIds.includes(action.tabId))
      if (!group) return state
      return {
        ...state,
        groups: { ...state.groups, [group.id]: { ...group, activeTabId: action.tabId } },
        activeGroupId: group.id,
        mru: touchMru(state.mru, action.tabId),
      }
    }
    case 'close': {
      const tab = state.tabs[action.tabId]
      const pulled = extractTab(state, action.tabId)
      if (!tab || !pulled) return state
      const { [action.tabId]: _closed, ...tabs } = pulled.tabs
      return {
        ...pulled,
        tabs,
        mru: pulled.mru.filter((t) => t !== action.tabId),
        recentlyClosed: [
          { kind: tab.kind, slug: tab.slug, docId: tab.docId, title: tab.title },
          ...pulled.recentlyClosed,
        ].slice(0, 20),
      }
    }
    case 'reopenClosed': {
      const [last, ...rest] = state.recentlyClosed
      if (!last) return state
      const reopened = workspaceReducer(state, { type: 'open', target: last, mode: 'permanent' })
      return { ...reopened, recentlyClosed: rest }
    }
    case 'reorder': {
      const group = state.groups[action.groupId]
      if (!group) return state
      const tabIds = [...group.tabIds]
      const [moved] = tabIds.splice(action.from, 1)
      tabIds.splice(action.to, 0, moved)
      return {
        ...state,
        groups: { ...state.groups, [group.id]: { ...group, tabIds: pinnedFirst(tabIds, state.tabs) } },
      }
    }
    case 'pin': {
      const tab = state.tabs[action.tabId]
      if (!tab) return state
      const tabs = { ...state.tabs, [tab.id]: { ...tab, pinned: action.pinned, preview: false } }
      const group = Object.values(state.groups).find((g) => g.tabIds.includes(tab.id))
      if (!group) return { ...state, tabs }
      return {
        ...state,
        tabs,
        groups: { ...state.groups, [group.id]: { ...group, tabIds: pinnedFirst(group.tabIds, tabs) } },
      }
    }
    case 'promote': {
      const tab = state.tabs[action.tabId]
      if (!tab || !tab.preview) return state
      return { ...state, tabs: { ...state.tabs, [tab.id]: { ...tab, preview: false } } }
    }
    case 'retitle': {
      const tab = state.tabs[action.tabId]
      if (!tab || tab.title === action.title) return state
      return { ...state, tabs: { ...state.tabs, [tab.id]: { ...tab, title: action.title } } }
    }
    case 'setDirty': {
      const tab = state.tabs[action.tabId]
      if (!tab || Boolean(tab.dirty) === action.dirty) return state
      // Editing promotes a preview tab (vscode behavior).
      return {
        ...state,
        tabs: { ...state.tabs, [tab.id]: { ...tab, dirty: action.dirty, preview: tab.preview && !action.dirty } },
      }
    }
    case 'hydrate':
      return action.state
    case 'splitWithTab': {
      const source = Object.values(state.groups).find((g) => g.tabIds.includes(action.tabId))
      if (!source) return state
      // Splitting a group with its own only tab is a no-op.
      if (source.id === action.targetGroupId && source.tabIds.length === 1) return state
      const pulled = extractTab(state, action.tabId)
      if (!pulled) return state
      const newGroup: Group = { id: newId('grp'), tabIds: [action.tabId], activeTabId: action.tabId }
      return {
        ...pulled,
        groups: { ...pulled.groups, [newGroup.id]: newGroup },
        layout: splitLeaf(pulled.layout, action.targetGroupId, newGroup.id, action.dir),
        activeGroupId: newGroup.id,
        mru: touchMru(pulled.mru, action.tabId),
      }
    }
    case 'moveTabToGroup': {
      const source = Object.values(state.groups).find((g) => g.tabIds.includes(action.tabId))
      const target = state.groups[action.targetGroupId]
      if (!source || !target || source.id === target.id) return state
      const pulled = extractTab(state, action.tabId)
      if (!pulled) return state
      const freshTarget = pulled.groups[action.targetGroupId]
      if (!freshTarget) return state
      const tabIds = pinnedFirst([...freshTarget.tabIds, action.tabId], pulled.tabs)
      return {
        ...pulled,
        groups: {
          ...pulled.groups,
          [freshTarget.id]: { ...freshTarget, tabIds, activeTabId: action.tabId },
        },
        activeGroupId: freshTarget.id,
        mru: touchMru(pulled.mru, action.tabId),
      }
    }
    case 'focusGroupAt': {
      const order = leafOrder(state.layout)
      const groupId = order[action.index]
      if (!groupId || groupId === state.activeGroupId) return state
      const group = state.groups[groupId]
      return {
        ...state,
        activeGroupId: groupId,
        mru: group?.activeTabId ? touchMru(state.mru, group.activeTabId) : state.mru,
      }
    }
    case 'resize':
      return { ...state, layout: resizeBranch(state.layout, action.branchPath, action.sizes) }
    case 'mruNext': {
      const group = state.groups[state.activeGroupId]
      if (!group || group.tabIds.length < 2) return state
      const current = group.activeTabId
      const next = state.mru.find((t) => t !== current && group.tabIds.includes(t))
      if (!next) return state
      return workspaceReducer(state, { type: 'activate', tabId: next })
    }
    default:
      return state
  }
}

export type WorkspaceSnapshot = {
  tabs: Array<Pick<Tab, 'kind' | 'slug' | 'docId' | 'title' | 'pinned'>>
  activeIndex: number
}

/** Rebuild a workspace from a persisted snapshot (fresh ids). */
export function hydrateWorkspace(snapshot: WorkspaceSnapshot): WorkspaceState | null {
  if (!snapshot?.tabs?.length) return null
  let state = initialWorkspace(snapshot.tabs[0])
  if (snapshot.tabs[0].pinned) {
    state = workspaceReducer(state, { type: 'pin', tabId: state.mru[0], pinned: true })
  }
  for (const t of snapshot.tabs.slice(1)) {
    state = workspaceReducer(state, { type: 'open', target: t, mode: 'permanent' })
    if (t.pinned) state = workspaceReducer(state, { type: 'pin', tabId: state.mru[0], pinned: true })
  }
  const group = state.groups[state.activeGroupId]
  const activeId = group.tabIds[Math.min(snapshot.activeIndex, group.tabIds.length - 1)]
  if (activeId) state = workspaceReducer(state, { type: 'activate', tabId: activeId })
  return state
}

/** Serializable subset persisted to settings.json (ids regenerate on load). */
export function serializeWorkspace(state: WorkspaceState) {
  const group = state.groups[state.activeGroupId]
  return {
    tabs: group.tabIds.map((t) => {
      const { kind, slug, docId, title, pinned } = state.tabs[t]
      return { kind, slug, docId, title, pinned }
    }),
    activeIndex: group.activeTabId ? group.tabIds.indexOf(group.activeTabId) : 0,
  }
}
