// The workspace view router: sidebar + main pane (list / editor / settings) +
// status bar. Rendered inside LocalDBProvider so all local-db hooks work.
import { useEffect, useState } from 'react'
import type { AdminSchema } from '@payload-universal/admin-schema'
import { Sidebar } from './Sidebar'
import { DocumentList } from './DocumentList'
import { DocumentEditor } from './DocumentEditor'
import { SettingsScreen } from './SettingsScreen'
import { StatusBar } from './StatusBar'
import { buildMenuTree } from '../lib/menuTree'
import { firstCollectionSlug } from '../lib/collections'

export type View =
  | { kind: 'list'; slug: string }
  | { kind: 'editor'; slug: string; id: string }
  | { kind: 'settings' }

type Props = {
  schema: AdminSchema
  serverURL: string
  wsURLOverride?: string
  email?: string
  onLogout: () => void
  onChangeServer: () => void
}

export function WorkspaceMain({
  schema,
  serverURL,
  wsURLOverride,
  email,
  onLogout,
  onChangeServer,
}: Props) {
  const [view, setView] = useState<View>(() => {
    const first = firstCollectionSlug(schema)
    return first ? { kind: 'list', slug: first } : { kind: 'settings' }
  })

  const openList = (slug: string) => setView({ kind: 'list', slug })
  const openEditor = (slug: string, id: string) => setView({ kind: 'editor', slug, id })
  const openSettings = () => setView({ kind: 'settings' })

  const activeSlug = view.kind === 'settings' ? null : view.slug

  // ---- Native menu: publish tree + handle actions -------------------------
  useEffect(() => {
    window.payloadDesktop.setMenu(buildMenuTree(schema))
  }, [schema])

  useEffect(() => {
    const dispose = window.payloadDesktop.onMenuAction((action) => {
      if (action === 'reload') {
        window.location.reload()
        return
      }
      if (action === 'open-web-admin') {
        window.payloadDesktop.openWebAdmin()
        return
      }
      if (action === 'settings') {
        openSettings()
        return
      }
      const [verb, slug] = action.split(':')
      if (!slug) return
      if (verb === 'open' || verb === 'global') openList(slug)
      else if (verb === 'new') openList(slug) // list view hosts "New document"
    })
    return dispose
  }, [])

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
          activeSlug={activeSlug}
          settingsActive={view.kind === 'settings'}
          onSelect={openList}
          onOpenSettings={openSettings}
        />

        {view.kind === 'list' && (
          <DocumentList
            schema={schema}
            slug={view.slug}
            onOpen={(id) => openEditor(view.slug, id)}
          />
        )}
        {view.kind === 'editor' && (
          <DocumentEditor
            slug={view.slug}
            id={view.id}
            onClose={() => openList(view.slug)}
            onDeleted={() => openList(view.slug)}
          />
        )}
        {view.kind === 'settings' && (
          <SettingsScreen
            serverURL={serverURL}
            wsURLOverride={wsURLOverride}
            email={email}
            onLogout={onLogout}
            onChangeServer={onChangeServer}
          />
        )}
      </div>

      <StatusBar activeSlug={activeSlug} onOpenSettings={openSettings} />
    </div>
  )
}
