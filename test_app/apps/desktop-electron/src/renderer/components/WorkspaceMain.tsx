// The workspace shell: sidebar + VS Code-style tab strip + per-tab content +
// status bar. Tabs are the navigation model — sidebar clicks open list tabs
// (preview: reused until promoted), document opens become editor tabs, and the
// layout survives restarts via a settings.json snapshot.
import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { AdminSchema } from '@payload-universal/admin-schema'
import { Sidebar } from './Sidebar'
import { DocumentList } from './DocumentList'
import { SettingsScreen } from './SettingsScreen'
import { StatusBar } from './StatusBar'
import { DocumentForm } from '../form/DocumentForm'
import '../form/custom/registerSSOT'
import { buildMenuTree } from '../lib/menuTree'
import { collectionLabel, firstCollectionSlug } from '../lib/collections'
import { getRootFields } from '../lib/schemaFields'
import { TabStrip } from '../workspace/TabStrip'
import {
  hydrateWorkspace,
  initialWorkspace,
  serializeWorkspace,
  workspaceReducer,
  type Tab,
  type WorkspaceSnapshot,
} from '../workspace/state'
import { useWorkspaceKeys } from '../workspace/useWorkspaceKeys'

type Props = {
  schema: AdminSchema
  serverURL: string
  token: string
  wsURLOverride?: string
  email?: string
  onLogout: () => void
  onChangeServer: () => void
}

export function WorkspaceMain({ schema, serverURL, token, wsURLOverride, email, onLogout, onChangeServer }: Props) {
  const [state, dispatch] = useReducer(workspaceReducer, null, () => {
    const first = firstCollectionSlug(schema)
    const meta = schema.menuModel.collections.find((c) => c.slug === first)
    return initialWorkspace({
      kind: first ? 'list' : 'settings',
      slug: first ?? undefined,
      title: meta ? collectionLabel(meta) : 'Settings',
    })
  })
  useWorkspaceKeys(state, dispatch)

  // ---- Restore + persist the tab layout ------------------------------------
  const hydrated = useRef(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const settings = await window.payloadDesktop.getSettings()
        const snap = settings.workspace as WorkspaceSnapshot | undefined
        if (!cancelled && snap && !hydrated.current) {
          const restored = hydrateWorkspace(snap)
          if (restored) dispatch({ type: 'hydrate', state: restored })
        }
      } catch { /* fresh session */ }
      hydrated.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    if (!hydrated.current) return
    const t = setTimeout(() => {
      window.payloadDesktop.setSettings({ workspace: serializeWorkspace(state) }).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [state])

  // ---- Open helpers ---------------------------------------------------------
  const openList = useCallback(
    (slug: string, mode: 'preview' | 'permanent' = 'preview') => {
      const meta = schema.menuModel.collections.find((c) => c.slug === slug)
      dispatch({
        type: 'open',
        target: { kind: 'list', slug, title: meta ? collectionLabel(meta) : slug },
        mode,
      })
    },
    [schema],
  )
  const openEditor = useCallback((slug: string, docId: string) => {
    dispatch({ type: 'open', target: { kind: 'editor', slug, docId, title: '…' }, mode: 'permanent' })
  }, [])
  const openSettings = useCallback(() => {
    dispatch({ type: 'open', target: { kind: 'settings', title: 'Settings' }, mode: 'permanent' })
  }, [])

  // ---- Native menu ----------------------------------------------------------
  useEffect(() => {
    window.payloadDesktop.setMenu(buildMenuTree(schema))
  }, [schema])
  useEffect(() => {
    const dispose = window.payloadDesktop.onMenuAction((action) => {
      if (action === 'reload') return window.location.reload()
      if (action === 'open-web-admin') return window.payloadDesktop.openWebAdmin()
      if (action === 'settings') return openSettings()
      const [verb, slug] = action.split(':')
      if (!slug) return
      if (verb === 'open' || verb === 'global' || verb === 'new') openList(slug, 'permanent')
    })
    return dispose
  }, [openList, openSettings])

  const group = state.groups[state.activeGroupId]
  const activeTab: Tab | undefined = group.activeTabId ? state.tabs[group.activeTabId] : undefined
  const activeSlug = activeTab?.kind !== 'settings' ? activeTab?.slug ?? null : null

  return (
    <div className="workspace">
      <div className="titlebar">
        <span>Payload Universal</span>
        <span className="no-drag" style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>
          {serverURL}
        </span>
        <div className="spacer" />
      </div>

      <div className="workspace-body">
        <Sidebar
          schema={schema}
          activeSlug={activeTab?.kind === 'list' ? activeTab.slug ?? null : activeSlug}
          settingsActive={activeTab?.kind === 'settings'}
          onSelect={(slug) => openList(slug)}
          onOpenSettings={openSettings}
        />

        <div className="tab-area">
          <TabStrip
            group={group}
            tabs={state.tabs}
            onActivate={(id) => dispatch({ type: 'activate', tabId: id })}
            onClose={(id) => dispatch({ type: 'close', tabId: id })}
            onReorder={(from, to) => dispatch({ type: 'reorder', groupId: group.id, from, to })}
            onPromote={(id) => dispatch({ type: 'promote', tabId: id })}
            onPin={(id, pinned) => dispatch({ type: 'pin', tabId: id, pinned })}
          />

          {!activeTab && <div className="empty">No open tabs — pick a collection.</div>}
          {activeTab?.kind === 'list' && activeTab.slug && (
            <DocumentList
              key={activeTab.id}
              schema={schema}
              slug={activeTab.slug}
              onOpen={(id) => openEditor(activeTab.slug!, id)}
            />
          )}
          {activeTab?.kind === 'editor' && activeTab.slug && activeTab.docId && (
            <DocumentForm
              key={activeTab.id}
              slug={activeTab.slug}
              id={activeTab.docId}
              serverURL={serverURL}
              token={token}
              rootFields={getRootFields(schema, activeTab.slug)}
              hasDrafts={Boolean(
                schema.menuModel.collections.find((c) => c.slug === activeTab.slug)?.drafts,
              )}
              onClose={() => dispatch({ type: 'close', tabId: activeTab.id })}
              onDeleted={() => dispatch({ type: 'close', tabId: activeTab.id })}
              onTitle={(title) => dispatch({ type: 'retitle', tabId: activeTab.id, title })}
            />
          )}
          {activeTab?.kind === 'settings' && (
            <SettingsScreen
              serverURL={serverURL}
              wsURLOverride={wsURLOverride}
              email={email}
              onLogout={onLogout}
              onChangeServer={onChangeServer}
            />
          )}
        </div>
      </div>

      <StatusBar activeSlug={activeSlug} onOpenSettings={openSettings} />
    </div>
  )
}
