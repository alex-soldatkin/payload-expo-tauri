// Ambient types for the preload-exposed bridges.
export type PayloadSqliteBridge = {
  open(name: string): Promise<string>
  all(dbId: string, sql: string, params: unknown[]): Promise<any[]>
  run(dbId: string, sql: string, params: unknown[]): Promise<void>
  setPragma(dbId: string, key: string, value: string): Promise<void>
  close(dbId: string): Promise<void>
}

export type MenuItemTree = {
  label: string
  submenu?: MenuItemTree[]
  action?: string
  accelerator?: string
  enabled?: boolean
}

export type PayloadDesktopBridge = {
  getSettings(): Promise<Record<string, unknown>>
  setSettings(patch: Record<string, unknown>): Promise<Record<string, unknown>>
  setMenu(tree: MenuItemTree[]): void
  onMenuAction(cb: (action: string) => void): () => void
  openWebAdmin(): void
}

declare global {
  interface Window {
    payloadSqlite: PayloadSqliteBridge
    payloadDesktop: PayloadDesktopBridge
  }
}

// Allow the non-standard -webkit-app-region CSS property in JSX styles.
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

export {}
