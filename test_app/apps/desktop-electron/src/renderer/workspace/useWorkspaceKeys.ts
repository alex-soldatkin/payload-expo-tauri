// VS Code keyboard model for the tabbed workspace:
//   Cmd/Ctrl+W close active · Cmd/Ctrl+Shift+T reopen closed · Ctrl+Tab MRU next
import { useEffect } from 'react'
import type { Action, WorkspaceState } from './state'

export function useWorkspaceKeys(state: WorkspaceState, dispatch: (a: Action) => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'w') {
        const group = state.groups[state.activeGroupId]
        if (group?.activeTabId) {
          e.preventDefault()
          dispatch({ type: 'close', tabId: group.activeTabId })
        }
        return
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        dispatch({ type: 'reopenClosed' })
        return
      }
      if (e.ctrlKey && !e.metaKey && e.key === 'Tab') {
        e.preventDefault()
        dispatch({ type: 'mruNext' })
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, dispatch])
}
