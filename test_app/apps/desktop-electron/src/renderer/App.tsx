// Top-level state machine for the local-first Payload desktop client.
//
//   boot → connect (no server) → login (no/invalid token) → workspace
//
// The workspace fetches the admin schema; a 401/403 drops the token and
// returns to login. Settings persist via window.payloadDesktop.
import { useCallback, useEffect, useState } from 'react'
import type { AdminSchema } from '@payload-universal/admin-schema'
import { ConnectScreen } from './components/ConnectScreen'
import { LoginScreen } from './components/LoginScreen'
import { Workspace } from './components/Workspace'
import { AuthError, loadSchema } from './lib/api'
import type { DesktopSettings } from './lib/settings'

type Stage =
  | { name: 'boot' }
  | { name: 'connect' }
  | { name: 'login' }
  | { name: 'loading-schema' }
  | { name: 'workspace'; schema: AdminSchema }

export function App() {
  const [settings, setSettings] = useState<DesktopSettings>({})
  const [stage, setStage] = useState<Stage>({ name: 'boot' })
  const [schemaError, setSchemaError] = useState<string | null>(null)

  const persist = useCallback(async (patch: Partial<DesktopSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
    try {
      await window.payloadDesktop.setSettings(patch as Record<string, unknown>)
    } catch (err) {
      console.error('Failed to persist settings:', err)
    }
  }, [])

  // ---- Boot: load persisted settings, pick the initial stage --------------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let loaded: DesktopSettings = {}
      try {
        loaded = (await window.payloadDesktop.getSettings()) as DesktopSettings
      } catch (err) {
        console.error('Failed to read settings:', err)
      }
      if (cancelled) return
      setSettings(loaded)
      if (!loaded.serverURL) setStage({ name: 'connect' })
      else if (!loaded.token) setStage({ name: 'login' })
      else setStage({ name: 'loading-schema' })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- loading-schema: fetch the admin schema with the token --------------
  useEffect(() => {
    if (stage.name !== 'loading-schema') return
    const { serverURL, token, language } = settings
    if (!serverURL || !token) {
      setStage(token ? { name: 'connect' } : { name: 'login' })
      return
    }
    let cancelled = false
    setSchemaError(null)
    ;(async () => {
      try {
        const schema = await loadSchema(serverURL, token, language)
        if (!cancelled) setStage({ name: 'workspace', schema })
      } catch (err) {
        if (cancelled) return
        if (err instanceof AuthError) {
          await persist({ token: undefined })
          setSettings((prev) => ({ ...prev, token: undefined }))
          setStage({ name: 'login' })
        } else {
          setSchemaError(err instanceof Error ? err.message : 'Failed to load schema.')
          setStage({ name: 'login' })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stage.name, settings.serverURL, settings.token, settings.language, persist])

  // ---- Transitions --------------------------------------------------------
  const handleConnect = useCallback(
    (serverURL: string, wsURLOverride?: string) => {
      persist({ serverURL, wsURLOverride })
      setStage({ name: 'login' })
    },
    [persist],
  )

  const handleLoggedIn = useCallback(
    (token: string, email: string) => {
      persist({ token, email })
      setStage({ name: 'loading-schema' })
    },
    [persist],
  )

  const handleChangeServer = useCallback(() => {
    setStage({ name: 'connect' })
  }, [])

  const handleLogout = useCallback(() => {
    persist({ token: undefined })
    setStage({ name: 'login' })
  }, [persist])

  // Re-fetch the admin schema in a new language WITHOUT a full logout: persist
  // the choice, then drop back to loading-schema so the effect above re-fetches
  // (?language=) and swaps the localized schema into the workspace.
  const handleChangeLanguage = useCallback(
    (language: string) => {
      persist({ language })
      setStage({ name: 'loading-schema' })
    },
    [persist],
  )

  // ---- Render -------------------------------------------------------------
  if (stage.name === 'boot' || stage.name === 'loading-schema') {
    return (
      <div className="screen">
        <div className="screen-drag" />
        <div className="screen-body">
          <div className="center-note">
            {stage.name === 'boot' ? 'Starting…' : 'Loading workspace…'}
          </div>
        </div>
      </div>
    )
  }

  if (stage.name === 'connect') {
    return (
      <ConnectScreen
        initialURL={settings.serverURL}
        initialWsOverride={settings.wsURLOverride}
        onConnect={handleConnect}
      />
    )
  }

  if (stage.name === 'login') {
    return (
      <>
        {schemaError && (
          <div style={{ position: 'fixed', top: 46, left: 0, right: 0, textAlign: 'center' }}>
            <span className="error-box" style={{ display: 'inline-block' }}>
              {schemaError}
            </span>
          </div>
        )}
        <LoginScreen
          serverURL={settings.serverURL ?? ''}
          onLoggedIn={handleLoggedIn}
          onChangeServer={handleChangeServer}
        />
      </>
    )
  }

  // workspace — key by serverURL so switching servers remounts the provider.
  return (
    <Workspace
      key={settings.serverURL}
      schema={stage.schema}
      serverURL={settings.serverURL!}
      token={settings.token!}
      wsURLOverride={settings.wsURLOverride}
      email={settings.email}
      language={settings.language}
      onLogout={handleLogout}
      onChangeServer={handleChangeServer}
      onChangeLanguage={handleChangeLanguage}
    />
  )
}
