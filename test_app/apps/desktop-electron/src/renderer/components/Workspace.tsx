// Wires the per-server SQLite storage + LocalDBProvider around WorkspaceMain.
// Storage is built once per serverURL so each server gets an isolated DB.
import { useMemo } from 'react'
import {
  LocalDBProvider,
  getRxStorageSQLite,
  getSQLiteBasicsElectronIPC,
} from '@payload-universal/local-db'
import type { AdminSchema } from '@payload-universal/admin-schema'
import { WorkspaceMain } from './WorkspaceMain'
import { ToastProvider } from './toast/ToastProvider'
import { SyncToastBridge } from './toast/SyncToastBridge'
import { deriveWsURL, serverSlug } from '../lib/settings'
import '../form/custom/registerSSOT'

type Props = {
  schema: AdminSchema
  serverURL: string
  token: string
  wsURLOverride?: string
  email?: string
  language?: string
  onLogout: () => void
  onChangeServer: () => void
  onChangeLanguage: (language: string) => void
}

export function Workspace({
  schema,
  serverURL,
  token,
  wsURLOverride,
  email,
  language,
  onLogout,
  onChangeServer,
  onChangeLanguage,
}: Props) {
  // One storage instance per server — the DB name prefix isolates each server's
  // data on disk.
  const storage = useMemo(
    () =>
      getRxStorageSQLite({
        sqliteBasics: getSQLiteBasicsElectronIPC(window.payloadSqlite),
        databaseNamePrefix: `${serverSlug(serverURL)}__`,
      }),
    [serverURL],
  )

  const wsURL = useMemo(
    () => deriveWsURL(serverURL, wsURLOverride),
    [serverURL, wsURLOverride],
  )

  return (
    <LocalDBProvider
      schema={schema}
      baseURL={serverURL}
      token={token}
      wsURL={wsURL}
      storage={storage}
    >
      <ToastProvider>
      <SyncToastBridge />
      <WorkspaceMain
        schema={schema}
        serverURL={serverURL}
        token={token}
        wsURLOverride={wsURLOverride}
        email={email}
        language={language}
        onLogout={onLogout}
        onChangeServer={onChangeServer}
        onChangeLanguage={onChangeLanguage}
      />
      </ToastProvider>
    </LocalDBProvider>
  )
}
