// Which-key style pane/tab selector:
//   hold Cmd/Ctrl            → number badges on PANES (visual order)
//   Cmd+N (panes stage)      → focus pane N, badges switch to its TABS
//   Cmd+M (tabs stage)       → activate tab M in the focused pane
//   re-tap Cmd within 1.2s   → jump straight to the tabs stage
//   single pane              → tabs stage immediately
// Numbers only act while the modifier is held, so plain typing is never
// hijacked. Badges hide on modifier release / Escape / blur.
import { useEffect, useState } from 'react'
import { leafOrder } from './layout'
import type { Action, WorkspaceState } from './state'

export type QuickSelect = {
  visible: boolean
  stage: 'panes' | 'tabs'
}

const RETAP_WINDOW_MS = 1200

export function useQuickSelect(
  state: WorkspaceState,
  dispatch: (a: Action) => void,
): QuickSelect {
  const [qs, setQs] = useState<QuickSelect>({ visible: false, stage: 'panes' })
  const [lastRelease, setLastRelease] = useState(0)

  useEffect(() => {
    const isModifier = (e: KeyboardEvent) => e.key === 'Meta' || e.key === 'Control'

    const onKeyDown = (e: KeyboardEvent) => {
      if (isModifier(e) && !e.repeat) {
        const groups = leafOrder(state.layout)
        const single = groups.length < 2
        const retap = Date.now() - lastRelease < RETAP_WINDOW_MS
        setQs({ visible: true, stage: single || retap ? 'tabs' : 'panes' })
        return
      }
      if (e.key === 'Escape') {
        setQs((prev) => (prev.visible ? { ...prev, visible: false } : prev))
        return
      }
      // Numbers act only with the modifier held and the overlay up.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        const n = Number(e.key) - 1
        // Even without the overlay (fast users), Cmd+N keeps working — panes
        // first, matching the previous behavior.
        const stage = qs.visible ? qs.stage : 'panes'
        e.preventDefault()
        if (stage === 'panes') {
          dispatch({ type: 'focusGroupAt', index: n })
          setQs({ visible: true, stage: 'tabs' })
        } else {
          const group = state.groups[state.activeGroupId]
          const tabId = group?.tabIds[n]
          if (tabId) dispatch({ type: 'activate', tabId })
          setQs((prev) => ({ ...prev, visible: false }))
        }
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (isModifier(e)) {
        setLastRelease(Date.now())
        setQs((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      }
    }
    const onBlur = () => setQs((prev) => (prev.visible ? { ...prev, visible: false } : prev))

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [state, dispatch, qs.visible, qs.stage, lastRelease])

  return qs
}
