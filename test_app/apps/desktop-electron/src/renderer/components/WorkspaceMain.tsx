// The workspace shell: sidebar + VS Code-style tab strip + per-tab content +
// status bar. Tabs are the navigation model — sidebar clicks open list tabs
// (preview: reused until promoted), document opens become editor tabs, and the
// layout survives restarts via a settings.json snapshot.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
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
import { SplitLayout } from '../workspace/SplitLayout'
import { GlobalForm } from './globals/GlobalForm'
import { useQuickSelect } from '../workspace/useQuickSelect'
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
  const [state, rawDispatch] = useReducer(workspaceReducer, null, () => {
    const first = firstCollectionSlug(schema)
    const meta = schema.menuModel.collections.find((c) => c.slug === first)
    return initialWorkspace({
      kind: first ? 'list' : 'settings',
      slug: first ?? undefined,
      title: meta ? collectionLabel(meta) : 'Settings',
    })
  })
  // Close guard: closing a tab with unsaved edits asks first (covers strip ×,
  // middle-click, and Cmd+W — every close flows through this dispatch).
  const dispatch = useCallback(
    (action: Parameters<typeof rawDispatch>[0]) => {
      if (action.type === 'close') {
        const tab = stateRef.current.tabs[action.tabId]
        if (tab?.dirty && !window.confirm(`"${tab.title}" has unsaved changes. Close anyway?`)) {
          return
        }
      }
      rawDispatch(action)
    },
    [],
  )
  const stateRef = useRef(state)
  stateRef.current = state
  useWorkspaceKeys(state, dispatch)
  const quickSelect = useQuickSelect(state, dispatch)

  // ---- Collapsible sidebar (VS Code: Cmd+B, hamburger, titlebar toggler) ----
  const [sidebarVisible, setSidebarVisible] = useState(true)
  useEffect(() => {
    window.payloadDesktop.getSettings().then((s) => {
      if (s.sidebarVisible === false) setSidebarVisible(false)
    }).catch(() => {})
  }, [])
  const toggleSidebar = useCallback(() => {
    setSidebarVisible((v) => {
      window.payloadDesktop.setSettings({ sidebarVisible: !v }).catch(() => {})
      return !v
    })
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleSidebar])

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
  const openGlobal = useCallback(
    (slug: string) => {
      const meta = schema.menuModel.globals.find((g) => g.slug === slug)
      dispatch({
        type: 'open',
        target: { kind: 'global', slug, title: meta?.label ?? slug },
        mode: 'permanent',
      })
    },
    [schema, dispatch],
  )
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
      if (verb === 'global') openGlobal(slug)
      else if (verb === 'open' || verb === 'new') openList(slug, 'permanent')
    })
    return dispose
  }, [openList, openGlobal, openSettings])

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
        <button
          className="icon-btn no-drag"
          onClick={toggleSidebar}
          title={sidebarVisible ? 'Hide sidebar (Cmd+B)' : 'Show sidebar (Cmd+B)'}
        >
          ▤
        </button>
      </div>

      <div className="workspace-body">
        {sidebarVisible && (
        <Sidebar
          onCollapse={toggleSidebar}
          schema={schema}
          activeSlug={activeTab?.kind === 'list' ? activeTab.slug ?? null : activeSlug}
          settingsActive={activeTab?.kind === 'settings'}
          onSelect={(slug) => openList(slug)}
          onSelectGlobal={openGlobal}
          activeGlobalSlug={activeTab?.kind === 'global' ? activeTab.slug ?? null : null}
          onOpenSettings={openSettings}
        />
        )}

        <div className="tab-area">
          <SplitLayout
            state={state}
            dispatch={dispatch}
            quickSelect={quickSelect}
            renderContent={(tab) => {
              if (tab.kind === 'list' && tab.slug) {
                return (
                  <DocumentList
                    key={tab.id}
                    schema={schema}
                    slug={tab.slug}
                    serverURL={serverURL}
                    onOpen={(id) => openEditor(tab.slug!, id)}
                  />
                )
              }
              if (tab.kind === 'global' && tab.slug) {
                return (
                  <GlobalForm
                    key={tab.id}
                    slug={tab.slug}
                    schema={schema}
                    serverURL={serverURL}
                    token={token}
                    onTitle={(title) => dispatch({ type: 'retitle', tabId: tab.id, title })}
                  />
                )
              }
              if (tab.kind === 'editor' && tab.slug && tab.docId) {
                return (
                  <DocumentForm
                    key={tab.id}
                    slug={tab.slug}
                    id={tab.docId}
                    serverURL={serverURL}
                    token={token}
                    rootFields={getRootFields(schema, tab.slug)}
                    hasDrafts={Boolean(
                      schema.menuModel.collections.find((c) => c.slug === tab.slug)?.drafts,
                    )}
                    onClose={() => dispatch({ type: 'close', tabId: tab.id })}
                    onDeleted={() => dispatch({ type: 'close', tabId: tab.id })}
                    onTitle={(title) => dispatch({ type: 'retitle', tabId: tab.id, title })}
                    onDirtyChange={(dirty) => dispatch({ type: 'setDirty', tabId: tab.id, dirty })}
                    onDuplicated={(newId) => tab.slug && openEditor(tab.slug, newId)}
                    editActions={
                      schema.menuModel.collections.find((c) => c.slug === tab.slug)?.editActions ?? []
                    }
                  />
                )
              }
              if (tab.kind === 'settings') {
                return (
                  <SettingsScreen
                    serverURL={serverURL}
                    wsURLOverride={wsURLOverride}
                    email={email}
                    onLogout={onLogout}
                    onChangeServer={onChangeServer}
                  />
                )
              }
              return <div className="empty">Unknown tab.</div>
            }}
          />
        </div>
      </div>

      <StatusBar activeSlug={activeSlug} onOpenSettings={openSettings} />
    </div>
  )
}
